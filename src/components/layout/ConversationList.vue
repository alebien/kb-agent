<script setup lang="ts">
import type { ConversationSummary } from '@/domain'
import ConversationListItem from './ConversationListItem.vue'
import type { ConversationActionKey, ConversationMenuAction } from './conversationMenu'

/** 最近对话列表参数 */
withDefaults(
  defineProps<{
    /** 会话摘要列表 */
    items: ConversationSummary[]
    /** 当前打开会话 id，用于高亮 */
    activeId: string
    /** 每个会话可用的操作菜单 */
    actions: ConversationMenuAction[]
    /** 是否正在加载，加载中展示骨架占位 */
    loading?: boolean
    /** 加载失败提示，非空时展示错误态与重试入口 */
    error?: string
  }>(),
  {
    loading: false,
    error: '',
  },
)

/** 向侧边栏派发的列表交互事件 */
const emit = defineEmits<{
  /** 请求打开指定会话 */
  select: [conversation: ConversationSummary]
  /** 请求执行指定会话操作 */
  action: [action: ConversationActionKey, conversation: ConversationSummary]
  /** 请求重新拉取会话列表 */
  retry: []
  /** 请求新建对话 */
  'new-chat': []
}>()

/** 加载骨架的占位行数，与常见首屏会话数量接近 */
const skeletonRows = 3
</script>

<template>
  <div class="conversation-list" role="list" aria-label="最近对话">
    <div v-if="loading" class="conversation-list__skeleton" aria-busy="true">
      <span v-for="row in skeletonRows" :key="row" class="conversation-list__skeleton-row" />
    </div>

    <div v-else-if="error" class="conversation-list__error">
      <p>{{ error }}</p>
      <el-button text size="small" type="primary" @click="emit('retry')">重试</el-button>
    </div>

    <template v-else>
      <ConversationListItem
        v-for="conversation in items"
        :key="conversation.id"
        v-memo="[conversation.title, activeId === conversation.id, actions]"
        :conversation="conversation"
        :active="activeId === conversation.id"
        :actions="actions"
        @select="emit('select', $event)"
        @action="(action, item) => emit('action', action, item)"
      />

      <div v-if="!items.length" class="conversation-list__empty">
        <p>暂无对话</p>
        <el-button text size="small" type="primary" @click="emit('new-chat')"> 新建对话 </el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.conversation-list {
  min-width: 0;
}

.conversation-list__empty,
.conversation-list__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 12px 12px 20px;
}

.conversation-list__empty p,
.conversation-list__error p {
  margin: 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.conversation-list__error p {
  color: var(--el-color-danger);
}

.conversation-list__skeleton {
  display: flex;
  padding: 4px 12px 8px;
  flex-direction: column;
  gap: 8px;
}

.conversation-list__skeleton-row {
  height: 32px;
  background: linear-gradient(
    90deg,
    var(--el-fill-color-light) 25%,
    var(--el-fill-color) 37%,
    var(--el-fill-color-light) 63%
  );
  background-size: 400% 100%;
  border-radius: 8px;
  animation: conversation-skeleton 1.4s ease infinite;
}

@keyframes conversation-skeleton {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .conversation-list__skeleton-row {
    animation: none;
  }
}
</style>
