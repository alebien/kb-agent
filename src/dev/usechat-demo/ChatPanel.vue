<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useChat, type MessageStatus } from '@/composables/useChat'
import {
  countedRenderMarkdown,
  resetRenderMeter,
  useFpsMeter,
  useRenderMeter,
  type RenderMode,
} from './renderMeter'
import '@/assets/markdown.css'

/**
 * 第 7、8 步的聊天面板
 *
 * 这一页依旧没有流式逻辑：fetch / reader / 解析器全在 useChat 里。
 * 页面只做两件事：把 messages 画成气泡，把 notice 画成横幅
 *
 * 第 8 步新增了三种渲染模式，用来对比「每个 delta 都重渲染 Markdown」的代价：
 * text 是纯文本（第 7 步的样子），md 是每来一段就整体重渲染，md-batched 是按帧合并
 */

/** 页面外壳传进来的渲染模式 */
const props = withDefaults(
  defineProps<{
    /** 当前渲染模式 */
    mode?: RenderMode
  }>(),
  {
    mode: 'text',
  },
)

// 地址栏的查询串原样转发给接口：这样在地址栏临时加 ?scenario=long&chars=12000&chunkSize=2
// 就能换更狠的压测参数，不用改代码
/** 本次请求的接口地址，带场景时拼到 query 上 */
const url = `/api/dev/sse/chat${window.location.search}`

/** 消息列表、横幅、在线状态与四个动作，全部由 composable 提供 */
const { messages, notice, online, busy, send, stop, retry, reset } = useChat({ url })

/** 输入框内容，属于页面自己的状态，不该塞进 composable */
const prompt = ref('发票怎么换开')

/** 每个状态的中文名与说明：状态挂在消息上，徽章直接查表 */
const STATUS_META: Record<MessageStatus, { label: string; hint: string }> = {
  sending: { label: '发送中', hint: 'fetch 在飞，响应头还没回来' },
  streaming: { label: '接收中', hint: '头回来了，正在一块块读字节' },
  done: { label: '已完成', hint: '收到了 event: done' },
  failed: { label: '失败', hint: '网络、HTTP 非 2xx、服务端 error，或流被截断' },
  stopped: { label: '已停止', hint: 'abort 抛了 AbortError，不是故障' },
}

/** 横幅标题：三种 kind 各说一件事，别都写成「出错了」 */
const NOTICE_TITLE: Record<string, string> = {
  offline: '离线',
  broken: '连接中断',
  recovered: '已恢复',
}

/** 能不能点重发：只有失败或停止的那条才能重发 */
function canRetry(status: MessageStatus): boolean {
  return status === 'failed' || status === 'stopped'
}

/** 正文当前的字符总数，用来看重试时旧内容有没有被清干净 */
const totalLength = computed(() =>
  messages.value.reduce((sum, message) => sum + message.content.length, 0),
)

/** Markdown 解析次数、累计耗时与平均耗时，用来数「重渲染了多少次」 */
const { parseCount, averageMs } = useRenderMeter()

/** 页面内的实时帧率，压测时不用来回切到 Performance 面板 */
const { fps } = useFpsMeter()

/** 已经渲染好的 HTML，按消息 id 存；整体替换才能让 v-html 跟着更新 */
const htmlById = ref<Record<string, string>>({})

/** 排队中的帧句柄，null 表示当前没有待渲染的帧 */
let frameHandle: number | null = null

/** 时间节流的窗口长度，和生产的 MarkdownRenderer.vue 保持一致 */
const THROTTLE_MS = 80

/** 时间节流的定时器，窗口内只渲染一次 */
let throttleTimer: ReturnType<typeof setTimeout> | null = null

/** 把每条助手消息整体重渲染一遍，这一步就是压测里说的「全量解析」 */
function renderAll() {
  /** 本次渲染出的新映射 */
  const next: Record<string, string> = {}

  for (const message of messages.value) {
    if (message.role !== 'assistant') {
      continue
    }
    next[message.id] = countedRenderMarkdown(message.content)
  }

  htmlById.value = next
}

