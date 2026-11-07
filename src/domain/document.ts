/** 知识库文档处理状态 */
export type DocumentStatus = 'pending' | 'parsing' | 'ready' | 'failed'

/** 支持的文档类型 */
export type DocumentType = 'pdf' | 'docx' | 'doc' | 'txt' | 'md'

/** 知识库文档 */
export interface Document {
  /** 文档唯一标识 */
  id: string
  /** 文档名称 */
  name: string
  /** 文件类型 */
  type: DocumentType
  /** 文件大小，单位字节，展示时再格式化为字符串 */
  sizeBytes: number
  /** 解析状态 */
  status: DocumentStatus
  /** 所属知识库 id，对应 KnowledgeBase.id；未归属任何知识库时省略 */
  knowledgeBaseId?: string
  /** 上传人名称 */
  uploadedBy: string
  /** 上传时间，ISO 8601 带时区字符串 */
  uploadedAt: string
  /** 解析出的文本块数量，仅 ready 状态有值 */
  chunkCount?: number
  /** 解析失败时的错误说明，仅 failed 状态有值 */
  error?: string
  /** 软删除时间，ISO 8601 带时区字符串；有值表示已删除，7 天后物理清理 */
  deletedAt?: string
}
