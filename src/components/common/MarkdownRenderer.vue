<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
/** 渲染容器引用，用于给本次新增的文字补过渡动画 */
const bodyRef = ref<HTMLElement>()
/** 上一次渲染后容器内的纯文本长度，用来定位本次新增的字符数 */
let renderedTextLength = 0

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

/**
 * 给本次新增的尾部文字包一层 span
 *
 * 流式渲染每次都整块替换 innerHTML，新增字符会硬切上屏；
 * 这里从尾部按纯文本长度回推出刚出现的字符，单独套上淡入动画，
 * 让跳字变成短促的过渡而不是闪一下
 *
 * @param container Markdown 渲染容器
 */
function markNewText(container: HTMLElement) {
  /** 当前容器内的纯文本总长度 */
  const total = (container.textContent ?? '').length
  /** 相比上一次渲染新增的字符数 */
  const added = total - renderedTextLength
  renderedTextLength = total

  // 非流式、内容回退或一次性替换大段内容时保持原样
  if (!props.streaming || added <= 0 || added > 400) {
    return
  }

  /** 容器内所有文本节点，按文档顺序排列 */
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  /** 收集到的文本节点 */
  const nodes: Text[] = []

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text)
  }

  /** 还需要包裹的字符数，从尾部向前分配 */
  let remaining = added

  for (let index = nodes.length - 1; index >= 0 && remaining > 0; index -= 1) {
    /** 当前文本节点 */
    const node = nodes[index]!
    /** 本次在该节点内需要包裹的字符数 */
    const take = Math.min(remaining, node.data.length)

    if (take === 0) {
      continue
    }

    /** 新字符在该节点内的起始下标 */
    const start = node.data.length - take
    /** 承载新增字符的过渡容器 */
    const span = document.createElement('span')
    span.className = 'markdown-stream-chunk'
    span.textContent = node.data.slice(start)
    node.data = node.data.slice(0, start)
    node.after(span)
    remaining -= take
  }
}

// 等 v-html 更新完 DOM 后再定位新增字符，避免在旧节点上做标记
watch(
  html,
  () => {
    /** 当前渲染容器 */
    const container = bodyRef.value
    if (container) {
      markNewText(container)
    }
  },
  { flush: 'post' },
)

onMounted(() => {
  renderedTextLength = bodyRef.value?.textContent?.length ?? 0
})

onBeforeUnmount(() => {
  if (renderTimer !== undefined) {
    clearTimeout(renderTimer)
    renderTimer = undefined
  }
})
</script>

<template>
  <div ref="bodyRef" class="markdown-body" :class="{ 'is-streaming': streaming }" v-html="html" />
</template>
