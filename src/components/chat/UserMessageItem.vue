<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { UserMessage } from '@/domain'

/** 单条用户消息 */
const props = defineProps<{
  /** 用户消息数据 */
  message: UserMessage
}>()

/** 向消息列表派发的操作事件 */
const emit = defineEmits<{
  /** 请求删除该消息 */
  delete: [message: UserMessage]
}>()

/** 用户消息超过该字符数时折叠，避免长提问撑满页面 */
const collapseThreshold = 600
/** 是否处于折叠状态，默认折叠超长提问 */
const isCollapsed = computed(() => props.message.content.length > collapseThreshold)

/** 复制用户消息原文 */
async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择文本')
  }
}
</script>

<template>
  <article class="message-row is-user">
    <div class="user-message">
      <div class="user-bubble" :class="{ 'is-collapsed': isCollapsed }">
        {{ message.content }}
      </div>

      <div class="message-actions">
        <el-button text size="small" @click="copyMessage">复制</el-button>
        <el-button text size="small" type="danger" @click="emit('delete', message)">删除</el-button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.message-row {
  display: flex;
  width: 100%;
}

.message-row.is-user {
  justify-content: flex-end;
}

.user-message {
  display: flex;
  max-width: min(78%, 620px);
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.user-bubble {
  padding: 10px 16px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--el-color-primary-light-9);
  background: color-mix(in srgb, var(--el-color-primary-light-8) 55%, var(--el-bg-color));
  border-radius: 14px;
}

.user-bubble.is-collapsed {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 12;
}

.message-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.user-message:hover .message-actions,
.user-message:focus-within .message-actions {
  opacity: 1;
}

@media (hover: none) {
  .message-actions {
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .user-message {
    max-width: 88%;
  }

  .user-bubble {
    padding: 9px 13px;
  }
}
</style>
