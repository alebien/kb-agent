import type { TaskStatus } from './common'

/** 一次工具调用的记录 */
export interface ToolCall {
  /** 调用唯一标识 */
  id: string
  /** 工具名称，例如 `search_knowledge` */
  name: string
  /** 调用状态 */
  status: TaskStatus
  /** 调用入参，结构由具体工具决定 */
  arguments: Record<string, unknown>
  /** 调用返回结果，执行中可为空 */
  result?: unknown
  /** 执行耗时，展示用字符串 */
  duration: string
  /** 步骤说明，可为空 */
  detail: string
}
