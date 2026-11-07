<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import MessageActionButton from './MessageActionButton.vue'
import type { UserMessage } from '@/domain'
import { maskSensitiveText } from '@/utils/mask'

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

/** 用户消息折叠阈值，与助手消息保持一致，超过后默认折叠 */
const COLLAPSE_THRESHOLD = 900
/** 是否手动展开了超长提问 */
const isExpanded = ref(false)
/** 提问内容是否超长，决定是否展示展开按钮 */
const isOverflow = computed(() => props.message.content.length > COLLAPSE_THRESHOLD)
/** 实际展示的文本，超长且未展开时按字符截断 */
const displayContent = computed(() => {
  if (isExpanded.value || !isOverflow.value) {
    return props.message.content
  }

  return `${props.message.content.slice(0, COLLAPSE_THRESHOLD)}…`
})

/** 切换超长提问的展开状态 */
function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

/** 复制用户提问，手机号与邮箱按脱敏规则替换 */
async function copyMessage() {
  try {
    await navigator.clipboard.writeText(maskSensitiveText(props.message.content))
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择文本')
  }
}
</script>

<template>
  <article class="message-row is-user">
    <div class="user-message">
      <div class="user-bubble">{{ displayContent }}</div>

      <div class="message-actions">
        <MessageActionButton label="复制" icon="copy" @click="copyMessage" />
        <MessageActionButton
          v-if="isOverflow"
          :label="isExpanded ? '收起' : '展开全文'"
          :icon="isExpanded ? 'collapse' : 'expand'"
          :active="isExpanded"
          @click="toggleExpand"
        />
        <MessageActionButton label="删除" icon="delete" danger @click="emit('delete', message)" />
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

@media (max-width: 640px) {
  .user-message {
    max-width: 88%;
  }

  .user-bubble {
    padding: 9px 13px;
  }
}
</style>
