/** 会话摘要，用于左侧「最近对话」列表。 */
export interface ConversationSummary {
  /** 会话唯一标识，同时作为 `/chat/:conversationId` 的路由参数。 */
  id: string
  /** 会话标题，通常取首条提问截断后的文本。 */
  title: string
  /** 最后更新时间，格式为 `YYYY-MM-DD HH:mm`。 */
  updatedAt: string
}

/** 单条聊天消息。 */
export interface Message {
  /** 消息唯一标识。 */
  id: string
  /** 消息发送方：`user` 为用户，`agent` 为助手。 */
  role: 'user' | 'agent'
  /** 消息正文，助手消息按 Markdown 渲染。 */
  content: string
}

/** 一次工具调用或链路追踪步骤。 */
export interface ToolStep {
  /** 步骤唯一标识。 */
  id: string
  /** 工具名或链路节点名。 */
  name: string
  /** 执行耗时，展示用字符串。 */
  duration: string
  /** 步骤说明，追踪节点可为空。 */
  detail: string
}

/** 回答引用的知识来源。 */
export interface Citation {
  /** 引用唯一标识。 */
  id: string
  /** 来源文档名称。 */
  name: string
  /** 来源补充说明，例如命中片段或更新时间。 */
  description: string
}

/** 会话统计信息，用于观测面板展示。 */
export interface ConversationStats {
  /** 总耗时。 */
  duration: string
  /** 消耗的 Token 数。 */
  tokens: string
  /** 本次会话成本。 */
  cost: string
  /** 引用条数。 */
  citations: string
}

/** 会话详情，包含消息、工具调用、引用与质量指标。 */
export interface ConversationDetail {
  /** 会话摘要信息。 */
  summary: ConversationSummary
  /** 会话处理状态。 */
  status: 'completed' | 'processing'
  /** 回答置信度，草稿或未计算时为 `null`。 */
  confidence: number | null
  /** 关联工单号，没有时为 `null`。 */
  ticket: string | null
  /** 链路追踪标识。 */
  traceId: string
  /** 消息列表。 */
  messages: Message[]
  /** 工具调用步骤。 */
  toolSteps: ToolStep[]
  /** 引用来源列表。 */
  citations: Citation[]
  /** 会话统计信息。 */
  stats: ConversationStats
  /** 质量指标列表，用于右侧观测面板。 */
  qualityMetrics: {
    /** 指标名称。 */
    label: string
    /** 指标百分比，取值 0-100。 */
    percentage: number
    /** 进度条状态，不传时使用默认主色。 */
    status?: 'success' | 'warning'
  }[]
  /** 链路追踪步骤。 */
  traceSteps: ToolStep[]
}

/** 预置的会话摘要 mock 数据。 */
export const conversations: ConversationSummary[] = [
  {
    id: '9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71',
    title: '退款政策咨询 · A1024',
    updatedAt: '2026-11-03 20:18',
  },
  {
    id: '3a7d6b2e-9c14-4f58-8b6a-1e0d7c4f2b93',
    title: '发票开具流程',
    updatedAt: '2026-11-03 18:42',
  },
  {
    id: '6c1e8f3d-2a5b-4d7c-9e0f-8b4a6c2d1e57',
    title: '会员权益对比',
    updatedAt: '2026-11-02 16:27',
  },
  {
    id: 'c4b8e2a6-1f3d-4a9c-8b7e-5d0f2a6c9e13',
    title: '物流异常处理',
    updatedAt: '2026-11-02 10:05',
  },
  {
    id: '2e7a9c4b-6d1f-4b8e-a3c5-9f0d7b2e6a84',
    title: '客服话术更新',
    updatedAt: '2026-11-01 14:36',
  },
]

/** 默认会话 id，供演示或兜底跳转使用。 */
export const defaultConversationId = conversations[0]!.id
