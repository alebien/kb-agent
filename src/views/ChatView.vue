<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createConversation,
  deleteMessage,
  fetchConversationDetail,
  regenerateMessage,
  sendMessage,
  stopMessage,
} from '@/api/conversations'
import ChatComposer from '@/components/chat/ChatComposer.vue'
import ChatEmptyState from '@/components/chat/ChatEmptyState.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import type { AgentMessage, Conversation, UserMessage } from '@/domain'
import { useAuthStore } from '@/stores/auth'
import { useConversationStore } from '@/stores/conversations'

/** 当前路由信息，用于区分草稿页与会话页 */
const route = useRoute()
/** 路由实例，用于创建会话后的地址替换 */
const router = useRouter()
/** 会话列表 store，新建会话后同步侧边栏 */
const conversationStore = useConversationStore()
/** 登录状态 store，游客提交提问时先弹出登录框 */
const authStore = useAuthStore()

/** 会话详情是否正在加载 */
const isLoading = ref(true)
/** 会话加载失败时的提示文案，空字符串表示无错误 */
const loadError = ref('')
/** 当前展示的会话详情 */
const currentDetail = ref<Conversation | null>(null)
/** 已加载的会话 id，用于避免重复请求同一会话 */
const activeConversationId = ref('')
/** 正在创建并准备跳转的会话 id，用于跳过路由切换后的重复加载 */
let pendingConversationId = ''
/** 输入框草稿内容 */
const draft = ref('')
/** 是否正在创建新会话，防止重复提交 */
const isCreating = ref(false)
/** 当前是否正在生成回答，控制停止按钮与输入状态 */
const isStreaming = ref(false)
/** 当前正在生成的助手消息 id，用于停止 */
const activeAnswerId = ref('')
/** 加载请求序号，用于丢弃过期请求的结果 */
let loadRequestId = 0
/** 输入框组件实例，用于发送后恢复焦点 */
const composerRef = ref<InstanceType<typeof ChatComposer>>()

/** 当前是否处于「新对话」草稿页 */
const isDraft = computed(() => route.name === 'chat-draft')
/** 当前路由中的会话 id */
const conversationId = computed(() => route.params.conversationId as string | undefined)
/** 当前会话是否已有消息 */
const hasMessages = computed(() => (currentDetail.value?.messages.length ?? 0) > 0)
/** 输入框是否位于页面中部：草稿页和没有消息的会话使用居中布局 */
const isComposerCentered = computed(
  () => isDraft.value || (currentDetail.value !== null && !hasMessages.value),
)
/** 输入框是否禁用：加载会话、创建会话或加载失败时不可输入 */
const isComposerDisabled = computed(() => isLoading.value || isCreating.value || !!loadError.value)

/** 按 id 加载会话详情，并通过请求序号避免竞态覆盖 */
async function loadConversation(id: string) {
  if (!id || activeConversationId.value === id) {
    return
  }

  // 新会话创建后已写入详情，路由切换时复用同一对象，避免清空正在流式更新的消息
  if (pendingConversationId === id && currentDetail.value) {
    activeConversationId.value = id
    pendingConversationId = ''
    return
  }

  activeConversationId.value = id
  /** 本次加载请求的序号 */
  const requestId = ++loadRequestId
  currentDetail.value = null
  isLoading.value = true
  loadError.value = ''
  isStreaming.value = false
  activeAnswerId.value = ''

  try {
    /** 接口返回的会话详情 */
    const detail = await fetchConversationDetail(id)

    if (requestId !== loadRequestId) {
      return
    }

    currentDetail.value = detail
  } catch {
    if (requestId !== loadRequestId) {
      return
    }

    currentDetail.value = null
    loadError.value = '会话不存在或无权访问，请从左侧选择自己的会话'
  } finally {
    if (requestId === loadRequestId) {
      isLoading.value = false
    }
  }
}

/** 把接口返回的最新消息快照写回页面，触发响应式渲染 */
function syncMessages(messages: Conversation['messages'], conversationId?: string) {
  if (
    currentDetail.value &&
    (!conversationId || currentDetail.value.summary.id === conversationId)
  ) {
    currentDetail.value.messages = messages
  }
}

