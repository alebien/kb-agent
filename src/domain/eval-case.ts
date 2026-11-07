/** 评测用例状态 */
export type EvalCaseStatus = 'draft' | 'running' | 'passed' | 'failed'

/** 一条评测用例 */
export interface EvalCase {
  /** 用例唯一标识 */
  id: string
  /** 用例名称 */
  name: string
  /** 测试问题或输入 */
  input: string
  /** 期望的答案或行为 */
  expected: string
  /** 最近一次实际输出 */
  actual?: string
  /** 用例状态 */
  status: EvalCaseStatus
  /** 得分，取值 0-100 */
  score?: number
  /** 所属评测集 */
  dataset?: string
  /** 标签，便于筛选 */
  tags?: string[]
  /** 最后运行时间，ISO 8601 带时区字符串 */
  lastRunAt?: string
  /** 是否已沉淀为 Bad case，由人工确认后置为 true，不随状态自动变化 */
  isBadCase?: boolean
  /** 沉淀时间，ISO 8601 带时区字符串，仅 isBadCase 为 true 时有值 */
  sunkAt?: string
  /** Bad case 备注，写清错因与改进方向，仅 isBadCase 为 true 时有值 */
  badCaseNote?: string
}
