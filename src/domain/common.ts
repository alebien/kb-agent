/** 所有业务实体共享的基础字段 */
export interface BaseEntity {
  /** 实体唯一标识 */
  id: string
  /** 创建时间，ISO 8601 字符串 */
  createdAt: string
  /** 最后更新时间，ISO 8601 字符串 */
  updatedAt: string
}

/** 接口请求的统一分页参数 */
export interface PageQuery {
  /** 页码，从 1 开始 */
  page?: number
  /** 每页条数 */
  pageSize?: number
  /** 关键字搜索，按业务自行解释 */
  keyword?: string
}

/** 接口返回的分页结果 */
export interface PageResult<T> {
  /** 当前页数据 */
  items: T[]
  /** 满足条件的总条数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
}

/** 通用的异步任务状态 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled'
