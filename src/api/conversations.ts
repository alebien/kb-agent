import type {
  AgentMessage,
  Citation,
  Conversation,
  ConversationSummary,
  Message,
  ToolCall,
} from '@/domain'
import { conversations, defaultConversationId } from '@/mock/conversations'
import { toLocalIsoString } from '@/utils/datetime'
import { useAuthStore } from '@/stores/auth'
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

/** 预置会话的演示场景，用于覆盖引用、工具失败、低置信度与澄清等页面状态 */
interface MockAnswerScenario {
  /** 助手回答正文 */
  content: string
  /** 回答置信度，null 表示澄清轮不产生置信度 */
  confidence: number | null
  /** 本条回答总耗时，单位毫秒 */
  durationMs: number
  /** 引用来源列表 */
  citations: Citation[]
  /** 工具调用列表 */
  toolCalls: ToolCall[]
  /** 关联工单号，没有时为 null */
  ticketCode: string | null
}

/**
 * 按会话标题生成演示场景
 *
 * 这里只构造页面可展示的数据，不实现意图识别、检索或建单逻辑
 *
 * @param id 会话 id，用于生成消息内唯一标识
 * @param title 会话标题，用于匹配演示场景
 */
function buildMockScenario(id: string, title: string): MockAnswerScenario {
  if (title.includes('客服话术更新')) {
    return {
      content:
        '## 暂无直接依据\n\n当前客服话术库处于暂停检索状态，知识库中没有找到可以直接引用的话术模板。\n\n建议不要直接承诺赔付金额或处理时效，先转人工确认最新口径后再回复客户。',
      confidence: 58,
      durationMs: 1560,
      citations: [],
      toolCalls: [
        {
          id: `${id}-search-empty`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 0, topScore: null },
          durationMs: 1200,
        },
        {
          id: `${id}-ticket`,
          name: 'create_ticket',
          arguments: { conversationId: id, category: 'other', priority: 'high' },
          status: 'success',
          result: { code: 'A1026', reused: false, status: 'open' },
          durationMs: 360,
        },
      ],
      ticketCode: 'A1026',
    }
  }

  if (title.includes('物流异常处理')) {
    return {
      content:
        '## 物流异常处理建议\n\n已检索到物流异常处理规范，可以先按以下步骤排查：\n\n1. 确认物流轨迹是否超过 **48 小时** 未更新\n2. 核对收件地址与联系电话是否完整\n3. 保留物流截图与商品价值凭证\n\n订单查询工具当前未返回结果，以下结论仅基于知识库，请人工核实订单状态后再答复客户。',
      confidence: 72,
      durationMs: 1560,
      citations: [
        {
          id: `${id}-logistics`,
          documentId: '6c0d9b47-3e5a-4f28-8a71-b2d4c6e9f013',
          knowledgeBaseId: 'kb_logistics',
          name: '配送时效与区域覆盖说明.md',
          description: '物流配送库 · 异常轨迹与时效口径',
          snippet: '物流轨迹超过 48 小时未更新时，应优先联系承运方确认分拣状态，并保留截图',
          page: 4,
          score: 0.81,
        },
      ],
      toolCalls: [
        {
          id: `${id}-search`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 1, topScore: 0.81 },
          durationMs: 360,
        },
        {
          id: `${id}-order`,
          name: 'get_order',
          arguments: { orderNo: 'SO-20261103-0042' },
          status: 'error',
          error: {
            code: 'ORDER_NOT_FOUND',
            message: '未查询到该订单',
            detail: '请核对订单号后重试',
          },
          durationMs: 1200,
        },
      ],
      ticketCode: 'A1025',
    }
  }

  if (title.includes('赔付时效咨询')) {
    return {
      content:
        '## 赔付时效需人工确认\n\n知识库仅能确认退款申请需在签收后 7 天内提交，但具体到账时效与赔付金额需要结合支付渠道和订单状态判断。\n\n本回答置信度较低，已为你转人工复核，请勿直接向客户承诺到账时间。',
      confidence: 62,
      durationMs: 920,
      citations: [
        {
          id: `${id}-refund-rule`,
          documentId: '9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71',
          knowledgeBaseId: 'kb_aftersale',
          name: '售后退款政策_v2.pdf',
          description: '售后政策库 · 退款申请条件',
          snippet: '退款申请需在签收后 7 天内提交，到账时效以支付渠道为准',
          page: 12,
          score: 0.66,
        },
      ],
      toolCalls: [
        {
          id: `${id}-search`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 1, topScore: 0.66 },
          durationMs: 640,
        },
        {
          id: `${id}-ticket`,
          name: 'create_ticket',
          arguments: { conversationId: id, category: 'refund', priority: 'high' },
          status: 'success',
          result: { code: 'A1031', reused: true, status: 'open' },
          durationMs: 280,
        },
      ],
      ticketCode: 'A1031',
    }
  }

  if (title.includes('退款还是发票')) {
    return {
      content:
        '想确认一下，你要咨询的是**退款到账**问题，还是**发票开具**问题？回复「退款」或「发票」即可继续。',
      confidence: null,
      durationMs: 180,
      citations: [],
      toolCalls: [],
      ticketCode: null,
    }
  }

  if (title.includes('发票开具流程')) {
    return {
      content:
        '## 发票处理建议\n\n已为你检索到发票相关规则，可以先按下面步骤确认：\n\n1. 核对开票主体与税号是否正确\n2. 电子普票在开具后 **30 天内** 可申请换开\n3. 跨月换开需要先红冲原发票\n\n其中跨月换开涉及财务审核，建议人工复核后再答复客户。',
      confidence: 78,
      durationMs: 380,
      citations: [
        {
          id: `${id}-invoice`,
          documentId: '4b7d2f58-1c9e-4a63-b840-7e5f9a2c6d13',
          knowledgeBaseId: 'kb_invoice',
          name: '发票开具流程说明.docx',
          description: '财务票据库 · 抬头换开与时效',
          snippet: '电子普通发票开具后 30 天内可申请换开，跨月换开需先完成红冲',
          page: 6,
          score: 0.84,
        },
        {
          id: `${id}-red-invoice`,
          documentId: '1f7e3a58-9c2b-4d81-b640-8a5e0f2c9d34',
          knowledgeBaseId: 'kb_invoice',
          name: '票据作废与红冲流程.pdf',
          description: '财务票据库 · 红冲操作',
          snippet: '已报销发票需先取得财务确认，再提交红冲申请',
          page: 11,
          score: 0.79,
        },
      ],
      toolCalls: [
        {
          id: `${id}-search`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 2, topScore: 0.84 },
          durationMs: 380,
        },
      ],
      ticketCode: null,
    }
  }

  if (title.includes('会员权益对比')) {
    return {
      content:
        '## 会员权益说明\n\n当前会员等级按近 **12 个月** 的实付金额计算，权益包含：\n\n- 专属客服通道\n- 生日双倍积分\n- 每月免运费券\n\n积分有效期为获取后 **24 个月**，过期前 30 天会通过站内信提醒。',
      confidence: 90,
      durationMs: 420,
      citations: [
        {
          id: `${id}-member`,
          documentId: 'c3a8e6d2-5f47-4b91-9d08-1a6c3e7f2b95',
          knowledgeBaseId: 'kb_member',
          name: '会员等级权益对比表.md',
          description: '会员权益库 · 等级与权益',
          snippet: '会员等级按近 12 个月实付金额计算，不同等级对应不同服务权益',
          page: 2,
          score: 0.93,
        },
        {
          id: `${id}-points`,
          documentId: '8b4f7e21-c09d-4a6b-9e35-2d1a5c8b7f60',
          knowledgeBaseId: 'kb_member',
          name: '会员积分规则说明.docx',
          description: '会员权益库 · 积分有效期',
          snippet: '积分自获取之日起 24 个月内有效，过期前 30 天发送站内信提醒',
          page: 5,
          score: 0.88,
        },
      ],
      toolCalls: [
        {
          id: `${id}-search`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 2, topScore: 0.93 },
          durationMs: 420,
        },
      ],
      ticketCode: null,
    }
  }

  return {
    content:
      '## 退款处理建议\n\n已结合企业知识库检索到以下处理口径：\n\n1. 确认订单是否在签收后 **7 天** 内\n2. 核对商品状态与凭证是否齐全\n3. 在原订单详情提交退款申请并保留沟通记录\n\n退款通常按原支付路径退回，具体到账时间以支付渠道为准。',
    confidence: 92,
    durationMs: 1040,
    citations: [
      {
        id: `${id}-policy`,
        documentId: '9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71',
        knowledgeBaseId: 'kb_aftersale',
        name: '售后退款政策_v2.pdf',
        description: '售后政策库 · 更新于 2026-10-20',
        snippet: '符合本场景的用户，可在签收后 7 天内提交申请，审核通过后原路退回',
        page: 12,
        score: 0.92,
      },
      {
        id: `${id}-guide`,
        documentId: 'd5c92b18-6a4e-4f73-a0d9-3c7b1e8f4025',
        knowledgeBaseId: 'kb_aftersale',
        name: '退换货操作指引_v1.pdf',
        description: '售后政策库 · 操作路径与材料清单',
        snippet: '进入订单详情后选择售后申请，按页面提示上传商品照片与物流凭证',
        page: 3,
        score: 0.86,
      },
      {
        id: `${id}-legacy`,
        documentId: 'b4c1d7e9-2a58-4f63-9b07-8e3d1c5a2f84',
        knowledgeBaseId: 'kb_aftersale',
        name: '退款政策_v1_已废止.pdf',
        description: '售后政策库 · 历史版本',
        snippet: '旧版退款时效为签收后 15 天，已不再适用',
        page: 8,
        score: 0.72,
        unavailable: true,
      },
    ],
    toolCalls: [
      {
        id: `${id}-search`,
        name: 'search_knowledge',
        arguments: { query: title, top_k: 5 },
        status: 'success',
        result: { hits: 3, topScore: 0.92 },
        durationMs: 800,
      },
      {
        id: `${id}-order`,
        name: 'get_order',
        arguments: { orderNo: 'SO-20261103-0042' },
        status: 'success',
        result: {
          orderNo: 'SO-20261103-0042',
          status: '已签收',
          signedAt: '2026-11-01T15:20:00+08:00',
          receiver: '张先生',
          phone: '13800138000',
          address: '上海市浦东新区世纪大道 100 号 3 栋 1201 室',
        },
        durationMs: 240,
      },
    ],
    ticketCode: null,
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

  try {
    await streamSse(
      STREAM_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, answerId: answer.id }),
      },
      {
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
            case 'citation':
              upsertById(answer.citations, readEventData<Citation>(event))
              break
            case 'tool':
              upsertById(answer.toolCalls, readEventData<ToolCall>(event))
              break
            case 'error':
              // 服务端在流中途报错，抛出去走统一失败分支，已生成内容保留
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
              break
            }
            default:
              // 未知事件先忽略，方便后端先上线新事件、前端再逐步支持
              break
          }
        },
      },
      { signal: controller.signal },
    )

    // 服务端正常关闭连接，视为回答完成
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
