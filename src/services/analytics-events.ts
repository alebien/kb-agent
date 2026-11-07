/**
 * 埋点事件清单
 *
 * 与 PRD 12.2 事件表一一对应，共 24 个；新增事件必须先在此登记，
 * 未登记的事件名在 track() 中会被直接拒绝
 */

/** 全部埋点事件名 */
export const ANALYTICS_EVENTS = [
  /** 创建会话成功 */
  'conversation_created',
  /** 会话重命名成功 */
  'conversation_renamed',
  /** 删除会话 */
  'conversation_deleted',
  /** 提交提问 */
  'chat_message_sent',
  /** 意图识别返回 */
  'intent_recognized',
  /** 触发澄清追问 */
  'clarification_asked',
  /** 收到流式输出的首个片段 */
  'chat_stream_first_token',
  /** 回答流式结束 */
  'chat_stream_completed',
  /** 点击停止生成 */
  'chat_generation_stopped',
  /** 重新生成回答 */
  'chat_regenerated',
  /** 回答失败 */
  'chat_failed',
  /** 点击引用卡片 */
  'citation_clicked',
  /** 工具调用结束 */
  'tool_call_finished',
  /** 触发转人工 */
  'human_handoff_triggered',
  /** 回答置信度产出 */
  'answer_confidence_graded',
  /** 建单成功且非复用 */
  'ticket_created',
  /** 建单命中复用 */
  'ticket_reused',
  /** 工单状态流转或撤回重开 */
  'ticket_status_changed',
  /** 文档上传成功 */
  'document_uploaded',
  /** 文档解析结束 */
  'document_parse_finished',
  /** 恢复软删除文档 */
  'document_restored',
  /** 评测用例运行 */
  'eval_case_run',
  /** 人工沉淀 Bad case */
  'badcase_sunk',
  /** 登录成功 */
  'login_succeeded',
] as const

/** 事件名联合类型 */
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]
