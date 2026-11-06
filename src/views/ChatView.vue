<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createConversation, fetchConversationDetail } from '@/api/conversations'
import ChatComposer from '@/components/chat/ChatComposer.vue'
import ChatEmptyState from '@/components/chat/ChatEmptyState.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
// import ConversationInsightPanel from '@/components/chat/ConversationInsightPanel.vue'
import type { Conversation } from '@/domain'
import { useConversationStore } from '@/stores/conversations'

/** 当前路由信息，用于区分草稿页与会话页。 */
const route = useRoute()
/** 路由实例，用于创建会话后的地址替换。 */
const router = useRouter()
/** 会话列表 store，新建会话后同步侧边栏。 */
const conversationStore = useConversationStore()

/** 会话详情是否正在加载。 */
const isLoading = ref(true)
/** 会话加载失败时的提示文案，空字符串表示无错误。 */
const loadError = ref('')
/** 当前展示的会话详情。 */
const currentDetail = ref<Conversation | null>(null)
/** 已加载的会话 id，用于避免重复请求同一会话。 */
const activeConversationId = ref('')
/** 输入框草稿内容。 */
const draft = ref('')
/** 是否正在创建新会话，防止重复提交。 */
const isCreating = ref(false)
/** 加载请求序号，用于丢弃过期请求的结果。 */
let loadRequestId = 0

/** 当前是否处于「新对话」草稿页。 */
const isDraft = computed(() => route.name === 'chat-draft')
/** 当前路由中的会话 id。 */
const conversationId = computed(() => route.params.conversationId as string | undefined)
/** 当前会话是否已有消息。 */
const hasMessages = computed(() => (currentDetail.value?.messages.length ?? 0) > 0)
/** 输入框是否位于页面中部：草稿页和没有消息的会话使用居中布局。 */
const isComposerCentered = computed(
  () => isDraft.value || (currentDetail.value !== null && !hasMessages.value),
)

/** 按 id 加载会话详情，并通过请求序号避免竞态覆盖。 */
async function loadConversation(id: string) {
  if (!id || activeConversationId.value === id) {
    return
  }

  activeConversationId.value = id
  /** 本次加载请求的序号。 */
  const requestId = ++loadRequestId
  currentDetail.value = null
  isLoading.value = true
  loadError.value = ''

  try {
    /** 接口返回的会话详情。 */
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
    loadError.value = '会话不存在或已被删除'
  } finally {
    if (requestId === loadRequestId) {
      isLoading.value = false
    }
  }
}

/** 提交草稿页的首条提问：创建会话并跳转到真实会话路由。 */
async function handleDraftSubmit(content: string) {
  if (!isDraft.value || isCreating.value) {
    return
  }

  /** 去除首尾空白后的提问内容。 */
  const message = content.trim()
  if (!message) {
    return
  }

  isCreating.value = true

  try {
    /** 新建的会话摘要。 */
    const conversation = await createConversation(message)
    conversationStore.add(conversation)
    draft.value = ''
    await router.replace(`/chat/${conversation.id}`)
  } catch {
    ElMessage.error('创建对话失败，请稍后重试')
  } finally {
    isCreating.value = false
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
  <div class="chat-layout page-container" :class="{ 'has-insight': hasMessages }">
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
            :citations="currentDetail.citations"
          />

          <ChatEmptyState v-else-if="isDraft || currentDetail" />
        </div>

        <div v-if="!loadError" class="chat-stage__composer">
          <ChatComposer
            v-model="draft"
            :loading="isCreating || isLoading"
            @submit="handleDraftSubmit"
          />
        </div>

        <div class="chat-stage__bottom" aria-hidden="true"></div>
      </div>
    </section>

    <!-- 观测信息用 -->
    <!-- <ConversationInsightPanel v-if="currentDetail && hasMessages" :detail="currentDetail" /> -->
  </div>
</template>

<style scoped>
.chat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

/* .chat-layout.has-insight {
  grid-template-columns: minmax(0, 1fr) 320px;
} */

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
