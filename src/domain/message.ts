import type { Citation } from './citation'
import type { ToolCall } from './tool-call'

/** 消息发送方 */
export type MessageRole = 'user' | 'agent' | 'system' | 'tool'

/** 消息处理状态，流式输出时使用 `streaming` */
export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'stopped' | 'failed'

/** 一条聊天消息 */
export interface Message {
  /** 消息唯一标识 */
  id: string
  /** 所属会话 id */
  conversationId: string
  /** 消息发送方 */
  role: MessageRole
  /** 消息正文，助手消息按 Markdown 渲染 */
  content: string
  /** 消息状态，用于停止、重试等操作 */
  status: MessageStatus
  /** 消息创建时间，ISO 8601 字符串 */
  createdAt: string
  /** 本次回答引用的知识来源 */
  citations?: Citation[]
  /** 本次回答触发的工具调用 */
  toolCalls?: ToolCall[]
  /** 失败时的错误说明 */
  error?: string
  /** 生成该消息所用的模型名称 */
  model?: string
}
