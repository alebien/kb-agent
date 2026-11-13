import { onUnmounted, ref, type Ref } from 'vue'
import type { Citation } from '@/domain/citation'

/**
 * 第 6 步：把前 5 步的 SSE 逻辑收成一个可复用的 composable
 *
 * 只依赖 vue，不碰 vue-router、不碰 store，所以任何组件里一行
 * `const { content, status, send } = useChat()` 就能用。
 * 验证页面：`pnpm dev` 之后打开 http://localhost:5173/usechat-demo.html
 */

/** 流式接口默认地址，开发环境由 dev/mock-sse-server.ts 这个 Vite 插件提供真实事件流 */
const DEFAULT_URL = '/api/dev/sse/chat'

/** 单值状态：同一时刻只能是其中一个，避免 isLoading 与 isError 同时为 true 这种非法组合 */
export type ChatStatus = 'idle' | 'sending' | 'streaming' | 'stopped' | 'failed'

/** 创建 composable 时的可选配置 */
export interface UseChatOptions {
  /** 流式接口地址，接真实后端时换掉，不传就用开发接口 */
  url?: string
}

/** useChat 对外暴露的状态与动作 */
export interface UseChatReturn {
  /** 助手回答正文，随每个 delta 增长（脚本里要 .value，模板里 Vue 自动解包） */
  content: Ref<string>
  /** 回答引用的知识来源，citation 事件到达时追加 */
  citations: Ref<Citation[]>
  /** 当前所处的单值状态 */
  status: Ref<ChatStatus>
  /** 失败原因，非失败态为空字符串 */
  error: Ref<string>
  /** 发送提问，Promise 在流结束、停止或失败之后才 resolve */
  send: (prompt: string) => Promise<void>
  /** 停止生成：掐断连接，不是改个状态 */
  stop: () => void
  /** 用上一次的提问重发 */
  retry: () => Promise<void>
  /** 清空正文、引用、错误与状态 */
  reset: () => void
}

/** 解析后的单条事件，只保留这一步用得到的两个字段 */
interface ParsedEvent {
  /** 事件名，服务端没写 event 时是 message */
  name: string
  /** 事件负载文本，多行 data 已经用换行拼好 */
  data: string
}

/**
 * 从事件负载里取一个字符串字段
 *
 * delta 是 {"text":"..."}，error 是 {"message":"..."}，字段缺失或类型不对时返回空串
 *
 * @param data 事件负载原文
 * @param field 要读的字段名
 */
