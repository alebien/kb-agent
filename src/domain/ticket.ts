/** 独立工单状态 */
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

/** 工单优先级，urgent 最高 */
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

/** 工单分类，对应知识库的业务域 */
export type TicketCategory = 'refund' | 'invoice' | 'membership' | 'logistics' | 'other'

/** SLA 履约状态，由接口按当前时间与截止时间计算，前端不自行推导 */
export type TicketSlaStatus = 'on_track' | 'at_risk' | 'breached'

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
  /** 创建时间，ISO 8601 带时区字符串 */
  createdAt: string
  /** 最后更新时间，ISO 8601 带时区字符串 */
  updatedAt: string
  /** 首次响应截止时间，由优先级决定，ISO 8601 带时区字符串 */
  firstResponseDueAt?: string
  /** 首次响应时间，实际首次被处理人接手的时间，ISO 8601 带时区字符串 */
  firstRespondedAt?: string
  /** 解决截止时间，由优先级与创建时间决定，ISO 8601 带时区字符串 */
  resolveDueAt?: string
  /** SLA 履约状态，取值见 TicketSlaStatus */
  slaStatus?: TicketSlaStatus
  /** 结单时间，进入 resolved 或 closed 状态时写入，ISO 8601 带时区字符串 */
  resolvedAt?: string
  /** 关闭时间，仅 closed 状态有值，与 resolvedAt 区分：一个是解决、一个是终态关闭 */
  closedAt?: string
  /** 关闭原因，仅 closed 状态有值；撤回误建工单时必填 */
  closedReason?: string
  /** 重开原因，reopen 时必填，写清为何 resolved 后又打开 */
  reopenReason?: string
  /** 重开次数，resolved 被重新打开时累加，用于识别反复工单 */
  reopenedCount?: number
  /** 复用来源工单 id，本次建单因同会话已有未结工单而复用时填写 */
  reusedFromTicketId?: string
}
