import type {
  AgentMessage,
  Citation,
  Conversation,
  ConversationSummary,
  Message,
  ToolCall,
} from '@/domain'
import { conversations, defaultConversationId } from '@/mock/conversations'
import { buildMockScenario } from '@/mock/conversation-scenarios'
import { toLocalIsoString } from '@/utils/datetime'
import { useAuthStore } from '@/stores/auth'
import { buildSseDebugUrl, recordSseDebugEntry } from '@/dev/sse-debug'
import { readEventData, streamSse } from './sse'

/** 会话不存在或不属于当前登录人时抛出的错误码，前端统一映射为同一句提示 */
export const CONVERSATION_FORBIDDEN_CODE = 'FORBIDDEN_CONVERSATION'

/**
 * 会话归属校验失败
 * MVP 的全部五个会话入口统一走这里，避免各处手写 createdBy 比较
 */
export class ConversationForbiddenError extends Error {
  /** 与接口约定一致的错误码，便于前端按 code 映射文案 */
  readonly code = CONVERSATION_FORBIDDEN_CODE

  constructor() {
    super('会话不存在或无权访问')
    this.name = 'ConversationForbiddenError'
  }
}

/** 当前登录人 id，未登录时返回空字符串，所有会话操作都会被拒绝 */
function currentUserId(): string {
  return useAuthStore().user?.id ?? ''
}

/** 校验会话是否属于当前登录人，缺失 createdBy 的历史数据归当前登录人 */
function assertConversationOwner(summary: ConversationSummary): void {
  /** 当前登录人 id */
  const userId = currentUserId()
  if (!userId) {
    throw new ConversationForbiddenError()
  }

  // 历史数据没有 createdBy 时先补写成当前登录人，之后仍按严格归属判断
  if (!summary.createdBy) {
    summary.createdBy = userId
    return
  }

  if (summary.createdBy !== userId) {
    throw new ConversationForbiddenError()
  }
}

/** 会话详情缓存，key 为会话 id，避免重复构造 mock 数据 */
const details = new Map<string, Conversation>()

/** 正在生成的回答控制器，key 为助手消息 id，用于停止流式输出 */
const answerControllers = new Map<string, AbortController>()

/** 模拟网络延迟，统一返回传入的值 */
function delay<T>(value: T, milliseconds = 280): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), milliseconds)
  })
}

/**
 * 按会话 id 获取缓存详情，作为发消息、停止、删除消息与重试的统一入口
 * 先校验归属，再取缓存，缺失时按无权访问处理，不暴露会话是否存在
 */
function requireDetail(id: string): Conversation {
  /** 会话摘要在 mock 列表中的记录，用于归属校验 */
  const summary = conversations.find((conversation) => conversation.id === id)
  if (!summary) {
    throw new ConversationForbiddenError()
  }

  assertConversationOwner(summary)

  /** 当前会话详情 */
  const conversation = details.get(id)
  if (!conversation) {
    throw new ConversationForbiddenError()
  }

  return conversation
}

/** 同步会话状态与摘要更新时间 */
function touchConversation(conversation: Conversation, status: Conversation['status']) {
  /** 当前时间 */
  const now = new Date()
  conversation.status = status
  // 摘要的 updatedAt 语义是带时区 ISO 字符串，这里统一走工具函数生成本地时间
  conversation.summary.updatedAt = toLocalIsoString(now)

  /** 原始会话摘要，需要同步侧边栏列表 */
  const summary = conversations.find((item) => item.id === conversation.summary.id)
  if (summary) {
    summary.updatedAt = conversation.summary.updatedAt
  }
}