function readJsonField(data: string, field: string): string {
  try {
    /** 反序列化后的负载 */
    const payload = JSON.parse(data) as Record<string, unknown>
    /** 目标字段值 */
    const value = payload[field]
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

/** 判断异常是不是 abort() 抛出来的，点了停止不算故障 */
function isAbortError(thrown: unknown): boolean {
  return thrown instanceof Error && thrown.name === 'AbortError'
}

/**
 * 手写 SSE 解析器，从第 4 步原样搬过来
 *
 * 三条防线各管一件事：
 * 1. `buffer += text` + `takeLine()` 取不到行尾就返回 null → 一条事件被切两次也不丢
 * 2. `takeLine()` 同时认 \n 与 \r\n，且 \r 落在末尾时先等下一个字节 → 网关改写换行也能解析
 * 3. `flush()` 把最后半行当一行解析再补一次 dispatch → 最后一条没有结尾空行也不丢
 *
 * @param onEvent 解析出一条完整事件时调用
 */
function createSseParser(onEvent: (event: ParsedEvent) => void) {
  /** 还没切成完整行的残留文本 */
  let buffer = ''
  /** 当前事件名，默认 message */
  let name = 'message'
  /** 当前事件累积的 data 行 */
  let dataLines: string[] = []
  /** 当前事件是否出现过 data 行，没有 data 的事件不派发 */
  let hasData = false

  /** 结算当前事件并重置所有字段 */
  function dispatch() {
    if (hasData) {
      onEvent({ name, data: dataLines.join('\n') })
    }

    name = 'message'
    dataLines = []
    hasData = false
  }

  /**
   * 按协议规则处理一行
   *
   * @param line 不含行尾的一行文本
   */
  function handleLine(line: string) {
    // 空行 = 一个事件结束，这里才派发
    if (line === '') {
      dispatch()
      return
    }

    // 冒号开头是注释行（心跳），整行忽略
    if (line[0] === ':') {
      return
    }

    /** 行内第一个冒号的位置，-1 表示这一行只有字段名 */
    const colon = line.indexOf(':')
    /** 字段名 */
    const field = colon === -1 ? line : line.slice(0, colon)
    /** 字段值 */
    let value = colon === -1 ? '' : line.slice(colon + 1)

    // 规范要求去掉冒号后的一个前导空格，只去一个
    if (value[0] === ' ') {
      value = value.slice(1)
    }

    if (field === 'data') {
      hasData = true
      dataLines.push(value)
      return
    }

    if (field === 'event') {
      name = value
    }
  }

  /** 从 buffer 里切出一行；还取不到完整行时返回 null */
  function takeLine(): string | null {
    for (let index = 0; index < buffer.length; index += 1) {
      if (buffer[index] === '\n') {
        /** 这一行的内容，不含行尾 */
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 1)
        return line
      }

      if (buffer[index] === '\r') {
        // \r 正好在末尾：后面可能还有 \n，必须先等下一个字节，否则会被当成空行
        if (index + 1 === buffer.length) {
          return null
        }

        /** 这一行的内容，不含行尾 */
        const line = buffer.slice(0, index)
        buffer = buffer.slice(buffer[index + 1] === '\n' ? index + 2 : index + 1)
        return line
      }
    }

    return null
  }

  return {
    /**
     * 喂一块解码后的文本
     *
     * 必须用 while 而不是 if：一次 read 可能带回好几条事件
     *
     * @param text 本次到达的文本
     */
    push(text: string) {
      buffer += text

      for (;;) {
        /** 本次切出的一行 */
        const line = takeLine()
        if (line === null) {
          break
        }

        handleLine(line)
      }
    },

    /** 流结束时调用：冲出最后半行并补一次派发 */
    flush() {
      for (;;) {
        /** 本次切出的一行 */
        const line = takeLine()
        if (line === null) {
          break
        }

        handleLine(line)
      }

      // 结尾残留的 \r 属于行尾，不是内容
      if (buffer.endsWith('\r')) {
        buffer = buffer.slice(0, -1)
      }

      /** 最后一段没有行尾的文本 */
      const last = buffer
      buffer = ''
      handleLine(last)
      dispatch()
    },
  }
}

/**
 * 对话逻辑 composable
 *
 * @param options 接口地址等配置
 * @returns 内容、引用、状态、错误与四个动作
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  /** 本次使用的接口地址，创建时就固定下来 */
  const url = options.url ?? DEFAULT_URL

  /** 助手回答正文 */
  const content = ref('')
  /** 回答引用的知识来源 */
  const citations = ref<Citation[]>([])
  /** 当前所处的单值状态 */
  const status = ref<ChatStatus>('idle')
  /** 失败原因 */
  const error = ref('')

  /** 当前请求的中止器，每次 send 新建一个 */
  let controller: AbortController | null = null
  /** 上一次的提问文本，retry 用它重发 */
  let lastPrompt = ''

  /**
   * 发送提问并流式收字
   *
   * @param prompt 用户提问
   */
  async function send(prompt: string) {
    // 上一轮还在跑就不许重入，否则两个流会往同一个 content 里写
    if (status.value === 'sending' || status.value === 'streaming') {
      return
    }

    lastPrompt = prompt
    content.value = ''
    citations.value = []
    error.value = ''
    status.value = 'sending'

    /** 是否收到过 event: done —— 只有它代表「话说完了」 */
    let finished = false
    /** 本次请求的中止器，每次 send 必须是新的，旧的已经废了 */
    const current = new AbortController()
    controller = current

    /** 把一条事件落到 ref 上；服务端 error 事件直接抛，交给下面统一的 catch */
    const handleEvent = (event: ParsedEvent) => {
      if (event.name === 'delta') {
        content.value += readJsonField(event.data, 'text')
        return
      }

      if (event.name === 'citation') {
        citations.value.push(JSON.parse(event.data) as Citation)
        return
      }

      if (event.name === 'done') {
        finished = true
        return
      }

      if (event.name === 'error') {
        throw new Error(readJsonField(event.data, 'message') || '回答生成失败')
      }
    }

    /** 本次请求专用的解析器，不能提到 composable 外层复用 */
    const parser = createSseParser(handleEvent)

    try {
      /** 流式响应：头立刻回来，体还在持续推 */
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ prompt }),
        // 这一行少了，stop() 就成了空操作（第 5 步实测过）
        signal: current.signal,
      })

      if (!response.ok) {
        throw new Error(`流式请求失败：HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('流式请求失败：响应体为空')
      }

      // 头回来了才开始收字节，这一刻才从发送中切成接收中
      status.value = 'streaming'

      /** 字节读取器，一次 read 不等于一条事件 */
      const reader = response.body.getReader()
      /** 解码器，stream: true 让被切包的汉字不变成乱码 */
      const decoder = new TextDecoder()

      for (;;) {
        /** 本次读取结果 */
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        parser.push(decoder.decode(value, { stream: true }))
      }

      // 流正常关闭，先把最后半条补派发
      parser.flush()

      // done: true 只说明「流关了」，有没有 event: done 才决定算不算说完（第 3 步）
      if (finished) {
        status.value = 'idle'
      } else {
        status.value = 'failed'
        error.value = '连接提前关闭，回答可能不完整'
      }
    } catch (thrown) {
      if (isAbortError(thrown)) {
        // 用户点了停止：正常收场，已经收到的字保留
        status.value = 'stopped'
      } else {
        status.value = 'failed'
        error.value = thrown instanceof Error ? thrown.message : '回答生成失败'
      }
    } finally {
      controller = null
    }
  }

  /** 停止生成：abort 之后 read() 抛 AbortError，状态由 catch 统一切成 stopped */
  function stop() {
    controller?.abort()
  }

  /** 用上一次的提问重发 */
  async function retry() {
    if (!lastPrompt) {
      return
    }

    await send(lastPrompt)
  }

  /** 清空正文、引用、错误与状态 */
  function reset() {
    content.value = ''
    citations.value = []
    error.value = ''
    status.value = 'idle'
  }

  // 组件卸载时必须把连接掐掉，否则人走了服务端还在一个字一个字地烧钱（第 5 步实验 A）
  onUnmounted(() => {
    controller?.abort()
    controller = null
  })

  return { content, citations, status, error, send, stop, retry, reset }
}
