<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'
import MessageActionButton from './MessageActionButton.vue'
import MessageActionIcon from './MessageActionIcon.vue'
import type { AgentMessage } from '@/domain'
import { markdownToPlainText, truncateMarkdown } from '@/utils/markdown'
import { maskSensitiveText } from '@/utils/mask'

/** 单条助手消息 */
const props = withDefaults(
  defineProps<{
    /** 助手消息数据 */
    message: AgentMessage
    /** 是否为会话最后一条消息，只有最后一条允许重新生成 */
    canRetry?: boolean
  }>(),
  {
    canRetry: false,
  },
)

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
const COLLAPSE_THRESHOLD = 900
/** 是否手动展开长消息 */
const isExpanded = ref(false)
/** 当前消息是否正在流式生成 */
const isStreaming = computed(() => props.message.status === 'streaming')
/** 当前消息是否生成失败 */
const isFailed = computed(() => props.message.status === 'failed')

/** 用于渲染的正文，未展开时按安全边界截断，避免切断代码块与表格 */
const displayContent = computed(() => {
  // 生成中不折叠，避免回答在 900 字处突然停住，结束后再按折叠态展示
  if (isExpanded.value || isStreaming.value) {
    return props.message.content
  }

  return truncateMarkdown(props.message.content, COLLAPSE_THRESHOLD)
})

/** 是否展示展开按钮 */
const showExpandButton = computed(() => props.message.content.length > COLLAPSE_THRESHOLD)

/** 折叠态提示文案，仅在生成结束后展示 */
const showCollapsedHint = computed(
  () => showExpandButton.value && !isExpanded.value && !isStreaming.value,
)

/** 切换长消息展开状态 */
function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

/**
 * 复制到剪贴板并给出统一反馈
 *
 * @param text 已脱敏的待复制文本
 * @param successMessage 复制成功提示
 */
async function copyToClipboard(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(successMessage)
  } catch {
    ElMessage.error('复制失败，请手动选择文本')
  }
}

/** 复制纯文本，保留内容但不带 Markdown 标记 */
function copyPlainText() {
  void copyToClipboard(maskSensitiveText(markdownToPlainText(props.message.content)), '已复制文本')
}

/** 复制 Markdown 原文，便于粘贴到其他编辑器 */
function copyMarkdown() {
  void copyToClipboard(maskSensitiveText(props.message.content), '已复制 Markdown')
}

/**
 * 处理复制菜单的选择
 *
 * @param command 下拉菜单项标识，Element Plus 回调可能传入数字或对象
 */
function handleCopyCommand(command: string | number | object) {
  if (command === 'markdown') {
    copyMarkdown()
    return
  }

  if (command === 'text') {
    copyPlainText()
  }
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
        <MessageActionButton
          v-if="isStreaming"
          label="停止生成"
          icon="stop"
          danger
          @click="emit('stop', message)"
        />

        <template v-else>
          <el-dropdown trigger="hover" placement="top-start" @command="handleCopyCommand">
            <button type="button" class="message-action" aria-label="复制" title="复制">
              <MessageActionIcon name="copy" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="text">复制文本</el-dropdown-item>
                <el-dropdown-item command="markdown">复制为 Markdown</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <MessageActionButton
            v-if="canRetry"
            label="重新生成"
            icon="retry"
            @click="emit('retry', message)"
          />
          <MessageActionButton
            v-if="showExpandButton"
            :label="isExpanded ? '收起' : '展开全文'"
            :icon="isExpanded ? 'collapse' : 'expand'"
            :active="isExpanded"
            @click="toggleExpand"
          />
          <MessageActionButton label="删除" icon="delete" danger @click="emit('delete', message)" />

          <span v-if="showCollapsedHint" class="message-actions__hint">内容较长，已折叠</span>
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

.message-sources {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.source-card {
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.source-card strong {
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
