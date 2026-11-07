import type { EvalCase } from '@/domain'
import { evalCases } from '@/mock'

/** 模拟网络延迟，统一返回传入的值 */
function delay<T>(value: T, milliseconds = 300): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), milliseconds)
  })
}

/** 获取评测用例列表，保持 mock 内按评测集分组的顺序 */
export async function fetchEvalCases(): Promise<EvalCase[]> {
  /** 拷贝后的用例列表，tags 单独复制一份，避免调用方改动影响 mock 源数据 */
  const list = evalCases.map((item) => ({
    ...item,
    ...(item.tags ? { tags: [...item.tags] } : {}),
  }))

  return delay(list)
}
