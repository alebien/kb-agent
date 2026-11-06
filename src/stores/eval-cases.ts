import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { EvalCase } from '@/domain'

export const useEvalCaseStore = defineStore('eval-cases', () => {
  /** 评测用例列表，待接入接口。 */
  const list = ref<EvalCase[]>([])
  /** 评测用例列表是否正在加载。 */
  const isLoading = ref(false)

  /** 加载评测用例列表，待实现。 */
  async function load() {
    isLoading.value = true
    try {
      list.value = []
    } finally {
      isLoading.value = false
    }
  }

  return { list, isLoading, load }
})
