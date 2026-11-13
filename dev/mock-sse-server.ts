import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * 开发环境用的 SSE 模拟服务
 *
 * 存在的意义：让前端的流式渲染、停止、错误态都能在「真网络流」上跑通，
 * 而不是靠 setTimeout 造出来的假流。接真实后端时删掉这个插件即可
 */

/** 流式接口路径，前端在 src/api/conversations.ts 里请求这个地址 */
export const MOCK_STREAM_PATH = '/api/dev/sse/chat'

/** 默认分片大小，模拟真实模型一次 flush 携带的字符数 */
const DEFAULT_CHUNK_SIZE = 6

/** 正文流的目标总时长，分片变大时总耗时不变，只有颗粒度变化 */
const TARGET_STREAM_MS = 2400

/** 单个片段间隔的下限，避免分片极小时疯狂刷事件 */
const MIN_CHUNK_INTERVAL_MS = 6

/** 心跳间隔，用来验证代理不会因为连接空闲而断开 */
const HEARTBEAT_INTERVAL_MS = 1200

/** 模拟检索工具的执行耗时 */
const SEARCH_DELAY_MS = 360

/** 长文本压测用的文档路径，相对项目根目录，只在开发服务器里读盘 */
const LONG_ANSWER_PATH = 'dev/fixtures/long-answer.md'

/** 长文本缓存，null 表示还没读过盘 */
let longAnswerCache: string | null = null

/**
 * 读取长文本压测文档
 *
 * 压测必须用真实长文本：重复短句的 Markdown 解析成本远低于真文档，
 * 拿它测出来的帧率没有参考价值。文档内容固定，读一次之后缓存起来
 */
function readLongAnswer(): string {
  /** 缓存的文档正文，第二次请求起直接复用 */
  const cached = longAnswerCache
  if (cached !== null) {
    return cached
  }

  /** 从项目根目录定位文档，pnpm dev 的工作目录就是项目根目录 */
  const file = resolve(process.cwd(), LONG_ANSWER_PATH)
  /** 读出来的正文，同时写进缓存 */
  const text = readFileSync(file, 'utf8')
  longAnswerCache = text
  return text
}

/** 一次 SSE 响应的写入端，负责序列化事件并维护事件序号 */
interface SseWriter {
  /** 写入一个命名事件，payload 会被序列化成 JSON */
  event: (name: string, payload: unknown) => void
  /** 写入注释行，心跳用，前端解析时直接跳过 */
  comment: (text: string) => void
  /** 结束响应 */
  close: () => void
}

/** 可被 await 的短延迟，控制出字速度 */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

/** 按固定长度把正文切成增量片段 */
function splitText(content: string, size: number): string[] {
  /** 切片结果 */
  const chunks: string[] = []

  for (let index = 0; index < content.length; index += size) {
    chunks.push(content.slice(index, index + size))
  }

  return chunks
}

/**
 * 归一化请求里的分片大小
 *
 * 真实后端一次 flush 多少字由 tokenizer 与服务端 batching 决定，
 * 这里开放成参数，方便对比不同颗粒度对前端渲染的影响
 *
 * @param raw query 里的原始值，缺省时用默认值
 */
function normalizeChunkSize(raw: string | null): number {
  /** 解析后的数值，非数字按缺省处理 */
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CHUNK_SIZE
  }

  return Math.min(40, Math.max(1, Math.round(parsed)))
}

/**
 * 归一化请求里的总时长
 *
 * 正文推完的目标耗时，压测时调大可以拉长观察窗口，方便在 Performance 面板里截取一段稳定区间
 *
 * @param raw query 里的原始值，缺省时用 TARGET_STREAM_MS
 */
function normalizeDuration(raw: string | null): number {
  /** 解析后的数值，非数字按缺省处理 */
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return TARGET_STREAM_MS
  }

  return Math.min(60000, Math.max(200, Math.round(parsed)))
}

