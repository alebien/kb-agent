import type { Conversation, ConversationSummary } from '@/domain'
import { conversations, defaultConversationId } from '@/mock/conversations'

/** 会话详情缓存，key 为会话 id，避免重复构造 mock 数据 */
const details = new Map<string, Conversation>()

/** 模拟网络延迟，统一返回传入的值 */
function delay<T>(value: T, milliseconds = 280): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), milliseconds)
  })
}

/** 按会话 id 构造并缓存一份会话详情 */
function detail(id: string): Conversation {
  /** 在预置列表中查找对应的会话摘要 */
  const summary = conversations.find((conversation) => conversation.id === id)
  if (!summary) {
    throw new Error(`Conversation ${id} not found`)
  }

  if (details.has(id)) {
    return details.get(id)!
  }

  /** mock 消息的创建时间，使用会话更新时间保持稳定 */
  const createdAt = `${summary.updatedAt.replace(' ', 'T')}:00`

  /** 首次访问时创建的会话详情 */
  const created: Conversation = {
    summary,
    status: 'completed',
    confidence: 92,
    ticket: '#T-2048',
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
            description: `对应场景 · 更新于 ${summary.updatedAt.slice(0, 10)}`,
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
  return delay(conversations.map((conversation) => ({ ...conversation })))
}

/** 获取会话详情，已缓存时直接返回，否则延迟模拟请求 */
export async function fetchConversationDetail(id: string): Promise<Conversation> {
  /** 命中的缓存详情 */
  const cached = details.get(id)
  if (cached) {
    return cached
  }

  return delay(detail(id))
}

/** 创建新会话，生成 UUID 并写入 mock 数据 */
export async function createConversation(initialMessage?: string): Promise<ConversationSummary> {
  /** 浏览器生成的会话唯一标识 */
  const uuid = window.crypto.randomUUID()
  /** 去除首尾空白后的首条提问 */
  const prompt = initialMessage?.trim() ?? ''
  /** 用于生成标题的单行文本 */
  const titleSource = prompt.replace(/\s+/g, ' ')
  /** 当前时间，用于生成展示用创建时间 */
  const now = new Date()
  /** 格式化后的创建时间 */
  const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`
  /** 新会话的摘要信息 */
  const summary: ConversationSummary = {
    id: uuid,
    title: titleSource
      ? titleSource.length > 24
        ? `${titleSource.slice(0, 24)}…`
        : titleSource
      : '新对话',
    updatedAt: createdAt,
  }

  /** mock 消息使用的 ISO 时间 */
  const messageCreatedAt = now.toISOString()

  /** 新会话的初始消息，没有提问时为空数组 */
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
        {
          id: `${uuid}-agent`,
          conversationId: uuid,
          role: 'agent',
          content:
            '已收到你的问题，正在结合企业知识库进行检索。当前为演示环境，接入真实服务后将返回实际结果。',
          status: 'completed',
          createdAt: messageCreatedAt,
          citations: [],
          toolCalls: [],
        },
      ]
    : []

  details.set(uuid, {
    summary,
    status: 'completed',
    confidence: null,
    ticket: null,
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
  })

  conversations.unshift(summary)
  return delay({ ...summary }, 160)
}

/** 删除一个会话，同时清理对应的详情缓存 */
export async function deleteConversation(id: string): Promise<void> {
  /** 待删除会话在 mock 列表中的下标 */
  const index = conversations.findIndex((conversation) => conversation.id === id)
  if (index === -1) {
    throw new Error(`Conversation ${id} not found`)
  }

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
    throw new Error(`Conversation ${id} not found`)
  }

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
