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
}

/** 助手消息 */
export interface AgentMessage extends MessageBase {
  /** 消息发送方 */
  role: 'agent'
  /** 本次回答引用的知识来源 */
  citations: Citation[]
  /** 本次回答触发的工具调用 */
  toolCalls: ToolCall[]
  /** 失败时的错误说明 */
  error?: string
  /** 生成该消息所用的模型名称 */
  model?: string
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
