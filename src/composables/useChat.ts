import { computed, onUnmounted, reactive, ref, type ComputedRef, type Ref } from 'vue'
import type { Citation } from '@/domain/citation'

/**
 * 第 7 步：从「一条回答」升级成「一轮对话」
 *
 * 第 6 步只有 content 一个字符串，它答不出三个问题：这是第几轮、这条是谁说的、失败的是哪一条。
 * 所以这一步把状态换成消息列表，再补三件事：乐观更新、按 id 重试、断线提示
 *
 * 只依赖 vue，不碰 vue-router、不碰 store
 * 验证页面：`pnpm dev` 之后打开 http://localhost:5173/usechat-demo.html
 */

/** 流式接口默认地址，开发环境由 dev/mock-sse-server.ts 这个 Vite 插件提供真实事件流 */
const DEFAULT_URL = '/api/dev/sse/chat'

/**
 * 一条消息在界面上的状态
 *
 * 第 6 步是全局单值，这一步挂到每条消息上，因为同一个时刻可能
 * 「上一条已经说完、这一条正在收」，全局一个值装不下
 *
 * 这里没有「已上屏但还没发出去」这个中间态：上屏和发请求之间没有 await，
 * 它在同一个 tick 里就被 sending 盖掉了，加进枚举也看不见。真需要它，
 * 得先有「排队 / 离线暂存」那套机制，那是加队列，不是加个枚举值
 */
export type MessageStatus = 'sending' | 'streaming' | 'done' | 'failed' | 'stopped'

/** 消息角色：用户提问 / 助手回答 */
export type MessageRole = 'user' | 'assistant'

/** 一轮对话里的一条消息 */
export interface ChatMessage {
  /** 消息 id：上屏时是本地临时 id，收到 start 事件后换成服务端 id */
  id: string
  /** 谁说的，决定气泡画在哪一边 */
  role: MessageRole
  /** 正文，用户消息在发送前就写好，助手消息随 delta 增长 */
  content: string
  /** 这条消息自己的状态，界面按它决定徽章、红框和重发按钮 */
  status: MessageStatus
  /** 失败原因，只在 failed 时有值 */
  error?: string
  /** 这条回答引用的知识来源，跟着消息走，重试时才清得干净 */
  citations: Citation[]
}

/**
 * 顶部横幅的种类
 *
 * offline 是浏览器报的掉线，broken 是流断了但浏览器仍认为在线，
 * recovered 是网络回来了 —— 三者处理方式不同，不能只用一个布尔量
 */
export type NoticeKind = 'offline' | 'broken' | 'recovered'

/** 顶部横幅内容 */
export interface ChatNotice {
  /** 横幅种类，决定颜色 */
  kind: NoticeKind
  /** 横幅文案 */
  text: string
}

/** 创建 composable 时的可选配置 */
export interface UseChatOptions {
  /** 流式接口地址，接真实后端时换掉，不传就用开发接口 */
  url?: string
}

/** useChat 对外暴露的状态与动作 */
export interface UseChatReturn {
  /** 整轮对话的消息列表，界面直接 v-for 它 */
  messages: Ref<ChatMessage[]>
  /** 顶部横幅，null 表示不显示 */
  notice: Ref<ChatNotice | null>
  /** 浏览器是否在线，来自 navigator.onLine 与 online/offline 事件 */
  online: Ref<boolean>
  /** 有没有请求在跑，由消息列表推导，不是另存一个布尔量 */
  busy: ComputedRef<boolean>
  /** 发送提问，Promise 在流结束、停止或失败之后才 resolve */
  send: (prompt: string) => Promise<void>
  /** 停止生成：掐断连接，不是改个状态 */
  stop: () => void
  /** 重发指定的那条助手消息，复用原位置 */
  retry: (messageId: string) => Promise<void>
  /** 清空整轮对话 */
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
 * start 是 {"answerId":"..."}，delta 是 {"text":"..."}，error 是 {"message":"..."}
 * 字段缺失或类型不对时返回空串
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
 * @returns 消息列表、横幅、在线状态与四个动作
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  /** 本次使用的接口地址，创建时就固定下来 */
  const url = options.url ?? DEFAULT_URL

  /** 整轮对话的消息列表，这一步唯一的真相 */
  const messages = ref<ChatMessage[]>([])
  /** 顶部横幅，null 表示不显示 */
  const notice = ref<ChatNotice | null>(null)
  /** 浏览器是否在线，初值取 navigator.onLine，之后由 online/offline 事件维护 */
  const online = ref(navigator.onLine)

  /** 有没有请求在跑：从消息列表推导，不另存布尔量，否则又多一个可能不一致的状态 */
  const busy = computed(() =>
    messages.value.some(
      (message) => message.status === 'sending' || message.status === 'streaming',
    ),
  )

  /** 当前请求的中止器，每次跑流新建一个 */
  let controller: AbortController | null = null
  /** 临时 id 的序号，只在本地唯一 */
  let tempSeq = 0

  /** 生成一个临时 id：上屏那一刻还没有服务端 id，先自己造一个占位 */
  function nextTempId() {
    tempSeq += 1
    return `tmp-${tempSeq}`
  }

