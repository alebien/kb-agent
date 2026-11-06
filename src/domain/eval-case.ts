/** 评测用例状态。 */
export type EvalCaseStatus = 'draft' | 'running' | 'passed' | 'failed'

/** 一条评测用例。 */
export interface EvalCase {
  /** 用例唯一标识。 */
  id: string
  /** 用例名称。 */
  name: string
  /** 测试问题或输入。 */
  input: string
  /** 期望的答案或行为。 */
  expected: string
  /** 最近一次实际输出。 */
  actual?: string
  /** 用例状态。 */
  status: EvalCaseStatus
  /** 得分，取值 0-100。 */
  score?: number
  /** 所属评测集。 */
  dataset?: string
  /** 标签，便于筛选。 */
  tags?: string[]
  /** 最后运行时间，ISO 8601 字符串。 */
  lastRunAt?: string
}
