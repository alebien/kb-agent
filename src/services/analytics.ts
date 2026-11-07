/**
 * 埋点上报入口
 *
 * 当前只做事件契约、内存缓冲与批量上报的调度骨架，不发送网络请求
 * 接入真实埋点服务时只替换 drain 内部实现，调用方与事件清单不变
 */
import { ANALYTICS_EVENTS, type AnalyticsEvent } from './analytics-events'

export type { AnalyticsEvent }

/** 一条待上报事件，payload 只放脱敏后的业务字段 */
export interface AnalyticsRecord {
  /** 事件名，取值来自事件清单 */
  event: AnalyticsEvent
  /** 事件发生时间，ISO 8601 带时区字符串 */
  occurredAt: string
  /** 事件附带的业务字段，禁止放手机号、姓名全称等敏感信息 */
  payload: Record<string, string | number | boolean | null>
}

/** 缓冲上限，达到后丢弃最早一条，避免长时间离线时无限积压 */
const MAX_BUFFER = 200

/** 本地缓冲，接入真实服务前先存在内存里 */
const buffer: AnalyticsRecord[] = []

/** 事件名白名单，用于拦截未登记的拼写错误 */
const allowedEvents = new Set<string>(ANALYTICS_EVENTS)

/** 记录一条埋点事件；事件名未登记时直接抛错 */
export function track(event: AnalyticsEvent, payload: AnalyticsRecord['payload'] = {}): void {
  if (!allowedEvents.has(event)) {
    throw new Error(`未登记的埋点事件：${event}`)
  }

  buffer.push({ event, occurredAt: new Date().toISOString(), payload })
  if (buffer.length > MAX_BUFFER) {
    buffer.shift()
  }
}

/** 取出并清空当前缓冲，供上报逻辑批量发送 */
export function drain(): AnalyticsRecord[] {
  return buffer.splice(0, buffer.length)
}

/** 当前缓冲里的事件数量，达到上限时应立即触发一次 drain */
export function pendingCount(): number {
  return buffer.length
}
