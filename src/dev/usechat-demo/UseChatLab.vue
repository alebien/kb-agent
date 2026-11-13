<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ChatPanel from './ChatPanel.vue'
import type { RenderMode } from './renderMeter'

/**
 * 第 8 步的外壳
 *
 * 这一层负责三件事：
 * 1. 开关面板 = 卸载组件，用来看 onUnmounted 有没有把连接掐掉（第 7 步的实验）
 * 2. 切换场景（正常 / 5000 字长文本 / 断流 / 500），压测用「长文本」那个
 * 3. 切换渲染模式（纯文本 / Markdown / Markdown + 按帧合并），对比解析次数和帧率
 */

/** 是否挂载聊天面板，取消勾选就是卸载组件 */
const mounted = ref(true)

/** 地址栏里的场景参数，和 ChatPanel 读的是同一个 */
const scenario = computed(() => new URLSearchParams(window.location.search).get('scenario') ?? '')

/** localStorage 里记住的渲染模式键名，切场景会整页刷新，靠它把选择带过去 */
const MODE_STORAGE_KEY = 'step8-render-mode'

/** 四种渲染模式的说明，页面上直接列出来 */
const MODES: Array<{ value: RenderMode; label: string; hint: string }> = [
  { value: 'text', label: '纯文本', hint: 'v-text 直接输出，不解析 Markdown' },
  { value: 'md', label: 'Markdown', hint: '每个 delta 都整体重解析，压测的对照组' },
  { value: 'md-batched', label: 'Markdown + 按帧合并', hint: '一帧最多解析一次' },
  {
    value: 'md-throttled',
    label: 'Markdown + 80ms 节流',
    hint: '每 80ms 最多解析一次，生产用的这种',
  },
]

/** 当前渲染模式，初值取上次的选择，默认是最危险的 md */
const mode = ref<RenderMode>((localStorage.getItem(MODE_STORAGE_KEY) as RenderMode | null) ?? 'md')

/** 记下选择，下次刷新继续用 */
watch(mode, (next) => {
  localStorage.setItem(MODE_STORAGE_KEY, next)
})

/**
 * 换场景：改 query 再重新打开本页
 *
 * @param next 目标场景，空字符串表示正常模式
 */
function useScenario(next: string) {
  window.location.search = next ? `?scenario=${next}` : ''
}
</script>

<template>
  <div class="lab">
    <h1>第 8 步 · 压测：长文本 + Markdown 渲染</h1>
    <p class="tip">
      这一页所有气泡、横幅、状态都来自 <code>src/composables/useChat.ts</code>。 第 8
      步在页面上加了两样东西： 真实 Markdown 渲染（<code>v-html</code>）和一块计量表 ——
      解析次数、平均耗时、实时 FPS。
    </p>

    <div class="row">
      <label class="switch">
        <input v-model="mounted" type="checkbox" />
        挂载聊天面板（取消勾选＝卸载组件）
      </label>
    </div>

    <div class="row">
      <button class="btn" :class="{ active: scenario === '' }" @click="useScenario('')">
        正常
      </button>
      <button class="btn" :class="{ active: scenario === 'long' }" @click="useScenario('long')">
        长文本（6000 字级）
      </button>
      <button class="btn" :class="{ active: scenario === 'broken' }" @click="useScenario('broken')">
        断流（40% 处截断）
      </button>
      <button class="btn" :class="{ active: scenario === '500' }" @click="useScenario('500')">
        服务端 500
      </button>
      <span class="hint">当前场景：{{ scenario || '正常' }}</span>
    </div>

    <div class="row">
      <span class="hint">渲染方式：</span>
      <button
        v-for="item in MODES"
        :key="item.value"
        class="btn"
        :class="{ active: mode === item.value }"
        :title="item.hint"
        @click="mode = item.value"
      >
        {{ item.label }}
      </button>
    </div>

    <p class="tip warn">
      压测步骤：切到「长文本」→ 依次试三种 Markdown 模式，各跑一次，记下解析次数和 FPS。
      注意本地流速只有 64 条/秒（Windows 定时器精度
      15.6ms），一帧大约一条事件，所以「按帧合并」几乎没有可合并的东西； 真正拉开差距的是 80ms
      节流——生产的 MarkdownRenderer.vue 用的就是它。
    </p>

    <p v-if="!mounted" class="tip warn">
      组件已卸载。去 Network 看那条 /api/dev/sse/chat：是不是 canceled。控制台不该有红字。
    </p>

    <ChatPanel v-if="mounted" :mode="mode" />
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 24px 16px 60px;
  background: #f5f6f8;
  color: #1f2328;
  font:
    15px/1.7 system-ui,
    -apple-system,
    'Segoe UI',
    'Microsoft YaHei',
    sans-serif;
}

code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #eceff3;
  font-size: 13px;
}
</style>

<style scoped>
.lab {
  max-width: 820px;
  margin: 0 auto;
}

h1 {
  margin: 0 0 6px;
  font-size: 20px;
}

.tip {
  margin: 0 0 12px;
  color: #6b7178;
  font-size: 13px;
}

.tip.warn {
  padding: 8px 12px;
  border-left: 3px solid #e8a33d;
  background: #fff8e8;
  color: #8a6320;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.switch {
  font-size: 13px;
  color: #3d4248;
}

.btn {
  font: inherit;
  font-size: 13px;
  padding: 5px 12px;
  border: 1px solid #cfd4da;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
}

.btn.active {
  border-color: #2f6feb;
  background: #eef4ff;
  color: #2f6feb;
  font-weight: 600;
}

.hint {
  font-size: 12px;
  color: #8a9199;
}
</style>
