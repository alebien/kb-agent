import type { Message } from './message'

/** 会话摘要，用于左侧「最近对话」列表 */
export interface ConversationSummary {
  /** 会话唯一标识，同时作为 `/chat/:conversationId` 的路由参数 */
  id: string
  /** 会话标题，通常取首条提问截断后的文本 */
  title: string
  /** 创建人用户 id，会话列表与详情都按它做数据隔离，创建后不可修改 */
  createdBy: string
  /** 会话创建时间，ISO 8601 带时区字符串，创建后不再变化 */
  createdAt: string
  /** 最后更新时间，ISO 8601 带时区字符串，展示时由 utils 格式化为 `YYYY-MM-DD HH:mm` */
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
  /** 回答置信度，0-100 的整数，草稿或未计算时为 `null`；低于 75 转人工，75-84 提示人工复核，85 以上直接输出 */
  confidence: number | null
  /** 意图识别置信度，0-1 的小数，与回答置信度不是同一指标；低于 0.6 时先追问澄清再检索 */
  intentConfidence?: number
  /** 关联工单号，没有时为 `null`；复用已有工单时即为原单号 */
  ticketCode: string | null
  /** 链路追踪标识 */
  traceId: string
  /**
   * 消息列表，工具调用和引用只挂在消息上
   * 原则：数据只存一份，需要不同视图时派生，不要复制
   */
  messages: Message[]
  /** 会话统计信息 */
  stats: ConversationStats
  /** 质量指标列表，用于右侧观测面板 */
  qualityMetrics: QualityMetric[]
  /** 链路追踪步骤 */
  traceSteps: TraceStep[]
}

/** 会话统计信息，用于观测面板展示 */
export interface ConversationStats {
  /** 总耗时， 单位毫秒 */
  duration: number
  /** 消耗的 Token 数 */
  tokens: number
  /** 本次会话成本 */
  cost: number
  /** 引用条数 */
  citations: number
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
  /** 执行耗时，单位毫秒，展示时再格式化为字符串 */
  duration: number
  /** 步骤说明，可为空 */
  detail?: string
}
