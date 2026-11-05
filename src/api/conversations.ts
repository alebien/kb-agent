import {
  conversations,
  defaultConversationId,
  type ConversationDetail,
  type ConversationSummary,
} from '@/data/conversations'

/** 会话详情缓存，key 为会话 id，避免重复构造 mock 数据。 */
const details = new Map<string, ConversationDetail>()

/** 模拟网络延迟，统一返回传入的值。 */
function delay<T>(value: T, milliseconds = 280): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), milliseconds)
  })
}

/** 按会话 id 构造并缓存一份会话详情。 */
function detail(id: string): ConversationDetail {
  /** 在预置列表中查找对应的会话摘要。 */
  const summary = conversations.find((conversation) => conversation.id === id)
  if (!summary) {
    throw new Error(`Conversation ${id} not found`)
  }

  if (details.has(id)) {
    return details.get(id)!
  }

  /** 首次访问时创建的会话详情。 */
  const created: ConversationDetail = {
    summary,
    status: 'completed',
    confidence: 92,
    ticket: '#T-2048',
    traceId: summary.id.slice(0, 6),
    messages: [
      {
        id: `${id}-user`,
        role: 'user',
        content: `我需要处理「${summary.title}」。`,
      },
      {
        id: `${id}-agent`,
        role: 'agent',
        content:
          '已根据企业知识库完成检索，并给出可执行结论。若涉及具体订单或工单，请在确认信息后转交人工跟进。',
      },
    ],
    toolSteps: [
      {
        id: `${id}-classify`,
        name: 'classify_intent',
        duration: '0.2s',
        detail: `识别业务场景：${summary.title}`,
      },
      {
        id: `${id}-search`,
        name: 'search_knowledge',
        duration: '0.8s',
        detail: '检索知识库 · top_k=5 · 命中 2 条',
      },
      {
        id: `${id}-answer`,
        name: 'compose_answer',
        duration: '0.4s',
        detail: '基于引用内容生成回复',
      },
    ],
    citations: [
      {
        id: `${id}-policy`,
        name: '企业服务政策 v3.2.pdf',
        description: `对应场景 · 更新于 ${summary.updatedAt.slice(0, 10)}`,
      },
      {
        id: `${id}-sla`,
        name: '客服处理 SLA.docx',
        description: '工单时效 · 更新于 2026-10-01',
      },
    ],
    stats: {
      duration: '1.4 s',
      tokens: '2,168',
      cost: '¥ 0.04',
      citations: '2 条',
    },
    qualityMetrics: [
      { label: '回答忠实度', percentage: 94 },
      { label: '检索命中率', percentage: 88, status: 'success' },
      { label: '工具成功率', percentage: 100, status: 'warning' },
    ],
    traceSteps: [
      { id: `${id}-trace-run`, name: 'agent.run', duration: '1.4s', detail: '' },
      { id: `${id}-trace-intent`, name: 'classify_intent', duration: '0.2s', detail: '' },
      { id: `${id}-trace-search`, name: 'search_knowledge', duration: '0.8s', detail: '' },
      { id: `${id}-trace-answer`, name: 'compose_answer', duration: '0.4s', detail: '' },
    ],
  }

  details.set(id, created)
  return created
}

/** 获取会话摘要列表，返回浅拷贝避免调用方直接修改 mock 数据。 */
export async function fetchConversationList(): Promise<ConversationSummary[]> {
  return delay(conversations.map((conversation) => ({ ...conversation })))
}

/** 获取会话详情，已缓存时直接返回，否则延迟模拟请求。 */
export async function fetchConversationDetail(id: string): Promise<ConversationDetail> {
  /** 命中的缓存详情。 */
  const cached = details.get(id)
  if (cached) {
    return cached
  }

  return delay(detail(id))
}

/** 创建新会话，生成 UUID 并写入 mock 数据。 */
export async function createConversation(initialMessage?: string): Promise<ConversationSummary> {
  /** 浏览器生成的会话唯一标识。 */
  const uuid = window.crypto.randomUUID()
  /** 去除首尾空白后的首条提问。 */
  const prompt = initialMessage?.trim() ?? ''
  /** 用于生成标题的单行文本。 */
  const titleSource = prompt.replace(/\s+/g, ' ')
  /** 当前时间，用于生成展示用创建时间。 */
  const now = new Date()
  /** 格式化后的创建时间。 */
  const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`
  /** 新会话的摘要信息。 */
  const summary: ConversationSummary = {
    id: uuid,
    title: titleSource
      ? titleSource.length > 24
        ? `${titleSource.slice(0, 24)}…`
        : titleSource
      : '新对话',
    updatedAt: createdAt,
  }

  /** 新会话的初始消息，没有提问时为空数组。 */
  const messages: ConversationDetail['messages'] = prompt
    ? [
        {
          id: `${uuid}-user`,
          role: 'user',
          content: prompt,
        },
        {
          id: `${uuid}-agent`,
          role: 'agent',
          content:
            '已收到你的问题，正在结合企业知识库进行检索。当前为演示环境，接入真实服务后将返回实际结果。',
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
    toolSteps: [],
    citations: [],
    stats: {
      duration: '-',
      tokens: '-',
      cost: '-',
      citations: '0 条',
    },
    qualityMetrics: [],
    traceSteps: [],
  })

  conversations.unshift(summary)
  return delay({ ...summary }, 160)
}

export { defaultConversationId }
