import type { ConversationSummary } from '@/domain'

/**
 * 预置的会话摘要 mock 数据
 * updatedAt 与 createdAt 统一使用带时区的 ISO 8601 字符串；
 * createdBy 决定会话归属，演示时两个同角色账号各有一批数据
 */
export const conversations: ConversationSummary[] = [
  {
    id: 'e8d4f7a2-3b69-4c15-9f08-6a2d5e1b7c40',
    title: '赔付时效咨询 · 退款',
    createdBy: 'u_1001',
    createdAt: '2026-11-04T09:08:00+08:00',
    updatedAt: '2026-11-04T09:16:00+08:00',
  },
  {
    id: '7b2d9e51-4c84-4a37-b1e6-0f8c5d3a6e29',
    title: '退款还是发票？',
    createdBy: 'u_1001',
    createdAt: '2026-11-04T08:36:00+08:00',
    updatedAt: '2026-11-04T08:42:00+08:00',
  },
  {
    id: '9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71',
    title: '退款政策咨询 · A1024',
    createdBy: 'u_1001',
    createdAt: '2026-11-03T20:10:00+08:00',
    updatedAt: '2026-11-03T20:18:00+08:00',
  },
  {
    id: '3a7d6b2e-9c14-4f58-8b6a-1e0d7c4f2b93',
    title: '发票开具流程',
    createdBy: 'u_1001',
    createdAt: '2026-11-03T18:30:00+08:00',
    updatedAt: '2026-11-03T18:42:00+08:00',
  },
  {
    id: '6c1e8f3d-2a5b-4d7c-9e0f-8b4a6c2d1e57',
    title: '会员权益对比',
    createdBy: 'u_1001',
    createdAt: '2026-11-02T16:20:00+08:00',
    updatedAt: '2026-11-02T16:27:00+08:00',
  },
  {
    id: 'c4b8e2a6-1f3d-4a9c-8b7e-5d0f2a6c9e13',
    title: '物流异常处理',
    createdBy: 'u_1002',
    createdAt: '2026-11-02T09:58:00+08:00',
    updatedAt: '2026-11-02T10:05:00+08:00',
  },
  {
    id: '2e7a9c4b-6d1f-4b8e-a3c5-9f0d7b2e6a84',
    title: '客服话术更新',
    createdBy: 'u_1002',
    createdAt: '2026-11-01T14:28:00+08:00',
    updatedAt: '2026-11-01T14:36:00+08:00',
  },
]

/** 默认会话 id，固定指向退款政策场景，避免演示默认落在低置信度结果 */
export const defaultConversationId = '9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71'
