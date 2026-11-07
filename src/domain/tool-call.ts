/** 工具名，新增工具时在这里补充字面量 */
export type ToolName = 'search_knowledge' | 'get_order' | 'create_ticket'

/** 工具调用失败时的结构化错误信息 */
export interface ToolCallError {
  /** 错误码 */
  code: string
  /** 错误信息 */
  message: string
  /** 错误详情 */
  detail?: string
}

/** 所有工具调用状态共有的字段 */
export interface ToolCallBase {
  /** 调用唯一标识 */
  id: string
  /** 工具名称 */
  name: ToolName
  /** 调用入参；具体结构由工具自身约定 */
  arguments: Record<string, unknown> // 左为新建对象类型的键，右为值
}

/** 等待执行的工具调用 */
export interface PendingToolCall extends ToolCallBase {
  /** 当前调用状态 */
  status: 'pending'
}

/** 正在执行的工具调用 */
export interface RunningToolCall extends ToolCallBase {
  /** 当前调用状态 */
  status: 'running'
  /** 开始执行时间 ISO 8601 字符串 */
  startAt: string
}

/** 执行成功的工具调用 */
export interface SucceededToolCall extends ToolCallBase {
  /** 当前调用状态 */
  status: 'success'
  /** 工具执行结果；具体结构由工具自身约定 */
  result: unknown
  /** 执行耗时，单位毫秒，便于排序、求和和统计 */
  durationMs: number
}

/** 执行失败的工具调用 */
export interface FailedToolCall extends ToolCallBase {
  /** 当前调用状态 */
  status: 'error'
  /** 失败原因 */
  error: ToolCallError
  /** 执行耗时，单位毫秒；开始执行前就失败时可以没有 */
  durationMs?: number
}

/**
 * 一次工具调用，按 status 区分不同阶段的数据结构
 *
 * 对 status 做类型收窄后，可以明确知道 result、error、durationMs
 * 等字段是否存在，避免使用非空断言
 */
export type ToolCall = PendingToolCall | RunningToolCall | SucceededToolCall | FailedToolCall

/**
 * 工具调用状态
 *
 * 从 ToolCall 派生，避免状态字面量在多个地方重复维护
 * 当前不支持取消工具调用，所以不包含 canceled
 */
export type ToolCallStatus = ToolCall['status']
