import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchTickets } from '@/api/tickets'
import type { Ticket } from '@/domain'

export const useTicketStore = defineStore('tickets', () => {
  /** 工单列表 */
  const list = ref<Ticket[]>([])
  /** 工单列表是否正在加载 */
  const isLoading = ref(false)
  /** 是否已经成功加载过一次，避免重复请求 */
  let hasLoaded = false

  /** 加载工单列表；`force` 为 true 时忽略已完成标记重新拉取 */
  async function load(force = false) {
    if (isLoading.value || (hasLoaded && !force)) {
      return
    }

    isLoading.value = true

    try {
      list.value = await fetchTickets()
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