/** 向当前会话发送提问，并流式追加助手回答 */
async function sendCurrentMessage(content: string, reuseUserMessageId?: string) {
  /** 当前会话，草稿页还没有会话 */
  const conversation = currentDetail.value
  if (!conversation || isStreaming.value) {
    return
  }

  isStreaming.value = true
  draft.value = ''

  try {
    /** 发送接口返回的会话摘要与助手消息 id */
    const result = await sendMessage(
      conversation.summary.id,
      content,
      {
        onStart: (answerId) => {
          activeAnswerId.value = answerId
        },
        onChunk: () => undefined,
        onUpdate: (messages) => syncMessages(messages, conversation.summary.id),
        onDone: () => {
          isStreaming.value = false
          activeAnswerId.value = ''
          composerRef.value?.focus()
        },
        onStopped: () => {
          isStreaming.value = false
          activeAnswerId.value = ''
          ElMessage.info('已停止生成')
          composerRef.value?.focus()
        },
        onError: () => {
          isStreaming.value = false
          activeAnswerId.value = ''
          ElMessage.error('回答生成失败，请重试')
          composerRef.value?.focus()
        },
      },
      reuseUserMessageId ? { reuseUserMessageId } : undefined,
    )

    conversationStore.updateTime(result.summary.id, result.summary.updatedAt)
  } catch (error) {
    isStreaming.value = false
    activeAnswerId.value = ''
    /** 接口返回的错误信息 */
    const message = error instanceof Error ? error.message : '发送失败，请稍后重试'
    ElMessage.error(message)
  }
}

/** 提交输入内容：草稿页先创建会话，已有会话直接发送 */
async function handleSubmit(content: string) {
  if (isCreating.value || isStreaming.value) {
    return
  }

  /** 去除首尾空白后的提问内容 */
  const message = content.trim()
  if (!message) {
    return
  }

  // 草稿页对游客开放，提交动作才要求登录，登录成功后保留输入内容
  if (!authStore.isLoggedIn) {
    authStore.openLoginDialog()
    ElMessage.info('登录后即可发送消息')
    return
  }

  if (!isDraft.value && currentDetail.value) {
    await sendCurrentMessage(message)
    return
  }

  isCreating.value = true

  try {
    /** 新建的会话摘要 */
    const created = await createConversation(message)
    conversationStore.add(created.summary)
    draft.value = ''
    activeConversationId.value = created.summary.id
    pendingConversationId = created.summary.id
    currentDetail.value = created.detail
    isLoading.value = false
    await router.replace(`/chat/${created.summary.id}`)

    // 创建阶段结束后先解除禁用，流式开始时停止按钮才能正常切换
    isCreating.value = false
    /** 创建会话时已写入的首条用户消息，发送时复用避免重复 */
    const firstUserMessage = created.detail.messages.find((item) => item.role === 'user')
    await sendCurrentMessage(message, firstUserMessage?.id)
  } catch (error) {
    /** 创建失败时的错误信息 */
    const errorMessage = error instanceof Error ? error.message : '创建对话失败，请稍后重试'
    ElMessage.error(errorMessage)
  } finally {
    isCreating.value = false
  }
}

/** 停止当前正在生成的回答 */
async function handleStop() {
  /** 当前会话 */
  const conversation = currentDetail.value
  /** 当前正在生成的消息 id */
  const answerId = activeAnswerId.value
  if (!conversation || !answerId) {
    return
  }

  try {
    await stopMessage(conversation.summary.id, answerId)
  } catch {
    ElMessage.error('停止失败，请稍后重试')
  }
}

/** 重新生成指定助手回答 */
async function handleRetry(message: AgentMessage) {
  /** 当前会话 */
  const conversation = currentDetail.value
  if (!conversation || isStreaming.value) {
    return
  }

  isStreaming.value = true
  activeAnswerId.value = message.id

  try {
    await regenerateMessage(conversation.summary.id, message.id, {
      onStart: (answerId) => {
        activeAnswerId.value = answerId
      },
      onChunk: () => undefined,
      onUpdate: (messages) => syncMessages(messages, conversation.summary.id),
      onDone: () => {
        isStreaming.value = false
        activeAnswerId.value = ''
        composerRef.value?.focus()
      },
      onStopped: () => {
        isStreaming.value = false
        activeAnswerId.value = ''
        ElMessage.info('已停止生成')
        composerRef.value?.focus()
      },
      onError: () => {
        isStreaming.value = false
        activeAnswerId.value = ''
        ElMessage.error('重新生成失败，请稍后重试')
        composerRef.value?.focus()
      },
    })
  } catch {
    isStreaming.value = false
    activeAnswerId.value = ''
    ElMessage.error('重新生成失败，请稍后重试')
  }
}

