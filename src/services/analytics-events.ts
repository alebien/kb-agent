/**
 * 埋点事件清单
 * 与 PRD 12.1 的 8 个核心事件一一对应，新增事件必须先在这里登记
 * 未登记的事件名在 track() 中会直接抛错，避免脏数据流入
 */
export const ANALYTICS_EVENTS = [
  /** 登录成功 */
  'login_succeeded',
  /** 创建会话成功 */
  'conversation_created',
  /** 提交提问 */
  'chat_message_sent',
  /** 回答流式结束 */
  'chat_stream_completed',
  /** 点击引用卡片 */
  'citation_clicked',
  /** 工具调用结束 */
  'tool_call_finished',
  /** 触发转人工 */
  'human_handoff_triggered',
  /** 建单成功，是否复用放在 reused 属性里 */
  'ticket_created',
] as const

/** 事件名联合类型 */
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]
