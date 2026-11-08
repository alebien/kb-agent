<script setup lang="ts">
import { computed, ref } from 'vue'
import { setSseDebugBroken, setSseDebugChunkSize, sseDebugState } from '@/dev/sse-debug'

/** 分片大小可选项，覆盖默认粒度与整段返回两种极端情况 */
const chunkSizeOptions = [
  { label: '服务端默认', value: 0 },
  { label: '1 字', value: 1 },
  { label: '6 字', value: 6 },
  { label: '20 字', value: 20 },
  { label: '40 字', value: 40 },
]

/** 面板是否展开，默认收起避免遮挡回答 */
const isOpen = ref(false)
/** 分片下拉框的当前值，0 代表不传 chunkSize */
const chunkSizeValue = computed(() => sseDebugState.chunkSize.value ?? 0)
/** 是否开启了断流模拟 */
const isBroken = computed(() => sseDebugState.simulateBroken.value)
/** 事件总数，展示在面板标题上 */
const eventCount = computed(() => sseDebugState.entries.value.length)
/** 最近一条事件名，收起时也能看到流是否还在推进 */
const latestEvent = computed(() => sseDebugState.entries.value.at(-1)?.event ?? '等待请求')

/** 更新分片大小，0 表示恢复服务端默认值 */
function handleChunkSizeChange(value: number | string): void {
  /** 下拉框回传的数字值 */
  const numeric = Number(value)
  setSseDebugChunkSize(numeric > 0 ? numeric : null)
}

/** 切换断流模拟，勾选后下一次请求会带上 scenario=broken */
function handleBrokenChange(value: boolean): void {
  setSseDebugBroken(value)
}
</script>

<template>
  <div class="sse-debug" :class="{ 'is-open': isOpen }">
    <button
      type="button"
      class="sse-debug__toggle"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <span class="sse-debug__dot" aria-hidden="true" />
      <span>SSE 调试</span>
      <span class="sse-debug__summary">{{ eventCount }} 条 · {{ latestEvent }}</span>
      <span class="sse-debug__chevron" aria-hidden="true">{{ isOpen ? '收起' : '展开' }}</span>
    </button>

    <div v-if="isOpen" class="sse-debug__body">
      <div class="sse-debug__controls">
        <label class="sse-debug__field">
          <span>分片大小</span>
          <el-select
            :model-value="chunkSizeValue"
            size="small"
            class="sse-debug__select"
            @update:model-value="handleChunkSizeChange"
          >
            <el-option
              v-for="option in chunkSizeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </label>

        <label class="sse-debug__field sse-debug__switch">
          <el-switch
            :model-value="isBroken"
            size="small"
            @update:model-value="handleBrokenChange"
          />
          <span>模拟中途断流</span>
        </label>
      </div>

      <p class="sse-debug__hint">事件按到达顺序排列，data 保留原始文本；心跳注释不会出现在这里</p>

      <ol v-if="eventCount" class="sse-debug__list">
        <li
          v-for="entry in sseDebugState.entries.value"
          :key="entry.sequence"
          class="sse-debug__item"
        >
          <div class="sse-debug__meta">
            <span class="sse-debug__time">{{ entry.receivedAt }}</span>
            <span class="sse-debug__event">{{ entry.event }}</span>
            <span v-if="entry.id" class="sse-debug__id">id {{ entry.id }}</span>
          </div>
          <pre class="sse-debug__data">{{ entry.data }}</pre>
        </li>
      </ol>

      <p v-else class="sse-debug__empty">发送一条提问后，这里会逐条显示服务端推送的事件</p>
    </div>
  </div>
</template>

<style scoped>
.sse-debug {
  margin: 0 auto 8px;
  width: min(100%, calc(var(--app-chat-max-width) + var(--app-chat-inline-padding) * 2));
  padding: 0 var(--app-chat-inline-padding);
}

.sse-debug__toggle {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  background: var(--el-fill-color-lighter);
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
}

.sse-debug__toggle:hover {
  color: var(--el-text-color-primary);
  border-color: var(--el-color-primary-light-5);
}

.sse-debug__dot {
  width: 6px;
  height: 6px;
  flex: none;
  background: var(--el-color-success);
  border-radius: 50%;
}

.sse-debug__summary {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sse-debug__chevron {
  flex: none;
  color: var(--el-color-primary);
}

.sse-debug__body {
  margin-top: 6px;
  padding: 10px 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.sse-debug__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.sse-debug__field {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.sse-debug__select {
  width: 108px;
}

.sse-debug__hint {
  margin: 8px 0 6px;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.sse-debug__list {
  display: flex;
  max-height: 220px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex-direction: column;
  gap: 4px;
  list-style: none;
}

.sse-debug__item {
  padding: 4px 6px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.sse-debug__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.sse-debug__time {
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

.sse-debug__event {
  color: var(--el-color-primary);
  font-weight: 600;
}

.sse-debug__id {
  color: var(--el-text-color-placeholder);
}

.sse-debug__data {
  margin: 2px 0 0;
  overflow-x: auto;
  color: var(--el-text-color-regular);
  font-family: var(--el-font-family-mono, monospace);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.sse-debug__empty {
  margin: 6px 0 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

@media (max-width: 640px) {
  .sse-debug {
    padding: 0 var(--app-chat-inline-padding);
  }

  .sse-debug__summary {
    display: none;
  }
}
</style>
