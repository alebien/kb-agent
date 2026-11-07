/** 独立工单状态 */
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

/** 工单领域类型，具体字段待补充 */
export interface Ticket {
  /** 工单唯一标识 */
  id: string
  /** 工单标题 */
  title: string
  /** 工单状态 */
  status: TicketStatus
  /** 工单优先级 */
  priority: 'low' | 'medium' | 'high' | 'urgent'
  /** 工单描述 */
  description: string
  /** 创建人 id */
  createdBy: string
  /** 创建时间，ISO 8601 字符串 */
  createdAt: string
  /** 最后更新时间，ISO 8601 字符串 */
  updatedAt: string
}
