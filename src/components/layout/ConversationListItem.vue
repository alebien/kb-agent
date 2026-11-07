<script setup lang="ts">
import { computed } from 'vue'
import type { ConversationSummary } from '@/domain'
import type {
  ConversationActionIcon,
  ConversationActionKey,
  ConversationMenuAction,
} from './conversationMenu'

/** 单个最近对话项 */
const props = defineProps<{
  /** 会话摘要数据 */
  conversation: ConversationSummary
  /** 是否为当前打开会话 */
  active: boolean
  /** 当前可用的操作菜单 */
  actions: ConversationMenuAction[]
}>()

/** 向列表和侧边栏派发的交互事件 */
const emit = defineEmits<{
  /** 点击会话，请求打开 */
  select: [conversation: ConversationSummary]
  /** 选择某个会话操作 */
  action: [action: ConversationActionKey, conversation: ConversationSummary]
}>()

/** 根据可见性过滤后的操作项 */
const visibleActions = computed(() => props.actions.filter((action) => action.visible))

/** 操作图标路径映射 */
const actionIconPaths: Record<ConversationActionIcon, string> = {
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5',
}

/** 打开当前会话 */
function selectConversation() {
  emit('select', props.conversation)
}

/** 将 Element Plus 的下拉命令转换为业务操作 */
function handleCommand(command: string | number | object) {
  if (typeof command !== 'string') {
    return
  }

  /** 匹配到的操作配置 */
  const action = visibleActions.value.find((item) => item.key === command)
  if (action) {
    emit('action', action.key, props.conversation)
  }
}
</script>

<template>
  <div
    class="conversation-item"
    :class="{ 'is-active': active }"
    role="button"
    tabindex="0"
    :aria-current="active ? 'true' : undefined"
    :title="conversation.title"
    @click="selectConversation"
    @keydown.enter.prevent="selectConversation"
    @keydown.space.prevent="selectConversation"
  >
    <span class="conversation-item__title">{{ conversation.title }}</span>

    <el-dropdown
      trigger="click"
      placement="bottom-end"
      popper-class="conversation-action-popper"
      :show-timeout="0"
      :hide-timeout="80"
      @command="handleCommand"
    >
      <button
        type="button"
        class="conversation-item__more"
        aria-label="对话操作"
        @click.stop
        @keydown.stop
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="action in visibleActions"
            :key="action.key"
            :command="action.key"
            :class="{ 'is-danger': action.danger }"
          >
            <svg class="conversation-action-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path :d="actionIconPaths[action.icon]" />
            </svg>
            <span>{{ action.label }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.conversation-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  margin: 2px 8px;
  padding: 0 6px 0 12px;
  color: var(--el-text-color-regular);
  border-radius: 8px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.conversation-item:hover {
  background: var(--el-fill-color-light);
}

.conversation-item:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: -2px;
}

.conversation-item.is-active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.conversation-item__title {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-item__more {
  display: grid;
  width: 26px;
  height: 26px;
  padding: 0;
  flex: none;
  place-items: center;
  color: var(--el-text-color-secondary);
  background: transparent;
  border: 0;
  border-radius: 6px;
  opacity: 0;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease;
}

.conversation-item:hover .conversation-item__more,
.conversation-item.is-active .conversation-item__more,
.conversation-item__more:focus-visible {
  opacity: 1;
}

.conversation-item__more:hover {
  background: var(--el-fill-color);
}

.conversation-item__more svg {
  width: 16px;
  height: 16px;
  fill: currentcolor;
}

.conversation-action-icon {
  width: 15px;
  height: 15px;
  margin-right: 8px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

:global(.conversation-action-popper.el-popper) {
  padding: 4px;
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-light);
}

:global(.conversation-action-popper .el-dropdown-menu) {
  padding: 0;
}

:global(.conversation-action-popper .el-dropdown-menu__item) {
  gap: 0;
  min-width: 148px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
}

:global(.conversation-action-popper .el-dropdown-menu__item.is-danger) {
  color: var(--el-color-danger);
}

:global(.conversation-action-popper .el-dropdown-menu__item.is-danger:hover) {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

@media (hover: none) {
  .conversation-item__more {
    opacity: 1;
  }
}
</style>
