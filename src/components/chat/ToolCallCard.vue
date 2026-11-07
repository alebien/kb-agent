<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ToolCall, ToolName } from '@/domain'
import { formatDateTime, formatDuration } from '@/utils/datetime'
import { maskName, maskPhone, maskSensitiveText } from '@/utils/mask'

/** 单次工具调用卡片 */
const props = defineProps<{
  /** 工具调用数据，按 status 区分四态 */
  call: ToolCall
}>()

/** 结构化工具结果的一行 */
interface ToolResultRow {
  /** 字段名称 */
  label: string
  /** 脱敏后的展示值 */
  value: string
}

/** 工具名到展示文案的映射 */
const TOOL_LABELS: Record<ToolName, string> = {
  search_knowledge: '知识库检索',
  get_order: '查询订单',
  create_ticket: '创建工单',
}

/** 工具状态到展示文案与标签色的映射 */
const STATUS_META = {
  pending: { text: '等待中', type: 'info' },
  running: { text: '执行中', type: 'warning' },
  success: { text: '成功', type: 'success' },
  error: { text: '失败', type: 'danger' },
} as const

/** 是否展开参数与结果详情 */
const isExpanded = ref(false)
/** 工具展示名称 */
const toolLabel = computed(() => TOOL_LABELS[props.call.name] ?? props.call.name)
/** 当前状态的展示文案与标签色 */
const statusMeta = computed(() => STATUS_META[props.call.status])
/** 耗时文本，未产生耗时时不展示 */
const durationText = computed(() =>
  'durationMs' in props.call && typeof props.call.durationMs === 'number'
    ? formatDuration(props.call.durationMs)
    : '',
)

/** 入参格式化，便于阅读 */
const argumentText = computed(() => JSON.stringify(props.call.arguments, null, 2))

/** 把未知结果收窄为可按键读取的对象 */
function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/** 读取字符串型结果字段，缺失时返回空字符串 */
function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 隐藏地址中的门牌、楼栋与房间号，仅保留到道路层级 */
function maskAddress(address: string): string {
  return address.replace(/\d[\d\s号室栋单元楼层-]*.*$/, '***')
}

/** 按工具类型整理结果字段，便于客服直接阅读 */
const resultRows = computed<ToolResultRow[]>(() => {
  if (props.call.status !== 'success') {
    return []
  }

  /** 当前工具结果对象 */
  const result = toRecord(props.call.result)
  if (!result) {
    return [{ label: '结果', value: maskSensitiveText(String(props.call.result)) }]
  }

  if (props.call.name === 'search_knowledge') {
    /** 检索命中条数 */
    const hits = typeof result.hits === 'number' ? result.hits : null
    /** 最高相似度 */
    const topScore = typeof result.topScore === 'number' ? result.topScore : null
    return [
      { label: '命中条数', value: hits === null ? '—' : `${hits} 条` },
      { label: '最高相似度', value: topScore === null ? '—' : `${Math.round(topScore * 100)}%` },
    ]
  }

  if (props.call.name === 'get_order') {
    /** 订单号，缺失时展示占位 */
    const orderNo = readText(result.orderNo) || '—'
    /** 订单状态，缺失时展示占位 */
    const orderStatus = readText(result.status) || '—'
    /** 签收时间，存在时按统一时间格式展示 */
    const signedAt = readText(result.signedAt)
    /** 收件人，展示前脱敏 */
    const receiver = readText(result.receiver)
    /** 联系电话，展示前脱敏 */
    const phone = readText(result.phone)
    /** 收货地址，展示前隐藏门牌号 */
    const address = readText(result.address)
    return [
      { label: '订单号', value: orderNo },
      { label: '订单状态', value: orderStatus },
      ...(signedAt ? [{ label: '签收时间', value: formatDateTime(signedAt) }] : []),
      ...(receiver ? [{ label: '收件人', value: maskName(receiver) }] : []),
      ...(phone ? [{ label: '联系电话', value: maskPhone(phone) }] : []),
      ...(address ? [{ label: '收货地址', value: maskAddress(address) }] : []),
    ]
  }

  if (props.call.name === 'create_ticket') {
    /** 工单号，复用与新建均返回 */
    const code = readText(result.code) || '—'
    /** 是否复用原单，仅响应字段 */
    const reused = result.reused === true
    return [
      { label: '工单号', value: code },
      { label: '建单结果', value: reused ? '已复用原单' : '已新建工单' },
    ]
  }

  return []
})

