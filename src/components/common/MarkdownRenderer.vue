<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { renderMarkdown } from '@/utils/markdown'
import '@/assets/markdown.css'

/** 流式输出时两次 Markdown 解析的最小间隔，避免每个字符都跑一遍解析与清洗 */
const RENDER_INTERVAL_MS = 80

/** Markdown 渲染参数 */
const props = withDefaults(
  defineProps<{
    /** 待渲染的 Markdown 源码 */
    content: string
    /** 是否处于流式输出中，用于追加光标等样式 */
    streaming?: boolean
  }>(),
  {
    streaming: false,
  },
)

/** 上一次真正执行解析的时间戳，用于节流判断 */
let lastRenderedAt = 0
/** 节流等待中的定时器，非流式或卸载时需要清理 */
let renderTimer: ReturnType<typeof setTimeout> | undefined
/** 已清洗的安全 HTML，与原始 Markdown 解耦，流式时按节流频率更新 */
const html = ref(renderMarkdown(props.content as string))

/** 立即解析并刷新渲染结果 */
function renderNow() {
  if (renderTimer !== undefined) {
    clearTimeout(renderTimer)
    renderTimer = undefined
  }

  lastRenderedAt = performance.now()
  html.value = renderMarkdown(props.content)
}

// 流式时按 80ms 节流，保证首字延迟低又不会整段重排；结束后立即补齐最终内容
watch(
  () => [props.content, props.streaming] as const,
  () => {
    if (!props.streaming) {
      renderNow()
      return
    }

    /** 距离上次解析已经过去的毫秒数 */
    const elapsed = performance.now() - lastRenderedAt
    if (elapsed >= RENDER_INTERVAL_MS) {
      renderNow()
      return
    }

    if (renderTimer === undefined) {
      renderTimer = setTimeout(renderNow, RENDER_INTERVAL_MS - elapsed)
    }
  },
)

onBeforeUnmount(() => {
  if (renderTimer !== undefined) {
    clearTimeout(renderTimer)
    renderTimer = undefined
  }
})
</script>

<template>
  <div class="markdown-body" :class="{ 'is-streaming': streaming }" v-html="html" />
</template>
