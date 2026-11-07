/** 回答引用的知识来源 */
export interface Citation {
  /** 引用唯一标识 */
  id: string
  /** 来源文档 id，可跳转到文档详情 */
  documentId?: string
  /** 来源文档名称 */
  name: string
  /** 来源补充说明；没有时不传 */
  description?: string
  /** 命中的原文片段 */
  snippet?: string
  /** 片段在文档中的页码，未知时不传 */
  page?: number
  /** 检索相似度分数，取值 0-1 */
  score?: number
}
