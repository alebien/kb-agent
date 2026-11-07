import type { KnowledgeBase } from '@/domain'
import { knowledgeBases } from '@/mock'

/** 模拟网络延迟，统一返回传入的值 */
function delay<T>(value: T, milliseconds = 220): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), milliseconds)
  })
}

/** 获取知识库列表，按更新时间倒序，供文档库筛选与对话页展示可用库数量 */
export async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
  /** 拷贝并按更新时间倒序排列的列表，避免调用方改动 mock 源数据 */
  const list = knowledgeBases
    .map((item) => ({ ...item }))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

  return delay(list)
}
