import type { Document } from '@/domain'
import { documents } from '@/mock'

/** 模拟网络延迟，统一返回传入的值 */
function delay<T>(value: T, milliseconds = 260): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), milliseconds)
  })
}

/** 获取知识库文档列表，按上传时间倒序返回，最新的文档排在前面 */
export async function fetchDocuments(): Promise<Document[]> {
  /** 拷贝并按上传时间倒序排列的列表，避免调用方直接改动 mock 源数据 */
  const list = documents
    .map((document) => ({ ...document }))
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))

  return delay(list)
}
