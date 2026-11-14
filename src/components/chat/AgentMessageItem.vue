<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'
import CitationCard from './CitationCard.vue'
import CitationDrawer from './CitationDrawer.vue'
import ConfidenceBadge from './ConfidenceBadge.vue'
import CreateTicketDialog from './CreateTicketDialog.vue'
import MessageActionButton from './MessageActionButton.vue'
import MessageActionIcon from './MessageActionIcon.vue'
import MessageQualityRow from './MessageQualityRow.vue'
import ToolCallCard from './ToolCallCard.vue'
import type { AgentMessage, Citation } from '@/domain'
import { formatDuration } from '@/utils/datetime'
import { markdownToPlainText, truncateMarkdown } from '@/utils/markdown'
import { maskSensitiveText } from '@/utils/mask'

/** 单条助手消息 */
const props = withDefaults(
  defineProps<{
    /** 助手消息数据 */
    message: AgentMessage
    /** 是否为会话最后一组助手回答，只有该组允许重新生成 */
    canRetry?: boolean
    /** 当前回答在版本组中的序号，从 1 开始 */
    versionIndex?: number
    /** 当前回答所属版本组的总版数 */
    versionCount?: number
    /** 当前回答是否为版本组内最新版，旧版不展示无引用兜底与转人工提示 */
    isLatestVersion?: boolean
    /** 本轮转人工产生的工单号，用于展示已转人工提示 */
    ticketCode?: string
  }>(),
  {
    canRetry: false,
    versionIndex: 1,
    versionCount: 1,
    isLatestVersion: true,
    ticketCode: '',
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
  /** 请求切换回答版本，-1 为上一版，1 为下一版 */
  'change-version': [direction: number]
}>()

/** 长消息折叠阈值，超过后默认只展示前 900 字，降低长 Markdown 渲染压力 */
const COLLAPSE_THRESHOLD = 900
/** 是否手动展开长消息 */
const isExpanded = ref(false)
/** 当前消息是否已开始流式生成 */
const isStreaming = computed(() => props.message.status === 'streaming')
/** 当前消息是否处于等待首个增量或正在流式生成，两者都展示生成中的交互态 */
const isGenerating = computed(
  () => props.message.status === 'pending' || props.message.status === 'streaming',
)
/** 当前消息是否生成失败 */
const isFailed = computed(() => props.message.status === 'failed')
/** 当前消息是否已经产出完整结果 */
const isSettled = computed(
  () => props.message.status === 'completed' || props.message.status === 'stopped',
)

/** 用于渲染的正文，未展开时按安全边界截断，避免切断代码块与表格 */
const displayContent = computed(() => {
  // 生成中不折叠，避免回答在 900 字处突然停住，结束后再按折叠态展示
  if (isExpanded.value || isGenerating.value) {
    return props.message.content
  }

  return truncateMarkdown(props.message.content, COLLAPSE_THRESHOLD)
})

/** 是否展示展开按钮 */
const showExpandButton = computed(() => props.message.content.length > COLLAPSE_THRESHOLD)

/** 折叠态提示文案，仅在生成结束后展示 */
const showCollapsedHint = computed(
  () => showExpandButton.value && !isExpanded.value && !isGenerating.value,
)

/** 是否展示工具调用区 */
const hasToolCalls = computed(() => props.message.toolCalls.length > 0)

/** 是否展示置信度徽标，置信度为 null 时不展示 */
const showConfidence = computed(
  () => !isGenerating.value && typeof props.message.confidence === 'number',
)

/** 无引用兜底：已产出结果、置信度存在且没有任何引用 */
const showFallbackBanner = computed(
  () =>
    props.isLatestVersion &&
    isSettled.value &&
    typeof props.message.confidence === 'number' &&
    !props.message.citations.length,
)

/** 低置信度转人工提示 */
const showHandoff = computed(
  () =>
    props.isLatestVersion &&
    !isGenerating.value &&
    typeof props.message.confidence === 'number' &&
    props.message.confidence < 75 &&
    !!props.ticketCode,
)

/** 是否展示版本分页器，只有同组多版时才出现 */
const showVersionPager = computed(() => props.versionCount > 1)
/** 是否还能切到上一版 */
const canGoPreviousVersion = computed(() => props.versionIndex > 1)
/** 是否还能切到下一版 */
const canGoNextVersion = computed(() => props.versionIndex < props.versionCount)

/** 来源抽屉是否打开 */
const citationVisible = ref(false)
/** 当前查看的引用 */
const activeCitation = ref<Citation | null>(null)
/** 建单弹窗是否打开 */
const ticketVisible = ref(false)

/** 打开来源抽屉，仅可点击的引用会触发 */
function openCitation(citation: Citation) {
  activeCitation.value = citation
  citationVisible.value = true
}

/** 切换长消息展开状态 */
function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

/** 建单确认：当前只做页面反馈，接口逻辑待接入 */
function handleTicketConfirm() {
  ElMessage.success('建单参数已提交')
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
      <div v-if="showFallbackBanner" class="agent-message__fallback">
        <div class="agent-message__fallback-copy">
          <strong>知识库里没找到直接依据</strong>
          <span>建议转人工确认后再答复，避免承诺口径外的结论</span>
        </div>
        <el-button size="small" type="primary" plain @click="ticketVisible = true">
          转人工
        </el-button>
      </div>

      <div
        v-if="isGenerating && !message.content"
        class="agent-message__typing"
        aria-label="正在生成回答"
      >
        <span class="agent-message__typing-dot" />
        <span class="agent-message__typing-dot" />
        <span class="agent-message__typing-dot" />
      </div>
      <MarkdownRenderer v-else :content="displayContent" :streaming="isStreaming" />

      <section v-if="hasToolCalls" class="agent-message__section">
        <h4 class="agent-message__section-title">
          <span>工具调用</span>
          <span class="agent-message__section-count">{{ message.toolCalls.length }}</span>
        </h4>
        <div class="agent-message__tools">
          <ToolCallCard v-for="call in message.toolCalls" :key="call.id" :call="call" />
        </div>
      </section>

      <section v-if="message.citations.length" class="agent-message__section">
        <h4 class="agent-message__section-title">
          <span>引用来源</span>
          <span class="agent-message__section-count">{{ message.citations.length }}</span>
        </h4>
        <div class="message-sources">
          <CitationCard
            v-for="citation in message.citations"
            :key="citation.id"
            :citation="citation"
            @open="openCitation"
          />
        </div>
      </section>

      <MessageQualityRow v-if="isSettled" :message="message" />

      <p v-if="showHandoff" class="agent-message__handoff">已转人工，工单 {{ ticketCode }}</p>

      <div v-if="showConfidence" class="agent-message__meta">
        <ConfidenceBadge :score="message.confidence" />
        <span v-if="message.durationMs" class="agent-message__meta-duration">
          耗时 {{ formatDuration(message.durationMs) }}
        </span>
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
        <!-- <MessageActionButton
          v-if="isStreaming"
          label="停止生成"
          icon="stop"
          danger
          @click="emit('stop', message)"
        /> -->

        <template v-if="!isGenerating">
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

        <div v-if="showVersionPager" class="message-version-pager" aria-label="回答版本切换">
          <button
            type="button"
            class="message-action message-version-pager__arrow"
            :disabled="!canGoPreviousVersion"
            aria-label="上一版回答"
            @click="emit('change-version', -1)"
          >
            ‹
          </button>
          <span class="message-version-pager__status"> {{ versionIndex }}/{{ versionCount }} </span>
          <button
            type="button"
            class="message-action message-version-pager__arrow"
            :disabled="!canGoNextVersion"
            aria-label="下一版回答"
            @click="emit('change-version', 1)"
          >
            ›
          </button>
        </div>
      </div>
    </div>

    <CitationDrawer v-model="citationVisible" :citation="activeCitation" />
    <CreateTicketDialog
      v-model="ticketVisible"
      default-title="转人工工单"
      :conversation-id="message.conversationId"
      :existing-ticket-code="ticketCode"
      @confirm="handleTicketConfirm"
    />
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

.agent-message__fallback {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
  border-radius: 10px;
}

.agent-message__fallback-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.agent-message__fallback-copy strong {
  font-size: 13px;
  font-weight: 600;
}

.agent-message__fallback-copy span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
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

.agent-message__section {
  margin-top: 16px;
}

.agent-message__section-title {
  display: flex;
  margin: 0 0 8px;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 500;
}

.agent-message__section-count {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  place-items: center;
  padding: 0 4px;
  font-size: 11px;
  background: var(--el-fill-color);
  border-radius: 8px;
}

.agent-message__tools {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.message-sources {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.agent-message__handoff {
  margin: 12px 0 0;
  color: var(--el-color-danger);
  font-size: 12px;
}

.agent-message__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.agent-message__meta-duration {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.message-version-pager {
  display: inline-flex;
  margin-left: auto;
  align-items: center;
  gap: 2px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

/* 窄屏操作栏允许换行，避免分页器挤压复制、重试与删除按钮 */
@media (max-width: 640px) {
  .message-actions {
    flex-wrap: wrap;
    row-gap: 4px;
  }

  .message-version-pager {
    flex-shrink: 0;
  }
}

.message-version-pager__arrow {
  font-size: 16px;
  line-height: 1;
}

.message-version-pager__status {
  min-width: 30px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.agent-message__error {
  margin-top: 12px;
}

@media (max-width: 640px) {
  .message-sources {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .agent-message__fallback {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
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
