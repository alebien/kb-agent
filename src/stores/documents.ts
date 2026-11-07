import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Document } from '@/domain'

export const useDocumentStore = defineStore('documents', () => {
  /** 文档列表，待接入接口 */
  const list = ref<Document[]>([])
  /** 文档列表是否正在加载 */
  const isLoading = ref(false)

  /** 加载文档列表，待实现 */
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
