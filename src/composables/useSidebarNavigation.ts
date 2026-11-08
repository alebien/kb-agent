import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CONVERSATION_MENU_ACTIONS } from '@/components/layout/conversationMenu'
import type { ConversationSummary } from '@/domain'

/**
 * 侧边栏导航
 *
 * 统一维护菜单高亮、会话高亮与路由跳转，
 * 布局交互和会话操作只关心「点完之后做什么」
 */
export function useSidebarNavigation() {
  /** 当前路由信息 */
  const route = useRoute()
  /** 路由实例，用于菜单与会话跳转 */
  const router = useRouter()

  /** 当前高亮的菜单项，草稿页高亮「新对话」 */
  const activeMenu = computed(() => {
    if (route.name === 'chat-draft') {
      return 'new-chat'
    }

    return route.path
  })

  /** 当前打开的会话 id，用于最近对话列表高亮 */
  const activeConversationId = computed(() => {
    const id = route.params.conversationId
    return typeof id === 'string' ? id : ''
  })

  /** 最近对话的更多操作，MVP 单角色下重命名与删除均对会话创建人开放 */
  const conversationActions = CONVERSATION_MENU_ACTIONS

  /** 跳转到新对话草稿页 */
  async function goToNewChat() {
    await router.push({ name: 'chat-draft' })
  }

  /** 处理菜单选中，草稿页与普通路由分别跳转 */
  async function handleMenuSelect(index: string) {
    if (index === 'new-chat') {
      await goToNewChat()
      return
    }

    await router.push(index)
  }

  /** 打开指定会话 */
  async function openConversation(conversation: ConversationSummary) {
    await router.push(`/chat/${conversation.id}`)
  }

  return {
    activeMenu,
    activeConversationId,
    conversationActions,
    goToNewChat,
    handleMenuSelect,
    openConversation,
  }
}
