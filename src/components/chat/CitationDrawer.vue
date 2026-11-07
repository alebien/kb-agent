<script setup lang="ts">
import { computed } from 'vue'
import type { Citation } from '@/domain'
import { documents, knowledgeBases } from '@/mock'
import { formatDate } from '@/utils/datetime'

/** 引用来源抽屉 */
const props = defineProps<{
  /** 是否打开 */
  modelValue: boolean
  /** 当前查看的引用，为空时展示空态 */
  citation?: Citation | null
}>()

/** 向父级同步开合状态 */
const emit = defineEmits<{
  /** 更新抽屉开关 */
  'update:modelValue': [value: boolean]
}>()

/** 抽屉可见性，双向绑定到 el-drawer */
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

/** 引用对应的文档实体，找不到说明来源已删除或数据缺失 */
const document = computed(() =>
  props.citation?.documentId
    ? (documents.find((item) => item.id === props.citation?.documentId) ?? null)
    : null,
)

/** 文档所属知识库名称，缺失时显示占位 */
const knowledgeName = computed(() => {
  /** 知识库 id，优先取文档实体，其次取引用字段 */
  const knowledgeBaseId = document.value?.knowledgeBaseId ?? props.citation?.knowledgeBaseId
  if (!knowledgeBaseId) {
    return '未知知识库'
  }

  return knowledgeBases.find((item) => item.id === knowledgeBaseId)?.name ?? '未知知识库'
})

/** 导入时间，文档缺失时显示占位 */
const importedAt = computed(() => (document.value ? formatDate(document.value.uploadedAt) : '—'))

/** 文本块数量，未知时显示占位 */
const chunkText = computed(() =>
  typeof document.value?.chunkCount === 'number' ? `${document.value.chunkCount} 个文本块` : '—',
)
</script>

<template>
  <el-drawer v-model="visible" title="来源详情" size="420px" :destroy-on-close="true">
    <div v-if="citation" class="citation-detail">
      <h3 class="citation-detail__title">{{ citation.name }}</h3>

      <dl class="citation-detail__meta">
        <div>
          <dt>知识库</dt>
          <dd>{{ knowledgeName }}</dd>
        </div>
        <div>
          <dt>导入时间</dt>
          <dd>{{ importedAt }}</dd>
        </div>
        <div>
          <dt>文本块</dt>
          <dd>{{ chunkText }}</dd>
        </div>
        <div v-if="citation.page">
          <dt>页码</dt>
          <dd>第 {{ citation.page }} 页</dd>
        </div>
        <div v-if="typeof citation.score === 'number'">
          <dt>相似度</dt>
          <dd>{{ Math.round(citation.score * 100) }}%</dd>
        </div>
      </dl>

      <div v-if="citation.snippet" class="citation-detail__snippet">
        <p class="citation-detail__label">命中片段</p>
        <blockquote>{{ citation.snippet }}</blockquote>
      </div>

      <el-empty v-if="!document" description="文档已删除或无权访问" :image-size="80" />
    </div>

    <el-empty v-else description="暂无引用来源" :image-size="80" />
  </el-drawer>
</template>

<style scoped>
.citation-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.citation-detail__title {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}

.citation-detail__meta {
  display: grid;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.citation-detail__meta div {
  padding: 8px 10px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.citation-detail__meta dt {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.citation-detail__meta dd {
  margin: 2px 0 0;
  font-size: 13px;
}

.citation-detail__label {
  margin: 0 0 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.citation-detail__snippet blockquote {
  margin: 0;
  padding: 10px 12px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
  background: var(--el-color-primary-light-9);
  border-left: 3px solid var(--el-color-primary);
  border-radius: 6px;
}
</style>
