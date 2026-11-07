/** 时间格式化工具，全站唯一的展示层转换出口 */

const pad = (value: number) => String(value).padStart(2, '0')

/** 把 Date 转成本地时区的 ISO 8601 字符串，带 +08:00 形式的时区偏移 */
export function toLocalIsoString(date: Date = new Date()): string {
  /** 与 UTC 的分钟差，东八区为 -480 */
  const offsetMinutes = date.getTimezoneOffset()
  /** 取反后得到国内习惯的 +08:00 偏移 */
  const offset = -offsetMinutes
  /** 偏移符号，东区为正 */
  const sign = offset >= 0 ? '+' : '-'
  /** 偏移的绝对小时数 */
  const hours = pad(Math.floor(Math.abs(offset) / 60))
  /** 偏移的绝对分钟数 */
  const minutes = pad(Math.abs(offset) % 60)

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${hours}:${minutes}`
  )
}

/** 把 ISO 8601 字符串格式化为 `YYYY-MM-DD HH:mm`，无法解析时原样返回 */
export function formatDateTime(iso: string): string {
  /** 解析后的时间对象 */
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** 只取 ISO 8601 字符串的日期部分 `YYYY-MM-DD`，无法解析时原样返回 */
export function formatDate(iso: string): string {
  /** 解析后的时间对象 */
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 把毫秒数格式化为便于阅读的耗时文案，例如 `2.4s` */
export function formatDuration(milliseconds: number): string {
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(1)}s`
    : `${Math.round(milliseconds)}ms`
}
