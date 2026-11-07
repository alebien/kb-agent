import type { Document } from '@/domain'
import { documents } from '@/mock'

/** 模拟网络延迟，统一返回传入的值 */
function delay<T>(value: T, milliseconds = 260): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), milliseconds)
  })
}

/**
 * 获取知识库文档列表，按上传时间倒序返回，最新的文档排在前面
 * 默认过滤掉已软删除（deletedAt 有值）的文档，传 includeDeleted 为 true 时返回全部
 */
export async function fetchDocuments(includeDeleted = false): Promise<Document[]> {
  /** 需要展示的文档，默认排除软删除项，供文档库列表使用 */
  const visible = includeDeleted
    ? documents
    : documents.filter((document) => !document.deletedAt)

  /** 拷贝并按上传时间倒序排列的列表，避免调用方直接改动 mock 源数据 */
  const list = visible
    .map((document) => ({ ...document }))
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))

  return delay(list)
}
