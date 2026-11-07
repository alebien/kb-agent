<script setup lang="ts">
import type { ConversationSummary } from '@/domain'
import ConversationListItem from './ConversationListItem.vue'
import type { ConversationActionKey, ConversationMenuAction } from './conversationMenu'

/** 最近对话列表参数 */
defineProps<{
  /** 会话摘要列表 */
  items: ConversationSummary[]
  /** 当前打开会话 id，用于高亮 */
  activeId: string
  /** 每个会话可用的操作菜单 */
  actions: ConversationMenuAction[]
}>()

/** 向侧边栏派发的列表交互事件 */
const emit = defineEmits<{
  /** 请求打开指定会话 */
  select: [conversation: ConversationSummary]
  /** 请求执行指定会话操作 */
  action: [action: ConversationActionKey, conversation: ConversationSummary]
}>()
</script>

<template>
  <div class="conversation-list" role="list" aria-label="最近对话">
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

    <p v-if="!items.length" class="conversation-list__empty">暂无对话</p>
  </div>
</template>

<style scoped>
.conversation-list {
  min-width: 0;
}

.conversation-list__empty {
  margin: 0;
  padding: 8px 20px 12px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