/**
 * 归一化请求里的正文长度
 *
 * 0 表示不截断；压测时可以用 ?chars=10000 把长文本拉得更极端
 *
 * @param raw query 里的原始值，缺省时返回 0
 */
function normalizeChars(raw: string | null): number {
  /** 解析后的数值，非数字按不截断处理 */
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0
  }

  return Math.round(parsed)
}

/**
 * 读取并解析 JSON 请求体
 *
 * @param request 原始请求
 * @returns 解析后的对象，空请求体返回空对象
 */
function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    /** 已接收的字节块 */
    const chunks: Buffer[] = []
    /** 已接收的字节数，用于限制请求体大小 */
    let size = 0

    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      // 开发环境不存在大请求，超过 64KB 直接判定异常
      if (size > 64 * 1024) {
        reject(new Error('请求体过大'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => {
      /** 完整请求体文本 */
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text) as Record<string, unknown>)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('请求体解析失败'))
      }
    })

    request.on('error', reject)
  })
}

/**
 * 创建事件写入器
 *
 * @param response 已写入响应头的响应对象
 */
function createWriter(response: ServerResponse): SseWriter {
  /** 事件序号，作为 SSE 的 id 字段供前端断线续传 */
  let sequence = 0

  return {
    event(name, payload) {
      if (response.writableEnded) {
        return
      }
      sequence += 1
      // 一个事件必须以空行结束，data 里有换行时 JSON.stringify 会转义成 \n
      response.write(`id: ${sequence}\nevent: ${name}\ndata: ${JSON.stringify(payload)}\n\n`)
    },
    comment(text) {
      if (response.writableEnded) {
        return
      }
      response.write(`: ${text}\n\n`)
    },
    close() {
      if (!response.writableEnded) {
        response.end()
      }
    },
  }
}

/** 按提问关键词返回不同的演示回答，覆盖多级标题、列表、表格与引用块 */
function buildAnswer(prompt: string): string {
  /** 归一化后的提问，便于匹配关键词 */
  const normalized = prompt.toLowerCase()

  if (normalized.includes('发票')) {
    return `## 发票处理建议

已为你检索到发票相关规则，可以先按下面步骤确认：

1. 核对开票主体与税号是否正确
2. 电子普票在开具后 **30 天内** 可申请换开
3. 跨月换开需要先红冲原发票

> 如果订单已报销，请先确认财务是否接受红冲后的新票

| 场景 | 处理方式 |
| --- | --- |
| 抬头错误 | 申请换开 |
| 金额错误 | 红冲后重开 |
| 超过 30 天 | 转人工审核 |

需要我继续帮你查询具体订单的发票状态吗？`
  }

  if (normalized.includes('物流') || normalized.includes('快递')) {
    return `## 物流异常排查

可以按以下顺序确认包裹状态：

1. 查看物流轨迹是否超过 **48 小时** 未更新
2. 核对收件地址与联系电话是否完整
3. 联系承运方确认是否发生分拣异常

如果确认丢件，可以提交工单并附上订单号，客服会在 **4 小时内** 首次响应

> 涉及赔付时，请保留物流截图与商品价值凭证`
  }

  if (normalized.includes('会员') || normalized.includes('积分')) {
    return `## 会员权益说明

当前会员等级按近 **12 个月** 的实付金额计算，权益包含：

- 专属客服通道
- 生日双倍积分
- 每月免运费券

积分有效期为获取后 **24 个月**，过期前 30 天会通过站内信提醒`
  }

  return `## 处理结论

已结合企业知识库检索「${prompt}」，建议先确认订单状态与适用政策：

1. 核对订单是否在售后时效内
2. 确认商品当前状态与凭证是否齐全
3. 按对应政策提交申请并保留沟通记录

> 若涉及金额变更或发票重开，建议转人工复核

| 项目 | 说明 |
| --- | --- |
| 处理时效 | 1 个工作日内 |
| 退款路径 | 原路退回 |
| 人工介入 | 涉及金额变更时 |

如需继续处理，请补充订单号。`
}

