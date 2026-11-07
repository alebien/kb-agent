import type { AgentMessage, Conversation, ConversationSummary, Message } from '@/domain'
import { conversations, defaultConversationId } from '@/mock/conversations'
import { formatDate, toLocalIsoString } from '@/utils/datetime'
import { useAuthStore } from '@/stores/auth'

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

/** 生成助手回答的 Markdown mock 内容，按提问关键词返回不同业务场景 */
function buildAnswerContent(prompt: string): string {
  /** 归一化后的提问，便于匹配关键词 */
  const normalized = prompt.toLowerCase()

  if (normalized.includes('发票')) {
    return `## 发票处理建议

已为你检索到发票相关规则，可以先按下面步骤确认：

1. 核对开票主体与税号是否正确
2. 电子普票在开具后 **30 天内** 可申请换开
3. 跨月换开需要先红冲原发票

> 如果订单已报销，请先确认财务是否接受红冲后的新票

| 场景 | 处理方式 |
| --- | --- |
| 抬头错误 | 申请换开 |
| 金额错误 | 红冲后重开 |
| 超过 30 天 | 转人工审核 |

需要我继续帮你查询具体订单的发票状态吗？`
  }

  if (normalized.includes('物流') || normalized.includes('快递')) {
    return `## 物流异常排查

可以按以下顺序确认包裹状态：

1. 查看物流轨迹是否超过 **48 小时** 未更新
2. 核对收件地址与联系电话是否完整
3. 联系承运方确认是否发生分拣异常

如果确认丢件，可以提交工单并附上订单号，客服会在 **4 小时内** 首次响应

> 涉及赔付时，请保留物流截图与商品价值凭证`
  }

  if (normalized.includes('会员') || normalized.includes('积分')) {
    return `## 会员权益说明

当前会员等级按近 **12 个月** 的实付金额计算，权益包含：

- 专属客服通道
- 生日双倍积分
- 每月免运费券

积分有效期为获取后 **24 个月**，过期前 30 天会通过站内信提醒`
  }

  return `## 处理结论

已结合企业知识库检索「${prompt}」，建议先确认订单状态与适用政策：

1. 核对订单是否在售后时效内
2. 确认商品当前状态与凭证是否齐全
3. 按对应政策提交申请并保留沟通记录

> 若涉及金额变更或发票重开，建议转人工复核

| 项目 | 说明 |
| --- | --- |
| 处理时效 | 1 个工作日内 |
| 退款路径 | 原路退回 |
| 人工介入 | 涉及金额变更时 |

如需继续处理，请补充订单号。`
}

