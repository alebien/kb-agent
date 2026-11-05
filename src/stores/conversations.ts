import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchConversationList } from '@/api/conversations'
import type { ConversationSummary } from '@/data/conversations'

export const useConversationStore = defineStore('conversations', () => {
  /** 左侧「最近对话」使用的会话摘要列表。 */
  const list = ref<ConversationSummary[]>([])
  /** 会话列表是否正在加载。 */
  const isLoading = ref(false)
  /** 是否已经成功加载过一次，避免重复请求。 */
  let hasLoaded = false

  /** 加载会话列表；`force` 为 true 时忽略已完成标记重新拉取。 */
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

  /** 将新会话插入列表顶部，并按 id 去重。 */
  function add(summary: ConversationSummary) {
    list.value = [summary, ...list.value.filter((item) => item.id !== summary.id)]
  }

  return { list, isLoading, load, add }
})