  /**
   * 把一轮问答跑完：POST 出去，边收边写进 answer
   *
   * answer 一定是「已经在 messages 里」的那一条。send 和 retry 共用这个函数，
   * 重试因此不会新增气泡
   *
   * @param prompt 本轮提问
   * @param answer 这条提问对应的助手消息，必须是列表里的响应式对象
   */
  async function runStream(prompt: string, answer: ChatMessage) {
    // 重试时先清空上一轮的残骸，否则旧内容会和新的拼在一起
    answer.content = ''
    answer.error = undefined
    answer.citations = []
    answer.status = 'sending'
    // 在线才清横幅：离线时那条提示要一直挂着，否则一发消息提示就没了
    if (online.value) {
      notice.value = null
    }

    /** 是否收到过 event: done —— 只有它代表「话说完了」 */
    let finished = false
    /** 本次请求的中止器，每次必须是新的，旧的已经废了 */
    const current = new AbortController()
    controller = current

    /** 把一条事件落到消息上；服务端 error 事件直接抛，交给下面统一的 catch */
    const handleEvent = (event: ParsedEvent) => {
      if (event.name === 'start') {
        /** 服务端 id，到了就替换临时 id，气泡位置和内容都不动 */
        const serverId = readJsonField(event.data, 'answerId')
        if (serverId) {
          answer.id = serverId
        }
        return
      }

      if (event.name === 'delta') {
        answer.content += readJsonField(event.data, 'text')
        answer.status = 'streaming'
        return
      }

      if (event.name === 'citation') {
        answer.citations.push(JSON.parse(event.data) as Citation)
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
        answer.status = 'done'
        // 这一轮正常收工，横幅可以撤了
        notice.value = null
      } else {
        answer.status = 'failed'
        answer.error = '连接提前关闭，回答可能不完整'
        notice.value = online.value
          ? { kind: 'broken', text: '流被截断了，这条回答不完整，点「重发这条」' }
          : { kind: 'offline', text: '网络已断开，这条回答断了，联网后点「重发这条」' }
      }
    } catch (thrown) {
      if (isAbortError(thrown)) {
        // 用户点了停止：正常收场，已经收到的字保留
        answer.status = 'stopped'
      } else {
        answer.status = 'failed'
        answer.error = thrown instanceof Error ? thrown.message : '回答生成失败'
        // 浏览器已经报过 offline 时用离线文案：那比「连接断了」更准确
        notice.value = online.value
          ? { kind: 'broken', text: '连接断了，这条没发出去，点「重发这条」' }
          : { kind: 'offline', text: '网络已断开，这条没发出去，联网后点「重发这条」' }
      }
    } finally {
      controller = null
    }
  }

  /**
   * 发送提问：先把气泡推上屏，再发请求
   *
   * 这两步的顺序就是乐观更新：用户点发送的瞬间就该看到自己说的话，
   * 而不是等 fetch 回来才出现
   *
   * @param prompt 用户提问
   */
  async function send(prompt: string) {
    // 上一轮还在跑就不许重入，否则两个流会往同一条消息里写
    if (busy.value) {
      return
    }

    /** 去掉首尾空白后的提问，空的不发 */
    const text = prompt.trim()
    if (!text) {
      return
    }

    // 用 reactive 包一层再 push：直接推原始对象的话，从数组读回来的是另一个代理，
    // 外面手里这份改了不会触发渲染，界面会停在上屏那一瞬间
    /** 用户消息，点发送的瞬间就上屏 */
    const userMessage = reactive<ChatMessage>({
      id: nextTempId(),
      role: 'user',
      content: text,
      status: 'done',
      citations: [],
    })
    /** 助手占位，正文之后由 delta 一段段填 */
    const answer = reactive<ChatMessage>({
      id: nextTempId(),
      role: 'assistant',
      content: '',
      status: 'sending',
      citations: [],
    })

    messages.value.push(userMessage, answer)

    await runStream(text, answer)
  }

  /** 停止生成：abort 之后 read() 抛 AbortError，状态由 catch 统一切成 stopped */
  function stop() {
    controller?.abort()
  }

  /**
   * 重发某一条助手回答
   *
   * 先找到它前面最近的一条用户消息当提问，然后清空原内容、复用同一条消息位置。
   * 关键是这里不 push，所以界面上不会多出一个气泡
   *
   * @param messageId 要重发的那条助手消息的 id
   */
  async function retry(messageId: string) {
    if (busy.value) {
      return
    }

    /** 要重发的那条消息在列表里的下标 */
    const index = messages.value.findIndex((message) => message.id === messageId)
    if (index === -1) {
      return
    }

    /** 要重发的那条消息本身 */
    const answer = messages.value[index]
    if (!answer || answer.role !== 'assistant') {
      return
    }

    /** 这条回答对应的提问，从它往前找最近的一条用户消息 */
    let prompt = ''
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      /** 往前扫到的这条消息 */
      const candidate = messages.value[cursor]
      if (candidate?.role === 'user') {
        prompt = candidate.content
        break
      }
    }

    if (!prompt) {
      return
    }

    await runStream(prompt, answer)
    // await send(prompt)
  }

  /** 清空整轮对话 */
  function reset() {
    messages.value = []
    notice.value = null
  }

  /** 网络恢复：横幅换成「可以重发」，而不是直接消失，否则用户不知道刚才发生了什么 */
  function handleOnline() {
    online.value = true
    notice.value = { kind: 'recovered', text: '网络已恢复，点「重发这条」再发一次' }
  }

  /** 浏览器报掉线：正在收的回答一定会中断，先说清楚 */
  function handleOffline() {
    online.value = false
    notice.value = { kind: 'offline', text: '网络已断开，正在收的回答会中断' }
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // 组件卸载时必须把连接掐掉，否则人走了服务端还在一个字一个字地烧钱（第 5 步实验 A）
  onUnmounted(() => {
    controller?.abort()
    controller = null
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return { messages, notice, online, busy, send, stop, retry, reset }
}
