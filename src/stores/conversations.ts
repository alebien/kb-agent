import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchConversationList } from '@/api/conversations'
import type { ConversationSummary } from '@/data/conversations'

export const useConversationStore = defineStore('conversations', () => {
  const list = ref<ConversationSummary[]>([])
  const isLoading = ref(false)
  let hasLoaded = false

  async function load(force = false) {
    if (isLoading.value || (hasLoaded && !force)) {
      return
    }

    isLoading.value = true

    try {
      list.value = await fetchConversationList()
      hasLoaded = true
    } catch {
      if (!hasLoaded) {
        list.value = []
      }
    } finally {
      isLoading.value = false
    }
  }

  function add(summary: ConversationSummary) {
    list.value = [summary, ...list.value.filter((item) => item.id !== summary.id)]
  }

  return { list, isLoading, load, add }
})
