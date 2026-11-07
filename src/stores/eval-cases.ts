import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchEvalCases } from '@/api/eval-cases'
import type { EvalCase } from '@/domain'

export const useEvalCaseStore = defineStore('eval-cases', () => {
  /** 评测用例列表 */
  const list = ref<EvalCase[]>([])
  /** 评测用例列表是否正在加载 */
  const isLoading = ref(false)
  /** 是否已经成功加载过一次，避免重复请求 */
  let hasLoaded = false

  /** 加载评测用例列表；`force` 为 true 时忽略已完成标记重新拉取 */
  async function load(force = false) {
    if (isLoading.value || (hasLoaded && !force)) {
      return
    }

    isLoading.value = true

    try {
      list.value = await fetchEvalCases()
      hasLoaded = true
    } catch {
      if (!hasLoaded) {
        list.value = []
      }
    } finally {
      isLoading.value = false
    }
  }

  return { list, isLoading, load }
})