/** 按会话 id 构造并缓存一份会话详情 */
function detail(id: string): Conversation {
  /** 在预置列表中查找对应的会话摘要 */
  const summary = conversations.find((conversation) => conversation.id === id)
  if (!summary) {
    throw new ConversationForbiddenError()
  }

  assertConversationOwner(summary)

  if (details.has(id)) {
    return details.get(id)!
  }

  /** mock 消息的创建时间，摘要更新时间已是 ISO 字符串，可直接复用 */
  const createdAt = summary.updatedAt
  /** 当前会话对应的页面演示场景 */
  const scenario = buildMockScenario(id, summary.title)
  /** 引用条数，统计口径与消息中的引用数组一致 */
  const citationCount = scenario.citations.length

  /** 首次访问时创建的会话详情 */
  const created: Conversation = {
    summary,
    status: 'completed',
    confidence: scenario.confidence,
    // 澄清场景的意图置信度低于阈值，其余场景给一个可通过检索的值
    intentConfidence: scenario.confidence === null ? 0.48 : 0.93,
    ticketCode: scenario.ticketCode,
    traceId: summary.id.slice(0, 6),
    messages: [
      {
        id: `${id}-user`,
        conversationId: id,
        role: 'user',
        content: `我需要处理「${summary.title}」。`,
        status: 'completed',
        createdAt,
      },
      {
        id: `${id}-agent`,
        conversationId: id,
        role: 'agent',
        content: scenario.content,
        status: 'completed',
        createdAt,
        confidence: scenario.confidence ?? undefined,
        durationMs: scenario.durationMs,
        citations: scenario.citations,
        toolCalls: scenario.toolCalls,
      },
    ],
    stats: {
      duration: scenario.durationMs,
      tokens: 2168,
      cost: 0.4,
      citations: citationCount,
    },
    qualityMetrics: [
      { label: '回答忠实度', percentage: 94 },
      { label: '检索命中率', percentage: 88, status: 'success' },
      { label: '工具成功率', percentage: 100, status: 'warning' },
    ],
    traceSteps: [
      { id: `${id}-trace-run`, name: 'agent.run', duration: 1400, detail: '' },
      { id: `${id}-trace-intent`, name: 'classify_intent', duration: 200, detail: '' },
      { id: `${id}-trace-search`, name: 'search_knowledge', duration: 800, detail: '' },
      { id: `${id}-trace-answer`, name: 'compose_answer', duration: 400, detail: '' },
    ],
  }

  details.set(id, created)
  return created
}

/** 获取会话摘要列表，返回浅拷贝避免调用方直接修改 mock 数据 */
export async function fetchConversationList(): Promise<ConversationSummary[]> {
  /** 当前登录人 id，列表只返回本人创建的会话 */
  const userId = currentUserId()
  if (!userId) {
    return delay([])
  }

  // 历史数据缺少 createdBy 时归当前登录人，避免老数据在列表里消失
  for (const conversation of conversations) {
    if (!conversation.createdBy) {
      conversation.createdBy = userId
    }
  }

  /** 归属当前登录人的会话摘要，最多返回 50 条 */
  const list = conversations
    .filter((conversation) => conversation.createdBy === userId)
    .slice(0, 50)
    .map((conversation) => ({ ...conversation }))

  return delay(list)
}

/** 获取会话详情，已缓存时直接返回，否则延迟模拟请求 */
export async function fetchConversationDetail(id: string): Promise<Conversation> {
  /** 当前会话摘要，用于请求前的归属校验 */
  const summary = conversations.find((conversation) => conversation.id === id)
  if (!summary) {
    throw new ConversationForbiddenError()
  }

  assertConversationOwner(summary)

  /** 命中的缓存详情 */
  const cached = details.get(id)
  if (cached) {
    return cloneConversation(cached)
  }

  return delay(cloneConversation(detail(id)))
}

/** 流式回答的进度回调参数 */
export interface AnswerStreamHandlers {
  /** 流式开始，返回本次助手消息 id */
  onStart?: (answerId: string) => void
  /** 收到一个增量文本片段 */
  onChunk: (chunk: string) => void
  /** 消息快照更新，用于把 mock 缓存中的最新消息同步到页面响应式状态 */
  onUpdate?: (messages: Message[]) => void
  /** 流式正常结束 */
  onDone: (message: AgentMessage) => void
  /** 流式被用户停止 */
  onStopped: (message: AgentMessage) => void
  /** 流式异常 */
  onError: (message: AgentMessage) => void
  /** 收到一条原始事件，仅开发环境用于观察协议细节 */
  onRawEvent?: (raw: string) => void
}

