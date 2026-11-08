/**
 * SSE 流式传输的通用实现
 *
 * 为什么不直接用 EventSource：本项目的流式问答需要 POST 请求体、自定义请求头
 * 和主动中断，而 EventSource 只支持 GET、不能设置请求头，且无法传 body
 * 因此这里基于 fetch + ReadableStream 手写解析，EventSource 只适合公开的只读通知流
 */

/** 事件分隔符，规范要求用空行结束一个事件，这里同时兼容 \r\n 与 \r 换行 */
const EVENT_SEPARATOR = /\r\n\r\n|\n\n|\r\r/

/** 单行换行符，部分网关会把 \n 改写成 \r\n，需要统一处理 */
const LINE_SEPARATOR = /\r\n|\n|\r/

/** 解析后的单个 SSE 事件 */
export interface SseEvent {
  /** 事件名，服务端未声明时为 message */
  event: string
  /** 事件 id，服务端用它支持断线续传，未声明时为空 */
  id?: string
  /** 事件负载，多行 data 已按换行拼接 */
  data: string
  /** 服务端建议的重连间隔，单位毫秒 */
  retry?: number
}

/** 事件回调附带的连接信息 */
export interface SseMeta {
  /** 最近一次收到的事件 id，断线重连时作为 Last-Event-ID 带回服务端 */
  lastEventId: string
}

/** 流式请求的事件回调 */
export interface SseHandlers {
  /** 收到一个完整事件；回调内抛错会中断整个流并让 Promise reject */
  onEvent: (event: SseEvent, meta: SseMeta) => void
  /** 响应头已返回且确认是事件流，适合在这里收起 loading 态 */
  onOpen?: (response: Response) => void
}

/** 流式请求的可选项 */
export interface SseOptions {
  /** 中断信号，用户点停止或离开页面时传入 */
  signal?: AbortSignal
}

/**
 * 解析一段事件原文
 *
 * @param raw 以空行结尾之前的事件文本，可能包含多行 data 与注释行
 * @returns 解析结果，没有 data 字段的事件返回 null（心跳与纯 id 事件不产生回调）
 */
export function parseEventBlock(raw: string): SseEvent | null {
  /** 事件名，服务端未声明时按规范回落到 message */
  let event = 'message'
  /** 事件 id，未声明时保持 undefined，避免覆盖上一次的 id */
  let id: string | undefined
  /** 服务端建议的重连间隔 */
  let retry: number | undefined
  /** 多行 data，按规范用换行拼接 */
  const dataLines: string[] = []
  /** 是否出现过 data 字段，没有 data 的事件不需要回调 */
  let hasData = false

  for (const line of raw.split(LINE_SEPARATOR)) {
    // 空行与注释行（心跳）不参与字段解析
    if (!line || line.startsWith(':')) {
      continue
    }

    /** 冒号位置，-1 表示这一行只有字段名没有值 */
    const colonIndex = line.indexOf(':')
    /** 字段名 */
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex)
    /** 字段值 */
    let value = colonIndex === -1 ? '' : line.slice(colonIndex + 1)
    // 规范要求去掉冒号后的一个前导空格
    if (value.startsWith(' ')) {
      value = value.slice(1)
    }

    if (field === 'data') {
      dataLines.push(value)
      hasData = true
    } else if (field === 'event') {
      event = value
    } else if (field === 'id') {
      id = value
    } else if (field === 'retry') {
      /** 解析后的重连间隔，非数字时忽略这一行 */
      const parsedRetry = Number(value)
      if (Number.isFinite(parsedRetry)) {
        retry = parsedRetry
      }
    }
  }

  if (!hasData) {
    return null
  }

  return { event, id, retry, data: dataLines.join('\n') }
}

/**
 * 把事件的 data 按 JSON 解析成强类型负载
 *
 * @param event 已解析的事件
 * @returns 反序列化后的负载
 */
export function readEventData<T>(event: SseEvent): T {
  try {
    return JSON.parse(event.data) as T
  } catch {
    throw new Error(`事件 ${event.event} 的 data 不是合法 JSON`)
  }
}

/**
 * 发起流式请求并逐个回调事件
 *
 * 正常收到服务端关闭连接时 resolve；网络失败、HTTP 非 2xx、事件回调抛错
 * 以及主动中断都会 reject，由调用方区分「停止」与「失败」
 *
 * @param url 接口地址
 * @param init 请求配置，方法与请求体由调用方决定
 * @param handlers 事件回调
 * @param options 中断信号等可选项
 */
export async function streamSse(
  url: string,
  init: RequestInit,
  handlers: SseHandlers,
  options: SseOptions = {},
): Promise<void> {
  /** 流式响应，拿到 response 时 headers 已返回、body 还在持续推送 */
  const response = await fetch(url, {
    ...init,
    signal: options.signal,
    headers: {
      // 声明期望事件流，缺了部分框架会按普通 JSON 返回，表现为「不流式」
      Accept: 'text/event-stream',
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`流式请求失败：HTTP ${response.status}`)
  }

  // 没有 body 通常说明接口被网关或 mock 层改写成了普通响应
  if (!response.body) {
    throw new Error('流式请求失败：响应体为空')
  }

  handlers.onOpen?.(response)

  /** 最近一次收到的事件 id，随每个事件回调出去 */
  let lastEventId = ''

  /** 解析并分发一段事件原文 */
  const dispatch = (raw: string) => {
    /** 本次解析出的事件 */
    const parsed = parseEventBlock(raw)
    if (!parsed) {
      return
    }
    if (parsed.id) {
      lastEventId = parsed.id
    }
    handlers.onEvent(parsed, { lastEventId })
  }

  /** UTF-8 解码器，stream 选项保证多字节字符不会被 chunk 边界切坏 */
  const decoder = new TextDecoder()
  /** 响应体字节读取器，一次 read 对应一次网络到达，不等于一个事件 */
  const reader = response.body.getReader()
  /** 跨 chunk 的残留文本，事件被切开时先留在这里 */
  let buffer = ''

  try {
    while (true) {
      /** 本次读取结果，done 为 true 表示服务端已关闭连接 */
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // 一次 read 可能带回多个事件，循环切到切不动为止
      /** 分隔符匹配结果 */
      let match: RegExpExecArray | null
      while ((match = EVENT_SEPARATOR.exec(buffer)) !== null) {
        /** 分隔符之前的完整事件原文 */
        const rawEvent = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        dispatch(rawEvent)
      }
    }

    // 收尾：先冲出解码器残留字节，再处理最后一段可能缺少空行结尾的事件
    buffer += decoder.decode()
    if (buffer.trim()) {
      dispatch(buffer)
    }
  } catch (error) {
    // 中断或解析抛错时取消响应体，尽早释放连接而不是等垃圾回收
    void reader.cancel().catch(() => undefined)
    throw error
  }
}
