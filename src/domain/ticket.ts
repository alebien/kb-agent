import type { TaskStatus } from './common'

/** 工单领域类型，具体字段待补充。 */
export interface Ticket {
  /** 工单唯一标识。 */
  id: string
  /** 工单标题。 */
  title: string
  /** 工单状态。 */
  status: TaskStatus
  /** 创建时间，ISO 8601 字符串。 */
  createdAt: string
}