/** 按提问返回演示引用，字段与 src/domain/citation.ts 保持一致 */
function buildCitation(prompt: string): Record<string, unknown> {
  /** 命中发票场景时换成财务库的文档 */
  const isInvoice = prompt.includes('发票')

  return {
    id: `${Date.now()}-citation`,
    documentId: isInvoice
      ? '4b7d2f58-1c9e-4a63-b840-7e5f9a2c6d13'
      : '9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71',
    knowledgeBaseId: isInvoice ? 'kb_invoice' : 'kb_aftersale',
    name: isInvoice ? '发票开具流程说明.docx' : '售后退款政策_v2.pdf',
    description: isInvoice ? '财务票据库 · 抬头换开与时效' : '售后政策库 · 更新于 2026-10-20',
    snippet: isInvoice
      ? '电子普通发票开具后 30 天内可申请换开，跨月换开需先完成红冲'
      : '符合本场景的用户，可在签收后 7 天内提交申请，审核通过后原路退回',
    page: isInvoice ? 6 : 12,
    score: isInvoice ? 0.84 : 0.92,
  }
}

/**
 * 提供 /api/dev/sse/chat 的 Vite 插件
 *
 * 支持 `?scenario=broken` 模拟生成中途断流，用来验证前端错误态；
 * 支持 `?scenario=long` 返回 dev/fixtures/long-answer.md 里的长文本，用来压测渲染；
 * 支持 `?chunkSize=N` 调整每帧字符数，用来对比不同颗粒度的流式体感；
 * 支持 `?durationMs=N` 调整正文推完的目标总时长，`?chars=N` 截断正文长度
 */