/** 无结构化字段时的兜底结果文本，统一做敏感信息替换 */
const fallbackResultText = computed(() => {
  if (props.call.status !== 'success' || resultRows.value.length) {
    return ''
  }

  return maskSensitiveText(JSON.stringify(props.call.result, null, 2))
})

/** 错误信息，仅失败态有值 */
const errorText = computed(() => {
  if (props.call.status !== 'error') {
    return ''
  }

  return `${props.call.error.code} · ${props.call.error.message}`
})
</script>

<template>
  <div class="tool-card" :class="`is-${call.status}`">
    <button
      type="button"
      class="tool-card__head"
      :aria-expanded="isExpanded"
      @click="isExpanded = !isExpanded"
    >
      <span class="tool-card__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            d="M14.7 6.3a4 4 0 0 0-5.6 5.6L4 17v3h3l5.1-5.1a4 4 0 0 0 5.6-5.6l-2.5 2.5-2.2-2.2z"
          />
        </svg>
      </span>

      <span class="tool-card__name">{{ toolLabel }}</span>
      <el-tag :type="statusMeta.type" size="small" effect="plain">{{ statusMeta.text }}</el-tag>
      <span v-if="durationText" class="tool-card__duration">{{ durationText }}</span>

      <svg
        class="tool-card__chevron"
        :class="{ 'is-open': isExpanded }"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div v-if="isExpanded" class="tool-card__body">
      <p class="tool-card__label">入参</p>
      <pre class="tool-card__code">{{ argumentText }}</pre>

      <template v-if="resultRows.length">
        <p class="tool-card__label">结果</p>
        <dl class="tool-card__result">
          <div v-for="row in resultRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </template>

      <template v-else-if="fallbackResultText">
        <p class="tool-card__label">结果</p>
        <pre class="tool-card__code">{{ fallbackResultText }}</pre>
      </template>

      <p v-if="errorText" class="tool-card__error">{{ errorText }}</p>
      <p v-if="call.status === 'error'" class="tool-card__degrade">
        已降级为知识库结论，请人工核实
      </p>
    </div>
  </div>
</template>

<style scoped>
.tool-card {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.tool-card.is-running {
  border-color: var(--el-color-warning-light-5);
}

.tool-card.is-error {
  border-color: var(--el-color-danger-light-5);
}

.tool-card__head {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: var(--el-text-color-regular);
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
}

.tool-card__mark {
  display: grid;
  width: 20px;
  height: 20px;
  flex: none;
  place-items: center;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
}

.tool-card__mark svg {
  width: 12px;
  height: 12px;
  fill: currentcolor;
}

.tool-card__name {
  font-size: 13px;
  font-weight: 500;
}

.tool-card__duration {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.tool-card__chevron {
  width: 14px;
  height: 14px;
  flex: none;
  margin-left: auto;
  fill: none;
  stroke: var(--el-text-color-placeholder);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.15s ease;
}

.tool-card__chevron.is-open {
  transform: rotate(180deg);
}

.tool-card__body {
  padding: 0 10px 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.tool-card__label {
  margin: 10px 0 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.tool-card__code {
  max-height: 180px;
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  color: var(--el-text-color-regular);
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.tool-card__error {
  margin: 10px 0 0;
  color: var(--el-color-danger);
  font-size: 12px;
}

.tool-card__result {
  display: grid;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.tool-card__result div {
  padding: 6px 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.tool-card__result dt {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.tool-card__result dd {
  margin: 2px 0 0;
  color: var(--el-text-color-regular);
  font-size: 12px;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .tool-card__result {
    grid-template-columns: 1fr;
  }
}

.tool-card__degrade {
  margin: 4px 0 0;
  color: var(--el-color-warning);
  font-size: 12px;
}
</style>
