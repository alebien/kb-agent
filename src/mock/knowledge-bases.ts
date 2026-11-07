import type { KnowledgeBase } from '@/domain'

/**
 * 知识库 mock 数据，覆盖售后、财务、会员、物流与话术五个业务域
 * documentCount 与 chunkCount 均为接口统计口径，本端只读不写
 */
export const knowledgeBases: KnowledgeBase[] = [
  {
    id: 'kb_aftersale',
    name: '售后政策库',
    description: '覆盖退款时效、七天无理由、价保与换货验收等售后判定口径',
    status: 'active',
    documentCount: 2,
    chunkCount: 186,
    createdAt: '2026-09-01T09:30:00+08:00',
    updatedAt: '2026-11-07T09:40:00+08:00',
  },
  {
    id: 'kb_invoice',
    name: '财务票据库',
    description: '覆盖电子发票开具、抬头换开、专票资质与红冲作废流程',
    status: 'active',
    documentCount: 2,
    chunkCount: 206,
    createdAt: '2026-09-04T10:12:00+08:00',
    updatedAt: '2026-10-31T09:40:00+08:00',
  },
  {
    id: 'kb_member',
    name: '会员权益库',
    description: '覆盖会员等级折扣、积分有效期、自动续费与权益共享边界',
    status: 'active',
    documentCount: 2,
    chunkCount: 100,
    createdAt: '2026-09-08T14:05:00+08:00',
    updatedAt: '2026-11-02T10:15:00+08:00',
  },
  {
    id: 'kb_logistics',
    name: '物流配送库',
    description: '覆盖配送时效、异常轨迹、丢件赔付与到站催派处理规范',
    status: 'active',
    documentCount: 2,
    chunkCount: 36,
    createdAt: '2026-09-11T16:48:00+08:00',
    updatedAt: '2026-11-02T08:30:00+08:00',
  },
  {
    id: 'kb_script',
    name: '客服话术库',
    description: '覆盖安抚、升级与超时赔付口径的客服对外话术模板',
    // 演示「暂停检索」：paused 的库不参与对话检索，但仍保留文档与计数
    status: 'paused',
    documentCount: 2,
    chunkCount: 0,
    createdAt: '2026-09-15T11:20:00+08:00',
    updatedAt: '2026-11-05T17:05:00+08:00',
  },
]