export function mockSseServer(): Plugin {
  return {
    name: 'kb-agent:mock-sse',
    // 只在开发服务器生效，构建产物里不会出现这段代码
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(MOCK_STREAM_PATH, async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end('该接口只接受 POST')
          return
        }

        /** 解析后的请求体 */
        let body: Record<string, unknown>
        try {
          body = await readJsonBody(request)
        } catch {
          response.statusCode = 400
          response.end('请求体不是合法 JSON')
          return
        }

        /** 用户提问，决定返回哪段演示文案 */
        const prompt = typeof body.prompt === 'string' ? body.prompt : ''
        /** 前端上屏时用的临时 id，原样回显便于对照日志；真实后端通常拿它做幂等键 */
        const clientAnswerId = typeof body.answerId === 'string' ? body.answerId : ''
        /** 服务端自己生成的消息 id，真实后端返回的是落库后的行 id，客户端要拿它替换临时 id */
        const answerId = `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        /** 解析后的请求地址，通过 query 开关演示场景与分片粒度 */
        const requestUrl = new URL(request.url ?? MOCK_STREAM_PATH, 'http://localhost')
        /** 演示场景，broken 模拟中途断流，long 返回长文本，keep-alive 模拟 done 后保持连接 */
        const scenario = requestUrl.searchParams.get('scenario')
        /** 本次回答的分片大小，?chunkSize=20 可模拟真实模型一次吐一大段 */
        const chunkSize = normalizeChunkSize(requestUrl.searchParams.get('chunkSize'))
        /** 本次回答的目标总时长，?durationMs=8000 可拉长压测窗口 */
        const durationMs = normalizeDuration(requestUrl.searchParams.get('durationMs'))
        /** 正文长度上限，0 表示不截断，?chars=10000 可加码压测 */
        const chars = normalizeChars(requestUrl.searchParams.get('chars'))

        // 模拟网关直接返回 500：响应头就是错的，前端根本进不了流式分支
        // 用它验证「HTTP 错误不会触发 offline 事件」，只监听 online/offline 会漏
        if (scenario === '500') {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ message: '模拟服务端 500' }))
          return
        }

        // 事件流必须显式声明 utf-8，否则浏览器可能按 latin-1 解码导致中文乱码
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          // 禁止中间层缓存与压缩改写，否则前端会一次性收到全文
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          // Nginx 专用响应头，等价于关闭 proxy_buffering
          'X-Accel-Buffering': 'no',
        })
        // 先把响应头刷出去，让前端立刻进入流式读取状态
        response.flushHeaders()

        /** 事件写入器 */
        const writer = createWriter(response)
        /** 客户端是否已断开，断开后停止后续写入 */
        let aborted = false
        /** 本次回答开始时间，用于结算耗时 */
        const startedAt = Date.now()

        /**
         * 客户端断开监听
         * 用 response 的 close 事件并排除正常结束的情况；request 的 close
         * 在请求体读完后就会触发，不能用来判断中断
         */
        response.on('close', () => {
          if (!response.writableFinished) {
            aborted = true
          }
        })

        /** 心跳定时器，回答结束后必须清理 */
        const heartbeat = setInterval(() => {
          writer.comment(`ping ${startedAt}`)
        }, HEARTBEAT_INTERVAL_MS)

        try {
          writer.event('start', {
            answerId,
            clientAnswerId,
            model: 'kb-agent-mock',
            createdAt: new Date(startedAt).toISOString(),
          })

          /** 本次检索工具调用的 id，running 与 success 事件复用同一个 */
          const toolId = `${answerId || 'mock'}-search`

          writer.event('tool', {
            id: toolId,
            name: 'search_knowledge',
            status: 'running',
            arguments: { query: prompt, top_k: 5 },
            startAt: new Date().toISOString(),
          })

          await sleep(SEARCH_DELAY_MS)
          if (aborted) {
            return
          }

          // 引用先于正文推送，前端可以先把来源卡片挂上去再出字
          writer.event('citation', buildCitation(prompt))

          writer.event('tool', {
            id: toolId,
            name: 'search_knowledge',
            status: 'success',
            arguments: { query: prompt, top_k: 5 },
            result: { hits: 1, topScore: 0.92 },
            durationMs: SEARCH_DELAY_MS,
          })

          /** 本次回答的完整正文：长文本场景读真实文档，其余按关键词匹配 */
          const raw = scenario === 'long' ? readLongAnswer() : buildAnswer(prompt)
          /** 按 chars 截断后的正文，0 表示不截断 */
          const content = chars > 0 ? raw.slice(0, chars) : raw
          /** 切好的增量片段 */
          const chunks = splitText(content, chunkSize)
          /** 片段间隔按目标总时长摊开，分片变大时每条更厚但总耗时不变 */
          const interval = Math.max(
            MIN_CHUNK_INTERVAL_MS,
            Math.round(durationMs / Math.max(1, chunks.length)),
          )
          /** 断流场景在生成到 40% 时中断，其余场景为 -1 表示不中断 */
          const brokenAt = scenario === 'broken' ? Math.floor(chunks.length * 0.4) : -1

          for (let index = 0; index < chunks.length; index += 1) {
            if (aborted) {
              return
            }

            if (index === brokenAt) {
              // 模拟模型服务超时，前端应走失败态并保留已生成内容
              writer.event('error', { message: '模型服务响应超时' })
              return
            }

            // 注意：Windows 下 Node 的 setTimeout 最小分辨率约 15.6ms，
            // 6ms 的间隔实际会变成 15.6ms —— 长文本的真实流速因此是 64 条/秒左右，
            // 一帧（16.7ms）里正好一条，这也是「按帧合并」在本地测不出收益的原因
            await sleep(interval)
            if (aborted) {
              return
            }
            writer.event('delta', { text: chunks[index] ?? '' })
          }

          writer.event('done', {
            confidence: 88,
            model: 'kb-agent-mock',
            durationMs: Date.now() - startedAt,
            tokens: content.length,
          })

          // 演示真实网关常见的长连接行为：done 之后连接仍保持一段时间
          if (scenario === 'keep-alive') {
            await sleep(1500)
          }
        } finally {
          clearInterval(heartbeat)
          writer.close()
        }
      })
    },
  }
}
