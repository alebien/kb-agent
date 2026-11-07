import type { Citation } from './citation'
import type { ToolCall, ToolName } from './tool-call'

/** 消息发送方 */
export type MessageRole = 'user' | 'agent' | 'system' | 'tool'

/** 消息处理状态，流式输出时使用 `streaming` */
export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'stopped' | 'failed'

/** 所有消息共有的字段 */
interface MessageBase {
  /** 消息唯一标识 */
  id: string
  /** 所属会话 id */
  conversationId: string
  /** 消息正文，助手消息按 Markdown 渲染 */
  content: string
  /** 消息状态，用于停止、重试等操作 */
  status: MessageStatus
  /** 消息创建时间，ISO 8601 字符串 */
  createdAt: string
}

/** 用户消息 */
export interface UserMessage extends MessageBase {
  /** 消息发送方 */
  role: 'user'
  /** 意图识别结果，取值为政策、订单、退款、发票、会员、物流、其他之一 */
  intent?: string
  /** 意图置信度，0-1 小数，低于 0.6 时先追问澄清再检索 */
  intentConfidence?: number
  /** 是否已就低置信度意图追问过澄清，用于限制澄清轮次 */
  clarificationAsked?: boolean
}

/** 助手消息 */
export interface AgentMessage extends MessageBase {
  /** 消息发送方 */
  role: 'agent'
  /** 本次回答引用的知识来源 */
  citations: Citation[]
  /** 本次回答触发的工具调用 */
  toolCalls: ToolCall[]
  /** 本次回答的回答置信度，0-100 整数，会话层的 confidence 取最近一条助手消息的值 */
  confidence?: number
  /** 本条回答的总耗时，单位毫秒，展示时经 formatDuration 格式化 */
  durationMs?: number
  /** 失败时的错误说明 */
  error?: string
  /** 生成该消息所用的模型名称 */
  model?: string
  /** 本轮回答对应的用户提问 id，重试时据此定位原始问题 */
  replyToMessageId?: string
  /** 本轮回答开始生成的时间，ISO 8601 字符串；用于停止后保留已生成内容 */
  startedAt?: string
  /** 本轮回答完成时间，ISO 8601 字符串；流式过程中为空 */
  completedAt?: string
}

/** 系统消息 */
export interface SystemMessage extends MessageBase {
  /** 消息发送方 */
  role: 'system'
}

/** 工具执行结果消息 */
export interface ToolMessage extends MessageBase {
  /** 消息发送法 */
  role: 'tool'
  /** 对应的工具调用id，取值来自toolCall.id */
  toolCallId: string
  /** 对应的工具名称，取值来自 ToolCall.name */
  toolName: ToolName
}

/** 一条聊天消息 */
export type Message = UserMessage | AgentMessage | SystemMessage | ToolMessage