/** 发送用户消息时的可选项 */
export interface SendMessageOptions {
  /** 复用创建会话时已写入的用户消息 id，避免首问重复追加 */
  reuseUserMessageId?: string
}

/** 生成当前会话消息的深拷贝快照，避免调用方直接持有 mock 缓存引用 */
function snapshotMessages(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.role !== 'agent') {
      return { ...message }
    }

    return {
      ...message,
      citations: message.citations.map((citation) => ({ ...citation })),
      toolCalls: message.toolCalls.map((toolCall) => ({ ...toolCall })),
    }
  })
}

/** 深拷贝会话详情，页面持有副本后不会反向覆盖 mock 缓存中的消息数组 */
function cloneConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    summary: { ...conversation.summary },
    messages: snapshotMessages(conversation.messages),
    stats: { ...conversation.stats },
    qualityMetrics: conversation.qualityMetrics.map((metric) => ({ ...metric })),
    traceSteps: conversation.traceSteps.map((step) => ({ ...step })),
  }
}

/** 把 mock 缓存中的最新消息、状态与摘要同步给页面 */
function notifyConversationUpdate(conversation: Conversation, handlers: AnswerStreamHandlers) {
  handlers.onUpdate?.(snapshotMessages(conversation.messages))
}

/** 流式接口地址，开发环境由 dev/mock-sse-server.ts 提供，接真实后端时改这里 */
const STREAM_URL = '/api/dev/sse/chat'

/** 服务端推送的事件负载，字段与 dev/mock-sse-server.ts 保持一致 */
interface StreamPayload {
  /** delta 事件的增量文本 */
  text?: string
  /** 回答置信度，0-100 整数 */
  confidence?: number
  /** 生成该消息的模型名称 */
  model?: string
  /** 本次回答耗时，单位毫秒 */
  durationMs?: number
  /** 本次回答消耗的 token 数 */
  tokens?: number
  /** error 事件的错误说明 */
  message?: string
}

/** 按 id 覆盖写入列表项，工具调用会先推 running 再推 success */
function upsertById<T extends { id: string }>(list: T[], item: T): void {
  /** 已存在项的下标，-1 表示还没写入过 */
  const index = list.findIndex((current) => current.id === item.id)
  if (index === -1) {
    list.push(item)
    return
  }

  list.splice(index, 1, item)
}

/**
 * 把一次真实的 SSE 回答写进会话
 *
 * sendMessage 与 regenerateMessage 共用这段流程，区别只在调用前如何准备消息
 * 事件约定：start → tool(running) → citation → tool(success) → delta… → done
 *
 * @param conversation 当前会话，流式过程中会被就地修改
 * @param answer 正在生成的助手消息，调用前需已加入消息列表
 * @param prompt 本轮提问，作为请求体发给服务端
 * @param handlers 页面回调，与接口签名保持一致
 */
