<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchConversationDetail } from '@/api/conversations'
import type { ConversationDetail } from '@/data/conversations'
// markdown
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

const route = useRoute()

const isLoading = ref(true)
const loadError = ref('')
const currentDetail = ref<ConversationDetail | null>(null)
const activeConversationId = ref('')

const conversationId = computed(() => route.params.conversationId as string)

async function loadConversation(id: string) {
  if (!id || activeConversationId.value === id) {
    return
  }

  activeConversationId.value = id
  isLoading.value = true
  loadError.value = ''

  try {
    currentDetail.value = await fetchConversationDetail(id)
  } catch {
    currentDetail.value = null
    loadError.value = '会话不存在或已被删除'
  } finally {
    isLoading.value = false
  }
}

watch(
  conversationId,
  (value) => {
    void loadConversation(value)
  },
  { immediate: true },
)

const stats = computed(() => {
  const values = currentDetail.value?.stats
  return [
    { label: '总耗时', value: values?.duration ?? '-' },
    { label: 'Token', value: values?.tokens ?? '-' },
    { label: '成本', value: values?.cost ?? '-' },
    { label: '引用', value: values?.citations ?? '-' },
  ]
})
</script>

<template>
  <div class="chat-layout">
    <section class="chat-main">
      <el-loading v-if="isLoading" class="chat-skeleton"></el-loading>

       <el-result
        v-else-if="loadError"
        icon="warning"
        :title="loadError"
        sub-title="请从左侧选择有效会话"
      />

      <template v-else-if="currentDetail">
        <el-scrollbar class="message-scroll">
          <div class="message-stack">
            <article
              v-for="message in currentDetail.messages"
              :key="message.id"
              :class="['message-row', message.role === 'user' ? 'is-user' : 'is-agent']"
            >
              <div v-if="message.role === 'user'" class="user-bubble">
                {{ message.content }}
              </div>

              <div v-else class="agent-content">
                <MarkdownRenderer :content="message.content" />

                <div class="message-sources">
                  <div
                    v-for="citation in currentDetail.citations"
                    :key="citation.id"
                    class="source-card"
                  >
                    <strong>{{ citation.name }}</strong>
                    <p>{{ citation.description }}</p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </el-scrollbar>

        <div class="composer">
          <el-input
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="输入问题，或输入 / 调用工具……"
          />
        </div>
      </template>
    </section>

    <aside class="insight-panel">
      <el-scrollbar>
        <div v-if="currentDetail && !isLoading" class="insight-stack">
          <el-card shadow="never">
            <template #header>
              <div class="card-heading">
                <span>本次对话</span>
                <small>trace: {{ currentDetail.traceId }}</small>
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

            <div
              v-for="metric in currentDetail.qualityMetrics"
              :key="metric.label"
              class="metric-item"
            >
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
            <div
              v-for="citation in currentDetail.citations"
              :key="citation.id"
              class="source-group"
            >
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
                v-for="step in currentDetail.traceSteps"
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
  </div>
</template>

<style scoped>
.chat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.chat-main {
  display: flex;
  min-height: 0;
  flex-direction: column;
  background: var(--el-bg-color);
}

.chat-skeleton {
  padding-top: 8px;
}

.message-scroll {
  flex: 1;
  min-height: 0;
}

.message-stack,
.insight-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-stack {
  width: min(100%, 820px);
  margin: 0 auto;
  padding: 8px 0 28px;
}

.message-row {
  display: flex;
  width: 100%;
}

.message-row.is-user {
  justify-content: flex-end;
}

.message-row.is-agent {
  justify-content: flex-start;
}

.user-bubble {
  max-width: min(78%, 620px);
  padding: 10px 16px;
  line-height: 1.75;
  white-space: pre-wrap;
  background: var(--el-color-primary-light-9);
  background: color-mix(in srgb, var(--el-color-primary-light-8) 55%, var(--el-bg-color));
  border-radius: 14px;
}

.agent-content {
  width: 100%;
  padding: 2px 2px 0;
}

.agent-content :deep(.markdown-body) {
  font-size: 14px;
}

.message-sources {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.source-card {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.source-card strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}

.source-card p,
.source-entry p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.composer {
  width: min(100%, 820px);
  margin: 0 auto;
  flex-shrink: 0;
  padding: 8px 0 20px;
}

.composer :deep(.el-textarea__inner) {
  border-radius: 12px;
}

.insight-panel {
  min-height: 0;
}

.insight-panel :deep(.el-scrollbar) {
  height: 100%;
}

.insight-stack {
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

.source-group:last-child :deep(.el-divider) {
  display: none;
}
</style>