/** 按当前模式决定什么时候重渲染：md 立刻渲染，md-batched 一帧最多一次，md-throttled 80ms 一次 */
function scheduleRender() {
  if (props.mode === 'text') {
    return
  }

  if (props.mode === 'md') {
    renderAll()
    return
  }

  if (props.mode === 'md-throttled') {
    // 窗口内只认第一次：后面 80ms 内到的片都等这个窗口结束时一起渲染
    if (throttleTimer !== null) {
      return
    }

    throttleTimer = setTimeout(() => {
      throttleTimer = null
      renderAll()
    }, THROTTLE_MS)
    return
  }

  // 同一帧里已经在排队了就不再排，这就是「合并」的全部含义
  if (frameHandle !== null) {
    return
  }

  frameHandle = requestAnimationFrame(() => {
    frameHandle = null
    renderAll()
  })
}

// 消息 id 与正文长度一起看：id 变化（tmp → srv）也要重渲染，否则气泡会空一瞬；
// 用长度而不是全文，是因为这个 watch 每来一段字都要跑一次，别在里面复制 6000 字
watch(
  () => messages.value.map((message) => `${message.id}｜${message.content.length}`),
  () => scheduleRender(),
  { flush: 'post' },
)

// 中途切换渲染模式时补一次渲染，否则 md 气泡在下一段字到达前是空的
watch(
  () => props.mode,
  () => scheduleRender(),
)

/** 发消息前清零计数，每次压测从 0 开始 */
function handleSend(text: string) {
  resetRenderMeter()
  htmlById.value = {}
  void send(text)
}

/** 重发前同样清零，否则数字会接着上一轮累加 */
function handleRetry(messageId: string) {
  resetRenderMeter()
  htmlById.value = {}
  void retry(messageId)
}

/** 清空对话时把渲染结果与计数一起清掉 */
function handleReset() {
  reset()
  resetRenderMeter()
  htmlById.value = {}
}

onUnmounted(() => {
  if (frameHandle !== null) {
    cancelAnimationFrame(frameHandle)
  }

  if (throttleTimer !== null) {
    clearTimeout(throttleTimer)
  }
})
</script>

<template>
  <section class="panel">
    <div v-if="notice" class="banner" :class="`is-${notice.kind}`">
      <strong>{{ NOTICE_TITLE[notice.kind] }}</strong>
      <span>{{ notice.text }}</span>
    </div>

    <div class="row">
      <input
        v-model="prompt"
        class="input"
        placeholder="问点什么"
        :disabled="busy"
        @keyup.enter="handleSend(prompt)"
      />
      <button class="btn primary" :disabled="busy" @click="handleSend(prompt)">发送</button>
      <button class="btn" :disabled="!busy" @click="stop()">停止</button>
      <button class="btn" @click="handleReset()">清空</button>
      <span class="net" :class="{ 'is-off': !online }">{{ online ? '在线' : '离线' }}</span>
    </div>

    <p class="meta">
      气泡 {{ messages.length }} 条　正文字符 {{ totalLength }}　解析 {{ parseCount }} 次　平均
      {{ averageMs.toFixed(2) }} ms　FPS <strong :class="{ 'is-low': fps < 50 }">{{ fps }}</strong>
    </p>

    <ul class="bubbles">
      <li
        v-for="message in messages"
        :key="message.id"
        class="bubble"
        :class="[`is-${message.role}`, `is-${message.status}`]"
      >
        <div class="head">
          <span class="who">{{ message.role === 'user' ? '我' : '助手' }}</span>
          <span class="badge" :class="`is-${message.status}`">
            {{ STATUS_META[message.status].label }}
          </span>
          <code class="id">{{ message.id }}</code>
        </div>

        <p v-if="message.error" class="error">{{ message.error }}</p>

        <!-- 用户气泡永远是纯文本；助手气泡在纯文本模式下也走同一条分支 -->
        <div v-if="message.role === 'user' || mode === 'text'" class="body">
          {{ message.content }}<span v-if="message.status === 'streaming'" class="cursor">▌</span>
        </div>

        <!-- md 模式的正文是整段替换的 HTML，不再是文本节点 -->
        <div v-else class="md-body">
          <div v-html="htmlById[message.id] ?? ''"></div>
          <span v-if="message.status === 'streaming'" class="cursor">▌</span>
        </div>

        <button v-if="canRetry(message.status)" class="btn small" @click="handleRetry(message.id)">
          重发这条
        </button>

        <ul v-if="message.citations.length" class="citations">
          <li v-for="item in message.citations" :key="item.id">
            <strong>{{ item.name }}</strong>
            <span v-if="item.page"> · 第 {{ item.page }} 页</span>
            <span v-if="item.score"> · 相似度 {{ item.score }}</span>
          </li>
        </ul>
      </li>
    </ul>

    <p v-if="!messages.length" class="empty">还没有消息，点发送试试</p>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid #e3e6ea;
  border-radius: 10px;
  padding: 14px;
  background: #fff;
}

