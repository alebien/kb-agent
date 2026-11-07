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
  /** 件大小，单位字节，展示时再格式化为字符串 */
  sizeBytes: number
  /** 解析状态 */
  status: DocumentStatus
  /** 文档所属知识库 */
  knowledgeBase?: string
  /** 上传人名称 */
  uploadedBy: string
  /** 上传时间，ISO 8601 字符串 */
  uploadedAt: string
  /** 解析出的文本块数量 */
  chunkCount?: number
  /** 解析失败时的错误说明 */
  error?: string
}
