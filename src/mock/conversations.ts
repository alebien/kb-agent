import type { ConversationSummary } from '@/domain'

/** 预置的会话摘要 mock 数据。 */
export const conversations: ConversationSummary[] = [
  {
    id: '9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71',
    title: '退款政策咨询 · A1024',
    updatedAt: '2026-11-03 20:18',
  },
  {
    id: '3a7d6b2e-9c14-4f58-8b6a-1e0d7c4f2b93',
    title: '发票开具流程',
    updatedAt: '2026-11-03 18:42',
  },
  {
    id: '6c1e8f3d-2a5b-4d7c-9e0f-8b4a6c2d1e57',
    title: '会员权益对比',
    updatedAt: '2026-11-02 16:27',
  },
  {
    id: 'c4b8e2a6-1f3d-4a9c-8b7e-5d0f2a6c9e13',
    title: '物流异常处理',
    updatedAt: '2026-11-02 10:05',
  },
  {
    id: '2e7a9c4b-6d1f-4b8e-a3c5-9f0d7b2e6a84',
    title: '客服话术更新',
    updatedAt: '2026-11-01 14:36',
  },
]

/** 默认会话 id，供演示或兜底跳转使用。 */
export const defaultConversationId = conversations[0]!.id
