<script setup lang="ts">
import { computed } from 'vue'

/** 回答置信度徽标 */
const props = withDefaults(
  defineProps<{
    /** 回答置信度，0 至 100 整数，null 表示尚未产生 */
    score?: number | null
  }>(),
  {
    score: null,
  },
)

/**
 * 置信度档位
 *
 * 85 及以上为高，75 至 84 需复核，低于 75 为低；
 * 颜色之外必须带文字，避免只用颜色传达信息
 */
const level = computed(() => {
  if (props.score === null || props.score === undefined) {
    return null
  }

  if (props.score >= 85) {
    return { key: 'high', text: '高置信度' }
  }

  if (props.score >= 75) {
    return { key: 'medium', text: '建议人工复核' }
  }

  return { key: 'low', text: '低置信度' }
})
</script>

<template>
  <span v-if="level" class="confidence-badge" :class="`is-${level.key}`">
    <span class="confidence-badge__dot" />
    <span>{{ level.text }}</span>
    <strong>{{ score }}</strong>
  </span>
</template>

<style scoped>
.confidence-badge {
  display: inline-flex;
  height: 22px;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 1;
  border: 1px solid transparent;
  border-radius: 999px;
}

.confidence-badge strong {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.confidence-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentcolor;
}

.confidence-badge.is-high {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.confidence-badge.is-medium {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}

.confidence-badge.is-low {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}
</style>
