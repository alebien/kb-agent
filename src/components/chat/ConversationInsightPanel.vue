<script setup lang="ts">
import { computed } from 'vue'
import type { Conversation } from '@/domain'

/** 观测面板所需的会话详情 */
const props = defineProps<{
  /** 当前会话详情，面板据此展示统计、质量与追踪信息 */
  detail: Conversation
}>()

/** 将统计数据转换为带展示文案的列表 */
const stats = computed(() => {
  /** 当前会话的统计值 */
  const values = props.detail.stats
  return [
    { label: '总耗时', value: values.duration },
    { label: 'Token', value: values.tokens },
    { label: '成本', value: values.cost },
    { label: '引用', value: values.citations },
  ]
})

/** 引用来源列表，引用只挂在助手消息上，面板展示时从消息派生并按 id 去重 */
const citations = computed(() => {
  /** 所有助手消息携带的引用 */
  const all = props.detail.messages.flatMap((message) =>
    message.role === 'agent' ? message.citations : [],
  )
  return [...new Map(all.map((citation) => [citation.id, citation])).values()]
})
</script>

<template>
  <aside class="insight-panel">
    <el-scrollbar>
      <div class="insight-stack">
        <el-card shadow="never">
          <template #header>
            <div class="card-heading">
              <span>本次对话</span>
              <small>trace: {{ detail.traceId }}</small>
            </div>
          </template>

          <el-row :gutter="10">
            <el-col v-for="item in stats" :key="item.label" :span="12" class="stat-col">
              <el-card shadow="never" class="stat-card">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </el-card>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="card-heading">
              <span>质量评分</span>
              <small>最近 50 次</small>
            </div>
          </template>

          <div v-for="metric in detail.qualityMetrics" :key="metric.label" class="metric-item">
            <div class="metric-label">
              <span>{{ metric.label }}</span>
              <span>{{ metric.percentage }}%</span>
            </div>
            <el-progress
              :percentage="metric.percentage"
              :status="metric.status"
              :show-text="false"
              :stroke-width="6"
            />
          </div>
        </el-card>

        <el-card shadow="never" header="引用来源">
          <div v-for="citation in citations" :key="citation.id" class="source-group">
            <div class="source-entry">
              <el-link type="primary" :underline="false">{{ citation.name }}</el-link>
              <p>{{ citation.description }}</p>
            </div>
            <el-divider />
          </div>
        </el-card>

        <el-card shadow="never" header="Trace">
          <el-timeline>
            <el-timeline-item
              v-for="step in detail.traceSteps"
              :key="step.id"
              :timestamp="step.duration"
              placement="top"
            >
              {{ step.name }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </div>
    </el-scrollbar>
  </aside>
</template>

<style scoped>
.insight-panel {
  min-height: 0;
}

.insight-panel :deep(.el-scrollbar) {
  height: 100%;
}

.insight-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 4px 20px 0;
}

.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-heading small {
  color: var(--el-text-color-secondary);
}

.stat-col {
  margin-bottom: 10px;
}

.stat-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.stat-card span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.stat-card strong {
  font-size: 18px;
}

.metric-item + .metric-item {
  margin-top: 16px;
}

.metric-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
}

.source-entry p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.source-group:last-child :deep(.el-divider) {
  display: none;
}
</style>
