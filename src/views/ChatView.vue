<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createConversation, fetchConversationDetail } from '@/api/conversations'
import ChatComposer from '@/components/chat/ChatComposer.vue'
import ChatEmptyState from '@/components/chat/ChatEmptyState.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
// import ConversationInsightPanel from '@/components/chat/ConversationInsightPanel.vue'
import type { ConversationDetail } from '@/data/conversations'
import { useConversationStore } from '@/stores/conversations'

const route = useRoute()
const router = useRouter()
const conversationStore = useConversationStore()

const isLoading = ref(true)
const loadError = ref('')
const currentDetail = ref<ConversationDetail | null>(null)
const activeConversationId = ref('')
const draft = ref('')
const isCreating = ref(false)
let loadRequestId = 0

const isDraft = computed(() => route.name === 'chat-draft')
const conversationId = computed(() => route.params.conversationId as string | undefined)
const hasMessages = computed(() => (currentDetail.value?.messages.length ?? 0) > 0)

async function loadConversation(id: string) {
  if (!id || activeConversationId.value === id) {
    return
  }

  activeConversationId.value = id
  const requestId = ++loadRequestId
  currentDetail.value = null
  isLoading.value = true
  loadError.value = ''

  try {
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

async function handleDraftSubmit(content: string) {
  if (!isDraft.value || isCreating.value) {
    return
  }

  const message = content.trim()
  if (!message) {
    return
  }

  isCreating.value = true

  try {
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
    <section
      v-loading="isLoading"
      class="chat-main page-surface"
      element-loading-text="加载会话中..."
      element-loading-background="var(--el-bg-color)"
    >
      <template v-if="isDraft">
        <div class="chat-empty-wrap">
          <ChatEmptyState>
            <template #composer>
              <ChatComposer v-model="draft" :loading="isCreating" @submit="handleDraftSubmit" />
            </template>
          </ChatEmptyState>
        </div>
      </template>

      <el-result
        v-else-if="loadError"
        icon="warning"
        :title="loadError"
        sub-title="请从左侧选择有效会话"
      />

      <template v-else-if="currentDetail">
        <div v-if="!hasMessages" class="chat-empty-wrap">
          <ChatEmptyState>
            <template #composer>
              <ChatComposer v-model="draft" />
            </template>
          </ChatEmptyState>
        </div>

        <template v-else>
          <ChatMessageList
            :messages="currentDetail.messages"
            :citations="currentDetail.citations"
          />
          <div class="chat-composer-bar">
            <ChatComposer v-model="draft" />
          </div>
        </template>
      </template>
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
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.chat-main :deep(.el-loading-mask) {
  border-radius: inherit;
}

.chat-empty-wrap {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 24px var(--app-chat-inline-padding);
  overflow: auto;
}

.chat-composer-bar {
  width: min(100%, calc(var(--app-chat-max-width) + var(--app-chat-inline-padding) * 2));
  margin: 0 auto;
  flex-shrink: 0;
  padding: 8px var(--app-chat-inline-padding) 20px;
}

@media (max-width: 900px) {
  .chat-empty-wrap {
    padding: 20px var(--app-chat-inline-padding);
  }

  .chat-composer-bar {
    padding: 8px var(--app-chat-inline-padding) 14px;
  }
}

@media (max-width: 640px) {
  .chat-empty-wrap {
    align-items: flex-start;
    justify-content: flex-start;
    padding: 16px var(--app-chat-inline-padding);
  }

  .chat-composer-bar {
    padding: 8px var(--app-chat-inline-padding) calc(12px + env(safe-area-inset-bottom));
  }
}
</style>
