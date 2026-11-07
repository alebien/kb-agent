import type { Citation } from './citation'
import type { Message } from './message'
import type { ToolCall } from './tool-call'

/** 会话摘要，用于左侧「最近对话」列表 */
export interface ConversationSummary {
  /** 会话唯一标识，同时作为 `/chat/:conversationId` 的路由参数 */
  id: string
  /** 会话标题，通常取首条提问截断后的文本 */
  title: string
  /** 最后更新时间，展示格式为 `YYYY-MM-DD HH:mm` */
  updatedAt: string
}

/** 会话处理状态 */
export type ConversationStatus = 'idle' | 'processing' | 'completed' | 'failed'

/** 会话详情，包含消息、工具调用、引用与质量指标 */
export interface Conversation {
  /** 会话摘要信息 */
  summary: ConversationSummary
  /** 会话处理状态 */
  status: ConversationStatus
  /** 回答置信度，草稿或未计算时为 `null` */
  confidence: number | null
  /** 关联工单号，没有时为 `null` */
  ticket: string | null
  /** 链路追踪标识 */
  traceId: string
  /** 消息列表 */
  messages: Message[]
  /** 工具调用步骤 */
  toolCalls: ToolCall[]
  /** 引用来源列表 */
  citations: Citation[]
  /** 会话统计信息 */
  stats: ConversationStats
  /** 质量指标列表，用于右侧观测面板 */
  qualityMetrics: QualityMetric[]
  /** 链路追踪步骤 */
  traceSteps: TraceStep[]
}

/** 会话统计信息，用于观测面板展示 */
export interface ConversationStats {
  /** 总耗时 */
  duration: string
  /** 消耗的 Token 数 */
  tokens: string
  /** 本次会话成本 */
  cost: string
  /** 引用条数 */
  citations: string
}

/** 会话质量指标 */
export interface QualityMetric {
  /** 指标名称 */
  label: string
  /** 指标百分比，取值 0-100 */
  percentage: number
  /** 进度条状态，不传时使用默认主色 */
  status?: 'success' | 'warning'
}

/** 链路追踪步骤 */
export interface TraceStep {
  /** 步骤唯一标识 */
  id: string
  /** 链路节点名 */
  name: string
  /** 执行耗时，展示用字符串 */
  duration: string
  /** 步骤说明，可为空 */
  detail: string
}
