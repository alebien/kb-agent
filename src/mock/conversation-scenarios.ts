import type { Citation, ToolCall } from '@/domain'

/** 预置会话的演示场景，用于覆盖引用、工具失败、低置信度与澄清等页面状态 */
export interface MockAnswerScenario {
  /** 助手回答正文 */
  content: string
  /** 回答置信度，null 表示澄清轮不产生置信度 */
  confidence: number | null
  /** 本条回答总耗时，单位毫秒 */
  durationMs: number
  /** 引用来源列表 */
  citations: Citation[]
  /** 工具调用列表 */
  toolCalls: ToolCall[]
  /** 关联工单号，没有时为 null */
  ticketCode: string | null
}

function buildScenario(id: string, title: string): MockAnswerScenario {
  if (title.includes('客服话术更新')) {
    return {
      content:
        '## 暂无直接依据\n\n当前客服话术库处于暂停检索状态，知识库中没有找到可以直接引用的话术模板。\n\n建议不要直接承诺赔付金额或处理时效，先转人工确认最新口径后再回复客户。',
      confidence: 58,
      durationMs: 1560,
      citations: [],
      toolCalls: [
        {
          id: `${id}-search-empty`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 0, topScore: null },
          durationMs: 1200,
        },
        {
          id: `${id}-ticket`,
          name: 'create_ticket',
          arguments: { conversationId: id, category: 'other', priority: 'high' },
          status: 'success',
          result: { code: 'A1026', reused: false, status: 'open' },
          durationMs: 360,
        },
      ],
      ticketCode: 'A1026',
    }
  }

  if (title.includes('物流异常处理')) {
    return {
      content:
        '## 物流异常处理建议\n\n已检索到物流异常处理规范，可以先按以下步骤排查：\n\n1. 确认物流轨迹是否超过 **48 小时** 未更新\n2. 核对收件地址与联系电话是否完整\n3. 保留物流截图与商品价值凭证\n\n订单查询工具当前未返回结果，以下结论仅基于知识库，请人工核实订单状态后再答复客户。',
      confidence: 72,
      durationMs: 1560,
      citations: [
        {
          id: `${id}-logistics`,
          documentId: '6c0d9b47-3e5a-4f28-8a71-b2d4c6e9f013',
          knowledgeBaseId: 'kb_logistics',
          name: '配送时效与区域覆盖说明.md',
          description: '物流配送库 · 异常轨迹与时效口径',
          snippet: '物流轨迹超过 48 小时未更新时，应优先联系承运方确认分拣状态，并保留截图',
          page: 4,
          score: 0.81,
        },
      ],
      toolCalls: [
        {
          id: `${id}-search`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 1, topScore: 0.81 },
          durationMs: 360,
        },
        {
          id: `${id}-order`,
          name: 'get_order',
          arguments: { orderNo: 'SO-20261103-0042' },
          status: 'error',
          error: {
            code: 'ORDER_NOT_FOUND',
            message: '未查询到该订单',
            detail: '请核对订单号后重试',
          },
          durationMs: 1200,
        },
      ],
      ticketCode: 'A1025',
    }
  }

  if (title.includes('赔付时效咨询')) {
    return {
      content:
        '## 赔付时效需人工确认\n\n知识库仅能确认退款申请需在签收后 7 天内提交，但具体到账时效与赔付金额需要结合支付渠道和订单状态判断。\n\n本回答置信度较低，已为你转人工复核，请勿直接向客户承诺到账时间。',
      confidence: 62,
      durationMs: 920,
      citations: [
        {
          id: `${id}-refund-rule`,
          documentId: '9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71',
          knowledgeBaseId: 'kb_aftersale',
          name: '售后退款政策_v2.pdf',
          description: '售后政策库 · 退款申请条件',
          snippet: '退款申请需在签收后 7 天内提交，到账时效以支付渠道为准',
          page: 12,
          score: 0.66,
        },
      ],
      toolCalls: [
        {
          id: `${id}-search`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 1, topScore: 0.66 },
          durationMs: 640,
        },
        {
          id: `${id}-ticket`,
          name: 'create_ticket',
          arguments: { conversationId: id, category: 'refund', priority: 'high' },
          status: 'success',
          result: { code: 'A1031', reused: true, status: 'open' },
          durationMs: 280,
        },
      ],
      ticketCode: 'A1031',
    }
  }

  if (title.includes('退款还是发票')) {
    return {
      content:
        '想确认一下，你要咨询的是**退款到账**问题，还是**发票开具**问题？回复「退款」或「发票」即可继续。',
      confidence: null,
      durationMs: 180,
      citations: [],
      toolCalls: [],
      ticketCode: null,
    }
  }

  if (title.includes('发票开具流程')) {
    return {
      content:
        '## 发票处理建议\n\n已为你检索到发票相关规则，可以先按下面步骤确认：\n\n1. 核对开票主体与税号是否正确\n2. 电子普票在开具后 **30 天内** 可申请换开\n3. 跨月换开需要先红冲原发票\n\n其中跨月换开涉及财务审核，建议人工复核后再答复客户。',
      confidence: 78,
      durationMs: 380,
      citations: [
        {
          id: `${id}-invoice`,
          documentId: '4b7d2f58-1c9e-4a63-b840-7e5f9a2c6d13',
          knowledgeBaseId: 'kb_invoice',
          name: '发票开具流程说明.docx',
          description: '财务票据库 · 抬头换开与时效',
          snippet: '电子普通发票开具后 30 天内可申请换开，跨月换开需先完成红冲',
          page: 6,
          score: 0.84,
        },
        {
          id: `${id}-red-invoice`,
          documentId: '1f7e3a58-9c2b-4d81-b640-8a5e0f2c9d34',
          knowledgeBaseId: 'kb_invoice',
          name: '票据作废与红冲流程.pdf',
          description: '财务票据库 · 红冲操作',
          snippet: '已报销发票需先取得财务确认，再提交红冲申请',
          page: 11,
          score: 0.79,
        },
      ],
      toolCalls: [
        {
          id: `${id}-search`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 2, topScore: 0.84 },
          durationMs: 380,
        },
      ],
      ticketCode: null,
    }
  }

  if (title.includes('会员权益对比')) {
    return {
      content:
        '## 会员权益说明\n\n当前会员等级按近 **12 个月** 的实付金额计算，权益包含：\n\n- 专属客服通道\n- 生日双倍积分\n- 每月免运费券\n\n积分有效期为获取后 **24 个月**，过期前 30 天会通过站内信提醒。',
      confidence: 90,
      durationMs: 420,
      citations: [
        {
          id: `${id}-member`,
          documentId: 'c3a8e6d2-5f47-4b91-9d08-1a6c3e7f2b95',
          knowledgeBaseId: 'kb_member',
          name: '会员等级权益对比表.md',
          description: '会员权益库 · 等级与权益',
          snippet: '会员等级按近 12 个月实付金额计算，不同等级对应不同服务权益',
          page: 2,
          score: 0.93,
        },
        {
          id: `${id}-points`,
          documentId: '8b4f7e21-c09d-4a6b-9e35-2d1a5c8b7f60',
          knowledgeBaseId: 'kb_member',
          name: '会员积分规则说明.docx',
          description: '会员权益库 · 积分有效期',
          snippet: '积分自获取之日起 24 个月内有效，过期前 30 天发送站内信提醒',
          page: 5,
          score: 0.88,
        },
      ],
      toolCalls: [
        {
          id: `${id}-search`,
          name: 'search_knowledge',
          arguments: { query: title, top_k: 5 },
          status: 'success',
          result: { hits: 2, topScore: 0.93 },
          durationMs: 420,
        },
      ],
      ticketCode: null,
    }
  }

  return {
    content:
      '## 退款处理建议\n\n已结合企业知识库检索到以下处理口径：\n\n1. 确认订单是否在签收后 **7 天** 内\n2. 核对商品状态与凭证是否齐全\n3. 在原订单详情提交退款申请并保留沟通记录\n\n退款通常按原支付路径退回，具体到账时间以支付渠道为准。',
    confidence: 92,
    durationMs: 1040,
    citations: [
      {
        id: `${id}-policy`,
        documentId: '9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71',
        knowledgeBaseId: 'kb_aftersale',
        name: '售后退款政策_v2.pdf',
        description: '售后政策库 · 更新于 2026-10-20',
        snippet: '符合本场景的用户，可在签收后 7 天内提交申请，审核通过后原路退回',
        page: 12,
        score: 0.92,
      },
      {
        id: `${id}-guide`,
        documentId: 'd5c92b18-6a4e-4f73-a0d9-3c7b1e8f4025',
        knowledgeBaseId: 'kb_aftersale',
        name: '退换货操作指引_v1.pdf',
        description: '售后政策库 · 操作路径与材料清单',
        snippet: '进入订单详情后选择售后申请，按页面提示上传商品照片与物流凭证',
        page: 3,
        score: 0.86,
      },
      {
        id: `${id}-legacy`,
        documentId: 'b4c1d7e9-2a58-4f63-9b07-8e3d1c5a2f84',
        knowledgeBaseId: 'kb_aftersale',
        name: '退款政策_v1_已废止.pdf',
        description: '售后政策库 · 历史版本',
        snippet: '旧版退款时效为签收后 15 天，已不再适用',
        page: 8,
        score: 0.72,
        unavailable: true,
      },
    ],
    toolCalls: [
      {
        id: `${id}-search`,
        name: 'search_knowledge',
        arguments: { query: title, top_k: 5 },
        status: 'success',
        result: { hits: 3, topScore: 0.92 },
        durationMs: 800,
      },
      {
        id: `${id}-order`,
        name: 'get_order',
        arguments: { orderNo: 'SO-20261103-0042' },
        status: 'success',
        result: {
          orderNo: 'SO-20261103-0042',
          status: '已签收',
          signedAt: '2026-11-01T15:20:00+08:00',
          receiver: '张先生',
          phone: '13800138000',
          address: '上海市浦东新区世纪大道 100 号 3 栋 1201 室',
        },
        durationMs: 240,
      },
    ],
    ticketCode: null,
  }
}

/**
 * 按会话标题生成演示场景
 *
 * 这里只构造页面可展示的数据，不实现意图识别、检索或建单逻辑
 *
 * @param id 会话 id，用于生成消息内唯一标识
 * @param title 会话标题，用于匹配演示场景
 */
export function buildMockScenario(id: string, title: string): MockAnswerScenario {
  return buildScenario(id, title)
}
