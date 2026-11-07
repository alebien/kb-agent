<script setup lang="ts">
import { computed } from 'vue'
import type { Citation } from '@/domain'

/** 单条引用卡片 */
const props = defineProps<{
  /** 引用数据，排序与截断由接口完成 */
  citation: Citation
}>()

/** 向父级派发的引用操作 */
const emit = defineEmits<{
  /** 请求打开来源详情 */
  open: [citation: Citation]
}>()

/** 是否可点击：有文档 id 且来源未下线 */
const isClickable = computed(() => !!props.citation.documentId && !props.citation.unavailable)

/** 相似度百分比，缺失时不展示 */
const scoreText = computed(() =>
  typeof props.citation.score === 'number' ? `${Math.round(props.citation.score * 100)}%` : '',
)

/** 片段超过 120 字时截断，避免卡片撑高 */
const snippetText = computed(() => {
  /** 原始片段 */
  const snippet = props.citation.snippet ?? ''
  return snippet.length > 120 ? `${snippet.slice(0, 120)}…` : snippet
})
</script>

<template>
  <component
    :is="isClickable ? 'button' : 'div'"
    class="citation-card"
    :class="{ 'is-clickable': isClickable, 'is-offline': citation.unavailable }"
    :type="isClickable ? 'button' : undefined"
    :aria-label="isClickable ? `查看来源：${citation.name}` : undefined"
    @click="isClickable && emit('open', citation)"
  >
    <div class="citation-card__head">
      <strong class="citation-card__name">{{ citation.name }}</strong>
      <span v-if="scoreText" class="citation-card__score">{{ scoreText }}</span>
    </div>

    <p v-if="citation.description" class="citation-card__desc">{{ citation.description }}</p>
    <p v-if="snippetText" class="citation-card__snippet">{{ snippetText }}</p>

    <div class="citation-card__foot">
      <span v-if="citation.page">第 {{ citation.page }} 页</span>
      <span v-else>页码未知</span>
      <span v-if="citation.unavailable" class="citation-card__offline">来源已下线</span>
      <span v-else-if="isClickable">查看来源</span>
    </div>
  </component>
</template>

<style scoped>
.citation-card {
  display: flex;
  width: 100%;
  flex-direction: column;
  padding: 10px 12px;
  text-align: left;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.citation-card.is-clickable {
  cursor: pointer;
}

.citation-card.is-clickable:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}

.citation-card.is-clickable:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}

.citation-card.is-offline {
  opacity: 0.55;
}

.citation-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.citation-card__name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.citation-card__score {
  flex: none;
  color: var(--el-color-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.citation-card__desc,
.citation-card__snippet {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.citation-card__snippet {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.citation-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.citation-card__offline {
  color: var(--el-color-info);
}
</style>
