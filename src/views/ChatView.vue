<script setup lang="ts">
import { ref, watch } from 'vue'
import ChatComposer from '@/components/chat/ChatComposer.vue'
import ChatEmptyState from '@/components/chat/ChatEmptyState.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import SseDebugPanel from '@/components/dev/SseDebugPanel.vue'
import { useChatSession } from '@/composables/useChatSession'

/** 是否展示 SSE 调试面板，只在开发环境开启 */
const showSseDebug = import.meta.env.DEV

/** 对话页业务状态与动作，页面只负责布局与组件串联 */
const {
  draft,
  isLoading,
  isLoadingVisible,
  isCreating,
  loadError,
  currentDetail,
  isDraft,
  hasMessages,
  isComposerCentered,
  isComposerDisabled,
  isStreaming,
  submit,
  stop,
  retry,
  reload,
  startNewChat,
  removeMessage,
} = useChatSession()

/** 输入框组件实例，生成结束后恢复焦点 */
const composerRef = ref<InstanceType<typeof ChatComposer>>()

// 流式结束（完成、停止或失败）后把焦点还给输入框
watch(isStreaming, (streaming, previous) => {
  if (previous && !streaming && !isLoading.value) {
    composerRef.value?.focus()
  }
})
</script>

<template>
  <div class="chat-layout page-container">
    <section class="chat-main page-surface">
      <div class="chat-stage" :class="{ 'is-composer-centered': isComposerCentered }">
        <div
          v-loading="isLoadingVisible"
          class="chat-stage__top"
          element-loading-text="加载会话中..."
          element-loading-background="var(--el-bg-color)"
        >
          <el-result
            v-if="loadError"
            icon="warning"
            :title="loadError"
            sub-title="可以重新加载，或从左侧选择其他会话"
          >
            <template #extra>
              <el-button type="primary" :loading="isLoading" @click="reload">重试</el-button>
              <el-button @click="startNewChat">新建对话</el-button>
            </template>
          </el-result>

          <ChatMessageList
            v-else-if="currentDetail && hasMessages"
            :messages="currentDetail.messages"
            :ticket-code="currentDetail.ticketCode ?? ''"
            @retry="retry"
            @stop="stop"
            @delete="removeMessage"
          />

          <ChatEmptyState
            v-else-if="isDraft || currentDetail"
            :variant="isDraft ? 'draft' : 'conversation'"
            @new-chat="startNewChat"
          />
        </div>

        <div v-if="!loadError" class="chat-stage__composer">
          <p v-if="isCreating" class="chat-stage__status">正在创建对话...</p>
          <SseDebugPanel v-if="showSseDebug" />
          <ChatComposer
            ref="composerRef"
            v-model="draft"
            :streaming="isStreaming"
            :disabled="isComposerDisabled"
            @submit="submit"
            @stop="stop"
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

.chat-stage__status {
  margin: 0 0 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
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
