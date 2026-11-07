/** 知识库启用状态，paused 表示暂停检索但保留文档 */
export type KnowledgeBaseStatus = 'active' | 'paused'

/** 知识库，文档的归属单位，对话检索时按业务域优先命中 */
export interface KnowledgeBase {
  /** 知识库唯一标识，文档通过 knowledgeBaseId 引用 */
  id: string
  /** 知识库名称，展示用，不保证唯一 */
  name: string
  /** 知识库说明，写清覆盖哪些业务问题 */
  description?: string
  /** 启用状态 */
  status: KnowledgeBaseStatus
  /** 归属文档数，不含已软删除的文档 */
  documentCount: number
  /** 文本块总数，仅统计解析成功的文档 */
  chunkCount: number
  /** 创建时间，ISO 8601 带时区字符串 */
  createdAt: string
  /** 最后更新时间，ISO 8601 带时区字符串 */
  updatedAt: string
}
