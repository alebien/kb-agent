import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Ticket } from '@/domain'

export const useTicketStore = defineStore('tickets', () => {
  /** 工单列表，待接入接口。 */
  const list = ref<Ticket[]>([])
  /** 工单列表是否正在加载。 */
  const isLoading = ref(false)

  /** 加载工单列表，待实现。 */
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
