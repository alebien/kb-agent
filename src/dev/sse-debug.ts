import { readonly, ref } from 'vue'

/**
 * SSE 开发调试状态
 *
 * 只在开发环境使用，用来观察原始事件、切换分片粒度与模拟断流；
 * 接入真实后端后可以整目录删除，不影响业务代码
 */

/** 调试面板记录的单条事件，保存展示所需的最小字段 */
export interface SseDebugEntry {
  /** 自增序号，便于对照事件到达顺序 */
  sequence: number
  /** 事件名，解析失败时记为 raw */
  event: string
  /** 事件 id，服务端未提供时为空字符串 */
  id: string
  /** 事件负载原文，保留原始换行便于观察多行 data */
  data: string
  /** 事件到达时间，格式为 HH:mm:ss.SSS */
  receivedAt: string
}

/** 调试面板最多保留的事件条数，避免长时间运行占满内存 */
const MAX_ENTRIES = 200

/** 当前请求的分片大小，null 表示使用服务端默认值 */
const chunkSize = ref<number | null>(null)
/** 是否模拟生成中途断流 */
const simulateBroken = ref(false)
/** 最近一次流式请求的事件记录，按到达顺序追加 */
const entries = ref<SseDebugEntry[]>([])
/** 事件序号，跨请求持续递增，便于区分不同轮次 */
let sequence = 0

/** 生成带毫秒的时间文本，面板只需要时分秒 */
function formatClock(date: Date): string {
  /** 时、分、秒与毫秒，统一补零到固定宽度 */
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${milliseconds}`
}

/** 清空上一轮请求的事件记录，发送新提问时调用 */
export function resetSseDebugEntries(): void {
  entries.value = []
  sequence = 0
}

/**
 * 追加一条原始事件
 *
 * @param raw 事件原文，保留字段顺序与换行
 */
export function recordSseDebugEntry(raw: string): void {
  /** 从原文中读取事件名，缺失时回退为 message */
  const eventMatch = /^event:\s*(.+)$/m.exec(raw)
  /** 从原文中读取事件 id，缺失时为空字符串 */
  const idMatch = /^id:\s*(.+)$/m.exec(raw)
  /** 多行 data 按协议拼接成一条负载 */
  const dataLines = Array.from(raw.matchAll(/^data:\s?(.*)$/gm), (match) => match[1] ?? '')
  sequence += 1

  entries.value.push({
    sequence,
    event: eventMatch?.[1]?.trim() || 'message',
    id: idMatch?.[1]?.trim() || '',
    data: dataLines.join('\n'),
    receivedAt: formatClock(new Date()),
  })

  // 超出上限时丢弃最早的事件，保留最近一轮的观察窗口
  if (entries.value.length > MAX_ENTRIES) {
    entries.value.splice(0, entries.value.length - MAX_ENTRIES)
  }
}

/**
 * 按当前调试开关拼接流式地址
 *
 * @param url 基础地址
 * @returns 带 scenario 与 chunkSize 的地址，未开启开关时原样返回
 */
export function buildSseDebugUrl(url: string): string {
  /** 本次请求需要追加的查询参数 */
  const params = new URLSearchParams()

  if (simulateBroken.value) {
    params.set('scenario', 'broken')
  }

  if (chunkSize.value !== null) {
    params.set('chunkSize', String(chunkSize.value))
  }

  const query = params.toString()
  return query ? `${url}?${query}` : url
}

/** 调试面板绑定的只读状态，组件不直接修改内部引用 */
export const sseDebugState = {
  chunkSize: readonly(chunkSize),
  simulateBroken: readonly(simulateBroken),
  entries: readonly(entries),
}

/** 更新分片大小，null 表示恢复服务端默认值 */
export function setSseDebugChunkSize(value: number | null): void {
  chunkSize.value = value
}

/** 切换断流模拟开关 */
export function setSseDebugBroken(value: boolean): void {
  simulateBroken.value = value
}
