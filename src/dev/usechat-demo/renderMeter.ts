import { computed, onUnmounted, ref, type Ref } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

/**
 * 第 8 步的渲染计量
 *
 * 压测时要回答的是两个数：Markdown 解析被调用了多少次、每次花多久。
 * 把它们放在模块级单例里，页面里任何地方调用 countedRenderMarkdown 都会累计，
 * 不需要一路传 ref
 */

/** 渲染模式：纯文本 / 每段重渲染 / 按帧合并 / 按时间窗口节流 */
export type RenderMode = 'text' | 'md' | 'md-batched' | 'md-throttled'

/** Markdown 解析与清洗的累计调用次数，等价于「重渲染了多少次」 */
const parseCount = ref(0)

/** Markdown 解析与清洗的累计耗时，单位毫秒 */
const parseCostMs = ref(0)

/**
 * 计量版 Markdown 渲染
 *
 * 逻辑和 renderMarkdown 完全一样，只是在前后各记一笔，
 * 用来把「每个 delta 都重渲染」这件事变成可以数的数字
 *
 * @param source 待渲染的 Markdown 源码
 * @returns 已清洗的 HTML
 */
export function countedRenderMarkdown(source: string): string {
  /** 本次解析开始的时间戳 */
  const startedAt = performance.now()
  /** 解析并清洗后的 HTML */
  const html = renderMarkdown(source)
  parseCount.value += 1
  parseCostMs.value += performance.now() - startedAt
  return html
}

/** 把计数清零，每次重新压测前调用，否则数字会一直累加 */
export function resetRenderMeter() {
  parseCount.value = 0
  parseCostMs.value = 0
}

/** 渲染计量的只读视图，页面直接绑定 */
export interface RenderMeter {
  /** 累计解析次数 */
  parseCount: Ref<number>
  /** 累计解析耗时，毫秒 */
  parseCostMs: Ref<number>
  /** 平均每次解析耗时，毫秒，没有解析过时为 0 */
  averageMs: Ref<number>
}

/** 取渲染计量的只读视图 */
export function useRenderMeter(): RenderMeter {
  /** 平均每次解析耗时，没解析过时为 0 */
  const averageMs = computed(() =>
    parseCount.value === 0 ? 0 : parseCostMs.value / parseCount.value,
  )

  return {
    parseCount,
    parseCostMs,
    averageMs,
  }
}

/**
 * 页面内的帧率表
 *
 * 用 requestAnimationFrame 数帧，每 500ms 结算一次。
 * 它不能替代 Performance 面板（面板看的是主线程长任务），
 * 但能把「掉帧」实时显示在页面上，不用来回切窗口
 */
export function useFpsMeter() {
  /** 最近一次结算的帧率 */
  const fps = ref(0)

  /** 本轮已经数到的帧数 */
  let frames = 0
  /** 本轮开始计时的时间戳 */
  let windowStartedAt = performance.now()
  /** rAF 的句柄，卸载时取消 */
  let handle = 0

  /** 每帧调一次，够 500ms 就结算 */
  const tick = () => {
    frames += 1
    /** 当前时间戳 */
    const now = performance.now()
    /** 本轮已经过去的毫秒数 */
    const elapsed = now - windowStartedAt
    if (elapsed >= 500) {
      fps.value = Math.round((frames * 1000) / elapsed)
      frames = 0
      windowStartedAt = now
    }
    handle = requestAnimationFrame(tick)
  }

  handle = requestAnimationFrame(tick)

  onUnmounted(() => {
    cancelAnimationFrame(handle)
  })

  return { fps }
}
