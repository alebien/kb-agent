<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AgentMessage, ToolCall, ToolName } from '@/domain'
import { formatDuration } from '@/utils/datetime'

/** 助手消息下方的质量信息行 */
const props = defineProps<{
  /** 助手消息，质量数据全部从该消息派生 */
  message: AgentMessage
}>()

/** 工具链路固定顺序，不按耗时重排 */
const STEP_ORDER: ToolName[] = ['search_knowledge', 'get_order', 'create_ticket']
/** 工具名到链路步骤名的映射 */
const STEP_LABELS: Record<ToolName, string> = {
  search_knowledge: '检索',
  get_order: '查订单',
  create_ticket: '建单',
}
/** 工具状态到文案的映射 */
const STATUS_TEXT: Record<ToolCall['status'], string> = {
  pending: '等待中',
  running: '执行中',
  success: '成功',
  error: '失败',
}

/** 是否展开工具链路 */
const isExpanded = ref(false)

/** 引用去重后的条数 */
const citationCount = computed(
  () => new Set(props.message.citations.map((citation) => citation.id)).size,
)

/** 总耗时：优先取消息耗时，缺失时用工具耗时求和兜底 */
const totalDuration = computed(() => {
  if (typeof props.message.durationMs === 'number') {
    return props.message.durationMs
  }

  return props.message.toolCalls.reduce(
    (total, call) => total + ('durationMs' in call ? (call.durationMs ?? 0) : 0),
    0,
  )
})

/** 置信度展示文案，null 显示破折号 */
const confidenceText = computed(() =>
  typeof props.message.confidence === 'number' ? String(props.message.confidence) : '—',
)

/** 固定三步的链路数据，未调用的步骤保留占位 */
const steps = computed(() =>
  STEP_ORDER.map((name) => {
    /** 当前步骤对应的工具调用 */
    const call = props.message.toolCalls.find((item) => item.name === name)
    /** 该步骤耗时；等待中与执行中的调用尚无结果，按 0 处理 */
    const duration = call && 'durationMs' in call ? (call.durationMs ?? 0) : 0

    return {
      name,
      label: STEP_LABELS[name],
      call,
      durationText: call ? formatDuration(duration) : '本回答未调用',
      statusText: call ? STATUS_TEXT[call.status] : '',
      // 单步占比超过一半时高亮，便于定位耗时瓶颈
      isHeavy: Boolean(call) && totalDuration.value > 0 && duration / totalDuration.value > 0.5,
    }
  }),
)

/** 展开区实际展示的链路；无工具调用时只保留检索占位，避免出现多余空行 */
const visibleSteps = computed(() =>
  props.message.toolCalls.length ? steps.value : steps.value.slice(0, 1),
)
</script>

<template>
  <div class="quality-row">
    <button
      type="button"
      class="quality-row__summary"
      :aria-expanded="isExpanded"
      @click="isExpanded = !isExpanded"
    >
      <span>总耗时 {{ formatDuration(totalDuration) }}</span>
      <span class="quality-row__dot">·</span>
      <span>引用 {{ citationCount }} 条</span>
      <span class="quality-row__dot">·</span>
      <span>置信度 {{ confidenceText }}</span>
      <svg
        class="quality-row__chevron"
        :class="{ 'is-open': isExpanded }"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <Transition name="quality-expand">
      <div v-if="isExpanded" class="quality-row__detail">
        <div
          v-for="(step, index) in visibleSteps"
          :key="step.name"
          class="quality-step"
          :class="{ 'is-idle': !step.call, 'is-heavy': step.isHeavy }"
        >
          <span class="quality-step__index">{{ index + 1 }}</span>
          <span class="quality-step__label">{{ step.label }}</span>
          <span v-if="step.call" class="quality-step__name">{{ step.name }}</span>
          <span class="quality-step__status" :class="`is-${step.call?.status ?? 'idle'}`">
            {{ step.statusText }}
          </span>
          <span class="quality-step__duration">{{ step.durationText }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.quality-row {
  margin-top: 12px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.quality-row__summary {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 2px 0;
  line-height: 1.6;
  text-align: left;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.quality-row__summary:hover {
  color: var(--el-text-color-secondary);
}

.quality-row__summary:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.quality-row__dot {
  opacity: 0.6;
}

.quality-row__chevron {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.15s ease;
}

.quality-row__chevron.is-open {
  transform: rotate(180deg);
}

.quality-row__detail {
  display: flex;
  margin-top: 8px;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.quality-step {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.8;
}

.quality-step.is-idle {
  opacity: 0.55;
}

.quality-step.is-heavy .quality-step__duration {
  color: var(--el-color-warning);
}

.quality-step__index {
  display: grid;
  width: 16px;
  height: 16px;
  flex: none;
  place-items: center;
  color: var(--el-text-color-secondary);
  font-size: 10px;
  background: var(--el-fill-color);
  border-radius: 50%;
}

.quality-step__label {
  min-width: 42px;
  color: var(--el-text-color-regular);
}

.quality-step__name {
  flex: 1;
  overflow: hidden;
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quality-step__status.is-success {
  color: var(--el-color-success);
}

.quality-step__status.is-error {
  color: var(--el-color-danger);
}

.quality-step__status.is-running {
  color: var(--el-color-warning);
}

.quality-step__duration {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.quality-expand-enter-active,
.quality-expand-leave-active {
  transition: opacity 0.15s ease;
}

.quality-expand-enter-from,
.quality-expand-leave-to {
  opacity: 0;
}
</style>
