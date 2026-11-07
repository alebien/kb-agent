<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import type { AgentMessage } from '@/domain'

/** 单条助手消息 */
const props = defineProps<{
  /** 助手消息数据 */
  message: AgentMessage
}>()

/** 向消息列表派发的操作事件 */
const emit = defineEmits<{
  /** 请求重新生成 */
  retry: [message: AgentMessage]
  /** 请求停止生成 */
  stop: [message: AgentMessage]
  /** 请求删除该消息 */
  delete: [message: AgentMessage]
}>()

/** 长消息折叠阈值，超过后默认只展示前 900 字，降低长 Markdown 渲染压力 */
const collapseThreshold = 900
/** 长消息折叠时保留的字符数 */
const collapsedLength = 900
/** 是否手动展开长消息 */
const isExpanded = ref(false)
/** 当前消息是否正在流式生成 */
const isStreaming = computed(() => props.message.status === 'streaming')
/** 当前消息是否生成失败 */
const isFailed = computed(() => props.message.status === 'failed')

/** 用于渲染的正文，长消息未展开时截断，避免一次性渲染超长 Markdown */
const displayContent = computed(() => {
  if (isExpanded.value || props.message.content.length <= collapseThreshold) {
    return props.message.content
  }

  return `${props.message.content.slice(0, collapsedLength)}\n\n…`
})

/** 是否展示展开按钮 */
const showExpandButton = computed(() => props.message.content.length > collapseThreshold)

/** 折叠状态下的截断提示，不参与 Markdown 解析 */
const collapsedHint = computed(
  () => showExpandButton.value && !isExpanded.value && !isStreaming.value,
)

/** 复制助手回答原文 */
async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择文本')
  }
}

/** 切换长消息展开状态 */
function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

// 每条长消息独立记录展开状态；切换到另一条消息时恢复折叠
watch(
  () => props.message.id,
  () => {
    isExpanded.value = false
  },
)
</script>

<template>
  <article class="message-row is-agent">
    <div class="agent-message">
      <div
        v-if="isStreaming && !message.content"
        class="agent-message__typing"
        aria-label="正在生成回答"
      >
        <span class="agent-message__typing-dot" />
        <span class="agent-message__typing-dot" />
        <span class="agent-message__typing-dot" />
      </div>
      <MarkdownRenderer v-else :content="displayContent" :streaming="isStreaming" />

      <p v-if="collapsedHint" class="agent-message__collapse-hint">
        内容较长，已折叠
        <el-button text size="small" type="primary" @click="toggleExpand">展开全文</el-button>
      </p>
      <p v-else-if="showExpandButton && isExpanded" class="agent-message__collapse-hint">
        <el-button text size="small" type="primary" @click="toggleExpand">收起</el-button>
      </p>

      <div v-if="message.citations.length" class="message-sources">
        <div v-for="citation in message.citations" :key="citation.id" class="source-card">
          <strong>{{ citation.name }}</strong>
          <p>{{ citation.description }}</p>
          <p v-if="citation.snippet" class="source-card__snippet">{{ citation.snippet }}</p>
        </div>
      </div>

      <el-alert
        v-if="isFailed"
        :title="message.error || '生成失败，请重试'"
        type="error"
        :closable="false"
        show-icon
        class="agent-message__error"
      />

      <div class="message-actions">
        <el-button
          v-if="isStreaming"
          text
          size="small"
          type="danger"
          @click="emit('stop', message)"
        >
          停止
        </el-button>
        <template v-else>
          <el-button text size="small" @click="copyMessage">复制</el-button>
          <el-button text size="small" @click="emit('retry', message)">重试</el-button>
          <el-button text size="small" type="danger" @click="emit('delete', message)"
            >删除</el-button
          >
        </template>
      </div>
    </div>
  </article>
</template>

<style scoped>
.message-row {
  display: flex;
  width: 100%;
}

.message-row.is-agent {
  justify-content: flex-start;
}

.agent-message {
  width: 100%;
}

.agent-message :deep(.markdown-body) {
  font-size: 14px;
}

.agent-message__typing {
  display: flex;
  height: 28px;
  align-items: center;
  gap: 5px;
}

.agent-message__typing-dot {
  width: 5px;
  height: 5px;
  background: var(--el-color-primary);
  border-radius: 50%;
  animation: agent-typing 1.1s infinite ease-in-out;
}

.agent-message__typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.agent-message__typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

.agent-message__collapse-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.message-sources {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.source-card {
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.source-card strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}

.source-card p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.source-card__snippet {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.agent-message__error {
  margin-top: 12px;
}

.message-actions {
  display: flex;
  min-height: 24px;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.agent-message:hover .message-actions,
.agent-message:focus-within .message-actions {
  opacity: 1;
}

@media (hover: none) {
  .message-actions {
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .message-sources {
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 14px;
  }

  .source-card {
    padding: 8px 10px;
  }
}

@keyframes agent-typing {
  0%,
  60%,
  100% {
    opacity: 0.4;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
</style>
