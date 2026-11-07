/** 独立工单状态 */
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

/** 工单优先级，urgent 最高 */
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

/** 工单分类，对应知识库的业务域 */
export type TicketCategory = 'refund' | 'invoice' | 'membership' | 'logistics' | 'other'

/** 工单领域类型 */
export interface Ticket {
  /** 工单唯一标识，UUID 风格字符串 */
  id: string
  /** 工单号，对外展示的业务编号，如 A1024，会话侧通过它关联工单 */
  code: string
  /** 工单标题 */
  title: string
  /** 工单分类 */
  category: TicketCategory
  /** 工单状态 */
  status: TicketStatus
  /** 工单优先级 */
  priority: TicketPriority
  /** 工单描述，写清用户诉求与已尝试的处理 */
  description: string
  /** 创建人 id，mock 阶段使用 u_ 前缀的固定值 */
  createdBy: string
  /** 当前处理人名称，未分配时省略该字段 */
  assignee?: string
  /** 关联会话 id，取自 mock 会话摘要，无关联时省略该字段 */
  relatedConversationId?: string
  /** 标签，便于按业务关键词筛选 */
  tags?: string[]
  /** 创建时间，ISO 8601 字符串 */
  createdAt: string
  /** 最后更新时间，ISO 8601 字符串 */
  updatedAt: string
  /** 结单时间，仅 resolved 与 closed 状态有值 */
  resolvedAt?: string
}
