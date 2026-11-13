<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChat, type ChatStatus } from '@/composables/useChat'

/**
 * 第 6 步的聊天面板
 *
 * 这一页本身没有任何流式逻辑：全部来自 useChat()。
 * 你要验证的就是「composable 换个地方还能用」，所以这里不许出现 fetch / reader / 解析器
 */

/** 地址栏里的场景参数，?scenario=broken 时 mock 服务会在生成到 40% 时发一条 error 事件 */
const scenario = new URLSearchParams(window.location.search).get('scenario')

/** 本次请求的接口地址：断流模式带上 query，其余用默认地址 */
const url = scenario === 'broken' ? '/api/dev/sse/chat?scenario=broken' : '/api/dev/sse/chat'

/** 清单里要求的 4 个状态 + 4 个动作，全部由 composable 提供 */
const { content, citations, status, error, send, stop, retry, reset } = useChat({ url })

/** 输入框内容，属于页面自己的状态，不该塞进 composable */
const prompt = ref('发票怎么换开')

/** 是否有请求在跑，用来控制按钮可用状态 */
const busy = computed(() => status.value === 'sending' || status.value === 'streaming')

/** 每个状态的中文名与说明：单值状态的好处是界面表现一张表就列完了 */
const STATUS_META: Record<ChatStatus, { label: string; hint: string }> = {
  idle: { label: '空闲', hint: '没有请求在跑，「说完」之后也回到这里' },
  sending: { label: '发送中', hint: 'fetch 在飞，响应头还没回来' },
  streaming: { label: '接收中', hint: '头回来了，正在一块块读字节' },
  stopped: { label: '已停止', hint: 'abort 抛了 AbortError，不是故障' },
  failed: { label: '失败', hint: '网络、HTTP 非 2xx，或服务端 error 事件' },
}

/** 当前状态对应的展示信息 */
const meta = computed(() => STATUS_META[status.value])

/** 状态流转记录，每变一次追加一行，用来看单值状态怎么一步一步走 */
const transitions = ref<string[]>(['（还没开始）'])

// 每次状态变化都留痕，比 console 好用，刷新页面也不会丢上一轮顺序
watch(status, (next, previous) => {
  transitions.value.push(`${previous} → ${next}`)
})

/** 正文当前字符数：脚本里读 ref 必须 .value，这一步最容易漏 */
const contentLength = computed(() => content.value.length)
</script>

<template>
  <section class="panel">
    <div class="row">
      <input
        v-model="prompt"
        class="input"
        placeholder="问点什么"
        :disabled="busy"
        @keyup.enter="send(prompt)"
      />
      <button class="btn primary" :disabled="busy" @click="send(prompt)">发送</button>
      <button class="btn" :disabled="!busy" @click="stop()">停止</button>
      <button class="btn" @click="retry()">重试</button>
      <button class="btn" @click="reset()">清空</button>
    </div>

    <p class="status">
      状态：<strong class="badge" :class="`is-${status}`">{{ meta.label }}</strong>
      <span class="hint">{{ meta.hint }}</span>
    </p>

    <p v-if="error" class="error">error：{{ error }}</p>

    <div class="content">{{ content }}<span v-if="busy" class="cursor">▌</span></div>

    <p class="meta">字符数：{{ contentLength }}　引用：{{ citations.length }} 条</p>

    <ul v-if="citations.length" class="citations">
      <li v-for="item in citations" :key="item.id">
        <strong>{{ item.name }}</strong>
        <span v-if="item.page"> · 第 {{ item.page }} 页</span>
        <span v-if="item.score"> · 相似度 {{ item.score }}</span>
        <p class="snippet">{{ item.snippet }}</p>
      </li>
    </ul>

    <details class="log" open>
      <summary>状态流转（{{ transitions.length }} 条）</summary>
      <ol>
        <li v-for="(item, index) in transitions" :key="index">{{ item }}</li>
      </ol>
    </details>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid #e3e6ea;
  border-radius: 10px;
  padding: 14px;
  background: #fff;
}

.row {
  display: flex;
  flex-wrap: wrap;
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

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.status {
  margin: 12px 0 6px;
  font-size: 14px;
}

.badge {
  padding: 1px 8px;
  border-radius: 999px;
  background: #eef1f4;
  font-weight: 600;
}

.badge.is-sending {
  background: #fff4d6;
}

.badge.is-streaming {
  background: #e2f0ff;
}

.badge.is-stopped {
  background: #eceff3;
}

.badge.is-failed {
  background: #ffe3e3;
}

.hint {
  margin-left: 8px;
  color: #8a9199;
  font-size: 12px;
}

.error {
  margin: 6px 0;
  color: #c92a2a;
  font-size: 13px;
}

.content {
  min-height: 96px;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  background: #fafbfc;
  white-space: pre-wrap;
  line-height: 1.75;
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

.meta {
  margin: 8px 0 0;
  color: #8a9199;
  font-size: 12px;
}

.citations {
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 13px;
}

.snippet {
  margin: 2px 0 6px;
  color: #6b7178;
}

.log {
  margin-top: 12px;
  font-size: 12px;
  color: #6b7178;
}

.log ol {
  margin: 6px 0 0;
  padding-left: 20px;
}
</style>