.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.banner.is-offline {
  background: #ffe3e3;
  color: #a12121;
}

.banner.is-broken {
  background: #fff4d6;
  color: #8a6320;
}

.banner.is-recovered {
  background: #e6f6ec;
  color: #1f7a45;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.input {
  flex: 1 1 220px;
  font: inherit;
  padding: 7px 10px;
  border: 1px solid #cfd4da;
  border-radius: 7px;
}

.btn {
  font: inherit;
  padding: 7px 14px;
  border: 1px solid #cfd4da;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
}

.btn.primary {
  background: #2f6feb;
  border-color: #2f6feb;
  color: #fff;
}

.btn.small {
  padding: 3px 10px;
  font-size: 12px;
  align-self: flex-start;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.net {
  margin-left: auto;
  font-size: 12px;
  color: #1f7a45;
}

.net.is-off {
  color: #c92a2a;
  font-weight: 600;
}

.meta {
  margin: 10px 0 6px;
  color: #8a9199;
  font-size: 12px;
}

/* 帧率低于 50 时标红，和清单里的验收标准对齐 */
.meta .is-low {
  color: #c92a2a;
}

.bubbles {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bubble {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 88%;
  padding: 9px 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fafbfc;
}

/* 用户消息靠右、蓝底；助手消息靠左、灰底 */
.bubble.is-user {
  align-self: flex-end;
  background: #eef4ff;
  border-color: #d6e3ff;
}

.bubble.is-failed {
  border-color: #f2a6a6;
  background: #fff6f6;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7178;
}

.who {
  font-weight: 600;
  color: #3d4248;
}

.badge {
  padding: 1px 7px;
  border-radius: 999px;
  background: #eef1f4;
}

.badge.is-sending {
  background: #fff4d6;
}

.badge.is-streaming {
  background: #e2f0ff;
}

.badge.is-done {
  background: #e6f6ec;
}

.badge.is-failed {
  background: #ffe3e3;
  color: #a12121;
}

.id {
  margin-left: auto;
  padding: 0 5px;
  border-radius: 4px;
  background: #eceff3;
  font-size: 11px;
}

.error {
  margin: 0;
  color: #c92a2a;
  font-size: 12px;
}

.body {
  white-space: pre-wrap;
  line-height: 1.75;
}

/* Markdown 正文不能继承 pre-wrap，否则块级元素之间会多出空白 */
.md-body {
  line-height: 1.75;
}

.md-body :deep(h2),
.md-body :deep(h3) {
  margin: 0.6em 0 0.3em;
  font-size: 15px;
}

.md-body :deep(table) {
  border-collapse: collapse;
  font-size: 13px;
}

.md-body :deep(th),
.md-body :deep(td) {
  padding: 4px 8px;
  border: 1px solid #dde1e6;
}

.md-body :deep(blockquote) {
  margin: 0.4em 0;
  padding: 2px 10px;
  border-left: 3px solid #d6dbe1;
  color: #6b7178;
}

.cursor {
  color: #2f6feb;
  animation: blink 1s steps(2) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.citations {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: #6b7178;
}

.empty {
  margin: 8px 0 0;
  color: #8a9199;
  font-size: 13px;
}
</style>