/** 将长回答切成适合逐字追加的片段，模拟 SSE 增量文本 */
function splitAnswer(content: string): string[] {
  /** 每个片段包含的字符数，越小流式效果越细腻 */
  const chunkSize = 3
  /** 切片后的文本片段 */
  const chunks: string[] = []

  for (let index = 0; index < content.length; index += chunkSize) {
    chunks.push(content.slice(index, index + chunkSize))
  }

  return chunks
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

  /** 首次访问时创建的会话详情 */
  const created: Conversation = {
    summary,
    status: 'completed',
    confidence: 92,
    // 意图识别置信度，mock 里固定给一个高于 0.6 阈值的值
    intentConfidence: 0.93,
    ticketCode: 'A1024',
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
        content:
          '已根据企业知识库完成检索，并给出可执行结论。若涉及具体订单或工单，请在确认信息后转交人工跟进。',
        status: 'completed',
        createdAt,
        citations: [
          {
            id: `${id}-policy`,
            name: '企业服务政策 v3.2.pdf',
            description: `对应场景 · 更新于 ${formatDate(summary.updatedAt)}`,
            snippet: '符合本场景的用户，可在签收后 7 天内提交申请，审核通过后原路退回',
            score: 0.92,
          },
          {
            id: `${id}-sla`,
            name: '客服处理 SLA.docx',
            description: '工单时效 · 更新于 2026-10-01',
            snippet: '普通工单 4 小时内首次响应，紧急工单 30 分钟内响应',
            score: 0.86,
          },
        ],
        toolCalls: [
          {
            id: `${id}-search`,
            name: 'search_knowledge',
            arguments: { query: summary.title, top_k: 5 },
            status: 'success',
            result: { hits: 2, topScore: 0.92 },
            durationMs: 800,
          },
          {
            id: `${id}-order`,
            name: 'get_order',
            arguments: { orderNo: 'SO-20261103-0042' },
            status: 'success',
            result: { status: '已签收', signedAt: '2026-11-01T15:20:00+08:00' },
            durationMs: 240,
          },
        ],
      },
    ],
    stats: {
      duration: 1400,
      tokens: 2168,
      cost: 0.4,
      citations: 2,
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

/** 发送一条用户提问时返回的结果 */
export interface SendMessageResult {
  /** 会话最新的摘要，更新时间已刷新 */
  summary: ConversationSummary
  /** 本次生成的助手消息 id，用于停止与重试 */
  answerId: string
}

/**
 * 发送用户消息并以 mock 定时器模拟 SSE 增量输出
 * `onChunk` 只负责把增量文本追加到 UI，完整消息仍在接口结束时回传
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

  /** 当前回答的停止控制器 */
  const controller = new AbortController()
  answerControllers.set(answerId, controller)
  handlers.onStart?.(answerId)

  /** 本次回答的完整 Markdown 内容 */
  const fullContent = buildAnswerContent(prompt)
  /** 切片后的增量文本 */
  const chunks = splitAnswer(fullContent)

  try {
    for (const chunk of chunks) {
      if (controller.signal.aborted) {
        answer.status = 'stopped'
        answer.completedAt = toLocalIsoString(new Date())
        touchConversation(conversation, 'completed')
        notifyConversationUpdate(conversation, handlers)
        handlers.onStopped(answer)
        return { summary: { ...conversation.summary }, answerId }
      }

      // 模拟每个 SSE 事件间隔，长回答可被用户中途停止
      await delay(undefined, 24)
      // 停止可能发生在等待期间，此时不再追加新片段
      if (controller.signal.aborted) {
        answer.status = 'stopped'
        answer.completedAt = toLocalIsoString(new Date())
        touchConversation(conversation, 'completed')
        notifyConversationUpdate(conversation, handlers)
        handlers.onStopped(answer)
        return { summary: { ...conversation.summary }, answerId }
      }
      answer.content += chunk
      handlers.onChunk(chunk)
      notifyConversationUpdate(conversation, handlers)
    }

    answer.status = 'completed'
    answer.completedAt = toLocalIsoString(new Date())
    answer.citations = [
      {
        id: `${answerId}-citation`,
        name: '售后退款政策_v2.pdf',
        description: '售后政策库 · 更新于 2026-10-20',
        snippet: '符合本场景的用户，可在签收后 7 天内提交申请，审核通过后原路退回',
        score: 0.92,
      },
    ]
    answer.toolCalls = [
      {
        id: `${answerId}-search`,
        name: 'search_knowledge',
        arguments: { query: prompt, top_k: 5 },
        status: 'success',
        result: { hits: 1, topScore: 0.92 },
        durationMs: 260,
      },
    ]
    conversation.stats.duration += 1200
    conversation.stats.tokens += fullContent.length
    conversation.stats.citations = conversation.messages.reduce(
      (count, message) => count + (message.role === 'agent' ? message.citations.length : 0),
      0,
    )
    touchConversation(conversation, 'completed')
    notifyConversationUpdate(conversation, handlers)
    handlers.onDone(answer)
  } catch (error) {
    answer.status = 'failed'
    answer.error = error instanceof Error ? error.message : '生成失败'
    answer.completedAt = toLocalIsoString(new Date())
    touchConversation(conversation, 'failed')
    notifyConversationUpdate(conversation, handlers)
    handlers.onError(answer)
  } finally {
    answerControllers.delete(answerId)
  }

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

  /** 当前重试请求的停止控制器 */
  const controller = new AbortController()
  answerControllers.set(answerId, controller)
  handlers.onStart?.(answerId)

  /** 重试时重新生成的内容 */
  const fullContent = buildAnswerContent(prompt)
  /** 重试内容切片 */
  const chunks = splitAnswer(fullContent)

  try {
    for (const chunk of chunks) {
      if (controller.signal.aborted) {
        answer.status = 'stopped'
        answer.completedAt = toLocalIsoString(new Date())
        touchConversation(conversation, 'completed')
        notifyConversationUpdate(conversation, handlers)
        handlers.onStopped(answer)
        return
      }

      await delay(undefined, 24)
      // 停止可能发生在等待期间，此时不再追加新片段
      if (controller.signal.aborted) {
        answer.status = 'stopped'
        answer.completedAt = toLocalIsoString(new Date())
        touchConversation(conversation, 'completed')
        notifyConversationUpdate(conversation, handlers)
        handlers.onStopped(answer)
        return
      }
      answer.content += chunk
      handlers.onChunk(chunk)
      notifyConversationUpdate(conversation, handlers)
    }

    answer.status = 'completed'
    answer.completedAt = toLocalIsoString(new Date())
    answer.citations = [
      {
        id: `${answerId}-citation`,
        name: '售后退款政策_v2.pdf',
        description: '售后政策库 · 更新于 2026-10-20',
        snippet: '符合本场景的用户，可在签收后 7 天内提交申请，审核通过后原路退回',
        score: 0.92,
      },
    ]
    answer.toolCalls = [
      {
        id: `${answerId}-search`,
        name: 'search_knowledge',
        arguments: { query: prompt, top_k: 5 },
        status: 'success',
        result: { hits: 1, topScore: 0.92 },
        durationMs: 260,
      },
    ]
    conversation.stats.citations = conversation.messages.reduce(
      (count, message) => count + (message.role === 'agent' ? message.citations.length : 0),
      0,
    )
    touchConversation(conversation, 'completed')
    notifyConversationUpdate(conversation, handlers)
    handlers.onDone(answer)
  } catch (error) {
    answer.status = 'failed'
    answer.error = error instanceof Error ? error.message : '生成失败'
    answer.completedAt = toLocalIsoString(new Date())
    touchConversation(conversation, 'failed')
    notifyConversationUpdate(conversation, handlers)
    handlers.onError(answer)
  } finally {
    answerControllers.delete(answerId)
  }
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
