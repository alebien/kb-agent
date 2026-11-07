<script setup lang="ts">
/** 消息操作图标名称，只描述图形含义，不绑定具体动作 */
type MessageActionIconName = 'copy' | 'retry' | 'delete' | 'stop' | 'expand' | 'collapse'

defineProps<{
  /** 要绘制的图标，取值受联合类型约束 */
  name: MessageActionIconName
}>()
</script>

<template>
  <svg
    class="message-action-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'copy'">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </template>
    <template v-else-if="name === 'retry'">
      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
      <path d="M21 3v5.5h-5.5" />
    </template>
    <template v-else-if="name === 'delete'">
      <path d="M3 6h18" />
      <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
      <path d="M18.5 6l-.9 13.1A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.9L5.5 6" />
      <path d="M10 10.5v6M14 10.5v6" />
    </template>
    <template v-else-if="name === 'stop'">
      <rect x="7" y="7" width="10" height="10" rx="1.6" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'expand'">
      <path d="M6 9l6 6 6-6" />
    </template>
    <template v-else>
      <path d="M6 15l6-6 6 6" />
    </template>
  </svg>
</template>

<style scoped>
.message-action-icon {
  width: 16px;
  height: 16px;
}
</style>