async function runAnswerStream(
  conversation: Conversation,
  answer: AgentMessage,
  prompt: string,
  handlers: AnswerStreamHandlers,
): Promise<void> {
  /** 当前回答的停止控制器，abort 会直接关闭底层连接 */
  const controller = new AbortController()
  answerControllers.set(answer.id, controller)
  handlers.onStart?.(answer.id)

  /** 流式开始时间，服务端没回 durationMs 时用它兜底 */
  const startedAt = Date.now()
  /** 是否已收到 done 事件，作为回答完成的唯一成功信号 */
  let receivedDone = false

  try {
    await streamSse(
      buildSseDebugUrl(STREAM_URL),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, answerId: answer.id }),
      },
      {
        onRawEvent: (raw) => {
          recordSseDebugEntry(raw)
          handlers.onRawEvent?.(raw)
        },
        onEvent: (event) => {
          switch (event.event) {
            case 'delta': {
              /** 增量文本，追加后只把这一小段回传页面 */
              const text = readEventData<StreamPayload>(event).text ?? ''
              answer.content += text
              // 流式过程中只回传增量，避免每个 chunk 都深拷贝整条消息列表
              handlers.onChunk(text)
              break
            }
            case 'citation': {
              upsertById(answer.citations, readEventData<Citation>(event))
              // 引用到达后立刻同步快照，来源卡片无需等回答结束才出现
              notifyConversationUpdate(conversation, handlers)
              break
            }
            case 'tool': {
              upsertById(answer.toolCalls, readEventData<ToolCall>(event))
              // 工具调用状态从 running 变为 success 时同样需要立即刷新
              notifyConversationUpdate(conversation, handlers)
              break
            }
            case 'error':
              // 先同步已生成内容，再抛错走失败分支，避免失败态丢失半截回答
              notifyConversationUpdate(conversation, handlers)
              throw new Error(readEventData<StreamPayload>(event).message ?? '回答生成失败')
            case 'done': {
              /** 收尾统计信息 */
              const payload = readEventData<StreamPayload>(event)
              answer.confidence = payload.confidence
              answer.model = payload.model
              answer.durationMs = payload.durationMs ?? Date.now() - startedAt
              conversation.confidence = payload.confidence ?? null
              conversation.stats.duration += answer.durationMs
              conversation.stats.tokens += payload.tokens ?? 0
              receivedDone = true
              // 通知传输层停止读取，不等网关关闭长连接
              return true
            }
            default:
              // 未知事件先忽略，方便后端先上线新事件、前端再逐步支持
              break
          }
        },
      },
      { signal: controller.signal },
    )

    // done 是唯一的成功信号，连接提前关闭说明回答被截断
    if (!receivedDone) {
      throw new Error('连接已关闭，但未收到 done 事件，回答可能不完整')
    }

    answer.status = 'completed'
    answer.completedAt = toLocalIsoString(new Date())
    answer.durationMs ??= Date.now() - startedAt
    conversation.stats.citations = conversation.messages.reduce(
      (count, message) => count + (message.role === 'agent' ? message.citations.length : 0),
      0,
    )
    touchConversation(conversation, 'completed')
    notifyConversationUpdate(conversation, handlers)
    handlers.onDone(answer)
  } catch (error) {
    // 主动停止属于预期行为，保留已生成内容
    if (controller.signal.aborted) {
      answer.status = 'stopped'
      answer.completedAt = toLocalIsoString(new Date())
      touchConversation(conversation, 'completed')
      notifyConversationUpdate(conversation, handlers)
      handlers.onStopped(answer)
      return
    }

    answer.status = 'failed'
    answer.error = error instanceof Error ? error.message : '生成失败'
    answer.completedAt = toLocalIsoString(new Date())
    touchConversation(conversation, 'failed')
    notifyConversationUpdate(conversation, handlers)
    handlers.onError(answer)
  } finally {
    answerControllers.delete(answer.id)
  }
}

/** 发送一条用户提问时返回的结果 */
export interface SendMessageResult {
  /** 会话最新的摘要，更新时间已刷新 */
  summary: ConversationSummary
  /** 本次生成的助手消息 id，用于停止与重试 */
  answerId: string
}

/**
 * 发送用户消息并消费服务端推送的 SSE 流
 * `onChunk` 只负责把增量文本追加到 UI，引用、工具调用与统计信息在流中陆续补齐
 */