/** 删除消息，二次确认后从 mock 中移除 */
async function handleDeleteMessage(message: UserMessage | AgentMessage) {
  /** 当前会话 */
  const conversation = currentDetail.value
  if (!conversation || isStreaming.value) {
    return
  }

  try {
    await ElMessageBox.confirm('删除后无法恢复，确定继续吗？', '删除消息', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }

  try {
    /** 删除后剩余的完整消息列表 */
    const messages = await deleteMessage(conversation.summary.id, message.id)
    if (currentDetail.value) {
      currentDetail.value.messages = messages
    }
    ElMessage.success('已删除消息')
  } catch {
    ElMessage.error('删除消息失败，请稍后重试')
  }
}

watch(
  () => route.fullPath,
  () => {
    draft.value = ''

    if (isDraft.value) {
      loadRequestId += 1
      activeConversationId.value = ''
      currentDetail.value = null
      loadError.value = ''
      isLoading.value = false
      isStreaming.value = false
      activeAnswerId.value = ''
      return
    }

    if (conversationId.value) {
      void loadConversation(conversationId.value)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="chat-layout page-container">
    <section class="chat-main page-surface">
      <div class="chat-stage" :class="{ 'is-composer-centered': isComposerCentered }">
        <div
          v-loading="isLoading"
          class="chat-stage__top"
          element-loading-text="加载会话中..."
          element-loading-background="var(--el-bg-color)"
        >
          <el-result
            v-if="loadError"
            icon="warning"
            :title="loadError"
            sub-title="请从左侧选择有效会话"
          />

          <ChatMessageList
            v-else-if="currentDetail && hasMessages"
            :messages="currentDetail.messages"
            @retry="handleRetry"
            @stop="handleStop"
            @delete="handleDeleteMessage"
          />

          <ChatEmptyState v-else-if="isDraft || currentDetail" />
        </div>

        <div v-if="!loadError" class="chat-stage__composer">
          <ChatComposer
            ref="composerRef"
            v-model="draft"
            :streaming="isStreaming"
            :disabled="isComposerDisabled"
            @submit="handleSubmit"
            @stop="handleStop"
          />
        </div>

        <div class="chat-stage__bottom" aria-hidden="true"></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.chat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.chat-main {
  min-height: 0;
  overflow: hidden;
}

.chat-stage {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.chat-stage__top {
  position: relative;
  display: flex;
  flex: 1 1 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.chat-stage.is-composer-centered .chat-stage__top {
  justify-content: flex-end;
}

.chat-stage.is-composer-centered .chat-stage__top :deep(.chat-empty) {
  margin: 0 auto;
  padding-inline: var(--app-chat-inline-padding);
}

.chat-stage__top :deep(.el-loading-mask) {
  border-radius: inherit;
}

.chat-stage__composer {
  width: min(100%, calc(var(--app-chat-max-width) + var(--app-chat-inline-padding) * 2));
  margin: 0 auto;
  flex: none;
  padding: 8px var(--app-chat-inline-padding) 20px;
}

.chat-stage__bottom {
  flex: 0 1 0;
  min-height: 0;
  transition: flex-grow 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.chat-stage.is-composer-centered .chat-stage__bottom {
  flex-grow: 1;
}

@media (prefers-reduced-motion: reduce) {
  .chat-stage__bottom {
    transition: none;
  }
}

@media (max-width: 900px) {
  .chat-stage__composer {
    padding: 8px var(--app-chat-inline-padding) 14px;
  }
}

@media (max-width: 640px) {
  .chat-stage__composer {
    padding: 8px var(--app-chat-inline-padding) calc(12px + env(safe-area-inset-bottom));
  }
}
</style>