export async function sendMessage(
  id: string,
  content: string,
  handlers: AnswerStreamHandlers,
  options: SendMessageOptions = {},
): Promise<SendMessageResult> {
  /** 当前会话详情 */
  const conversation = requireDetail(id)
  /** 去除首尾空白后的提问 */
  const prompt = content.trim()
  if (!prompt) {
    throw new Error('消息内容不能为空')
  }

  /** 用户消息与助手消息共用的毫秒时间戳 */
  const now = new Date()
  /** 用户消息唯一标识，首问复用创建会话时写入的 id */
  const userMessageId = options.reuseUserMessageId ?? `${id}-user-${now.getTime()}`
  /** 助手消息唯一标识 */
  const answerId = `${id}-agent-${now.getTime()}`

  /** 新写入的用户消息 */
  const userMessage: Message = {
    id: userMessageId,
    conversationId: id,
    role: 'user',
    content: prompt,
    status: 'completed',
    createdAt: toLocalIsoString(now),
  }

  /** 正在流式生成的助手消息 */
  const answer: AgentMessage = {
    id: answerId,
    conversationId: id,
    role: 'agent',
    content: '',
    status: 'streaming',
    createdAt: toLocalIsoString(now),
    startedAt: toLocalIsoString(now),
    replyToMessageId: userMessageId,
    citations: [],
    toolCalls: [],
  }

  /** 首问复用创建会话时已写入的用户消息，只追加助手消息 */
  if (options.reuseUserMessageId) {
    conversation.messages.push(answer)
  } else {
    conversation.messages.push(userMessage, answer)
  }
  touchConversation(conversation, 'processing')
  notifyConversationUpdate(conversation, handlers)

  // 建连、收事件、收尾状态都交给统一流程处理
  await runAnswerStream(conversation, answer, prompt, handlers)

  return { summary: { ...conversation.summary }, answerId }
}

/** 停止正在生成的回答，保留已生成的文本 */
export async function stopMessage(id: string, answerId: string): Promise<void> {
  /** 当前会话详情 */
  const conversation = requireDetail(id)
  /** 正在生成回答的控制器 */
  const controller = answerControllers.get(answerId)
  if (!controller) {
    return
  }

  controller.abort()
  /** 被停止的助手消息 */
  const answer = conversation.messages.find((message) => message.id === answerId)
  if (answer?.role === 'agent') {
    answer.status = 'stopped'
    answer.completedAt = toLocalIsoString(new Date())
  }
  touchConversation(conversation, 'completed')
}

/** 删除一条消息及其后续消息，返回删除后的完整消息列表 */
export async function deleteMessage(id: string, messageId: string): Promise<Message[]> {
  /** 当前会话详情 */
  const conversation = requireDetail(id)
  /** 待删除消息的下标 */
  const index = conversation.messages.findIndex((message) => message.id === messageId)
  if (index === -1) {
    throw new Error(`Message ${messageId} not found`)
  }

  await delay(undefined, 120)
  conversation.messages.splice(index, 1)
  touchConversation(conversation, conversation.messages.length ? 'completed' : 'idle')

  return conversation.messages.map((message) => ({ ...message }))
}

/**
 * 重新生成一条助手回答
 * 先清空原回答保留消息位置，再按原提问重新流式生成，避免页面出现重复回答
 */
export async function regenerateMessage(
  id: string,
  answerId: string,
  handlers: AnswerStreamHandlers,
): Promise<void> {
  /** 当前会话详情 */
  const conversation = requireDetail(id)
  /** 待重试的助手消息 */
  const answer = conversation.messages.find((message) => message.id === answerId)
  if (!answer || answer.role !== 'agent') {
    throw new Error(`Agent message ${answerId} not found`)
  }

  /** 原始用户提问 */
  const promptMessage = conversation.messages.find(
    (message) => message.id === answer.replyToMessageId,
  )
  /** 原始提问文本，找不到时回退到会话标题 */
  const prompt = promptMessage?.content ?? conversation.summary.title

  answer.content = ''
  answer.status = 'streaming'
  answer.error = undefined
  answer.citations = []
  answer.toolCalls = []
  answer.startedAt = toLocalIsoString(new Date())
  touchConversation(conversation, 'processing')
  notifyConversationUpdate(conversation, handlers)

  // 重试与首次发送共用同一套流式流程，只是消息位置不同
  await runAnswerStream(conversation, answer, prompt, handlers)
}

/** 创建新会话时返回的摘要与完整详情 */
export interface CreatedConversation {
  /** 会话摘要 */
  summary: ConversationSummary
  /** 会话详情，供页面直接使用，避免再发一次详情请求 */
  detail: Conversation
}

/** 创建新会话，生成 UUID 并写入 mock 数据 */
export async function createConversation(initialMessage?: string): Promise<CreatedConversation> {
  /** 当前登录人 id，建会话时写入 createdBy 并作为后续归属判定依据 */
  const createdBy = currentUserId()
  if (!createdBy) {
    throw new ConversationForbiddenError()
  }

  /** 浏览器生成的会话唯一标识 */
  const uuid = window.crypto.randomUUID()
  /** 去除首尾空白后的首条提问 */
  const prompt = initialMessage?.trim() ?? ''
  /** 用于生成标题的单行文本 */
  const titleSource = prompt.replace(/\s+/g, ' ')
  /** 当前时间，用于生成摘要与消息的 ISO 时间 */
  const now = new Date()
  /** 带时区的本地 ISO 时间，摘要 updatedAt 与首条消息共用 */
  const createdAt = toLocalIsoString(now)
  /** 新会话的摘要信息 */
  const summary: ConversationSummary = {
    id: uuid,
    title: titleSource
      ? titleSource.length > 24
        ? `${titleSource.slice(0, 24)}…`
        : titleSource
      : '新对话',
    createdBy,
    createdAt,
    updatedAt: createdAt,
  }

  /** mock 消息使用的 ISO 时间，与摘要共用同一带时区格式 */
  const messageCreatedAt = createdAt

  /** 新会话只写入用户提问，助手回答由发送接口按流式过程追加 */
  const messages: Conversation['messages'] = prompt
    ? [
        {
          id: `${uuid}-user`,
          conversationId: uuid,
          role: 'user',
          content: prompt,
          status: 'completed',
          createdAt: messageCreatedAt,
        },
      ]
    : []

  /** 新建会话的完整详情 */
  const createdDetail: Conversation = {
    summary,
    status: prompt ? 'processing' : 'idle',
    confidence: null,
    ticketCode: null,
    traceId: 'draft',
    messages,
    stats: {
      duration: 0,
      tokens: 0,
      cost: 0,
      citations: 0,
    },
    qualityMetrics: [],
    traceSteps: [],
  }

  details.set(uuid, createdDetail)

  conversations.unshift(summary)
  return delay({ summary: { ...summary }, detail: cloneConversation(createdDetail) }, 160)
}

/** 删除一个会话，同时清理对应的详情缓存 */
export async function deleteConversation(id: string): Promise<void> {
  /** 待删除会话在 mock 列表中的下标 */
  const index = conversations.findIndex((conversation) => conversation.id === id)
  if (index === -1) {
    throw new ConversationForbiddenError()
  }

  const summary = conversations[index]!
  assertConversationOwner(summary)

  await delay(undefined, 180)
  conversations.splice(index, 1)
  details.delete(id)
}

/** 重命名会话，返回更新后的摘要 */
export async function renameConversation(id: string, title: string): Promise<ConversationSummary> {
  /** 去除首尾空白后的新标题 */
  const nextTitle = title.trim()
  if (!nextTitle) {
    throw new Error('Conversation title cannot be empty')
  }

  /** 待重命名的会话摘要 */
  const summary = conversations.find((conversation) => conversation.id === id)
  if (!summary) {
    throw new ConversationForbiddenError()
  }

  assertConversationOwner(summary)

  await delay(undefined, 180)
  summary.title = nextTitle

  /** 已缓存会话详情中的摘要，需要同步更新标题 */
  const cached = details.get(id)
  if (cached) {
    cached.summary.title = nextTitle
  }

  return { ...summary }
}

export { defaultConversationId }
