/** Markdown 假数据集合，按业务场景分组 */
export const markdownSamples = {
  /** 退款政策回答，覆盖标题、列表、表格、引用和链接 */
  refundPolicy: {
    /** 场景标题 */
    title: '退款政策回答',
    /** 可直接赋给 Message.content 的 Markdown 源码 */
    content: `## 退款到账时效说明

订单 **SO-20261103-0042** 的退款申请已于 **2026-10-28 16:42** 审核通过

### 当前进度

1. 商家已确认退款
2. 支付渠道已接收退款指令
3. 银行处理中，预计 1 个工作日内到账

### 到账时效

| 支付方式 | 预计时效 | 备注 |
| --- | --- | --- |
| 微信支付 | 1-3 个工作日 | 节假日顺延 |
| 支付宝 | 1-3 个工作日 | 原路退回 |
| 银行卡 | 3-7 个工作日 | 以银行入账为准 |

> 如果超过预计时效仍未到账，可以在工单 **A1024** 中继续催办

更多规则见 [售后退款政策](/documents/9f2c4e1a-7b3d-4c8f-a1e6-2d5b8c0f4a71)
`,
  },

  /** 发票换开回答，覆盖步骤、材料清单和引用 */
  invoiceFlow: {
    /** 场景标题 */
    title: '发票换开流程',
    /** 可直接赋给 Message.content 的 Markdown 源码 */
    content: `## 发票换开流程

电子普通发票开具后 **30 天内** 可以申请换开，跨月需要先红冲原发票

### 操作步骤

1. 进入「订单详情 → 发票管理」
2. 选择「申请换开」
3. 填写正确的公司名称、税号和开户信息
4. 上传营业执照，专用发票需要
5. 提交后等待财务审核

### 材料清单

- 正确抬头的营业执照
- 纳税人识别号
- 开户行与银行账号
- 原发票号码

> 个人账号不支持开具增值税专用发票

相关文档：[发票开具流程说明](/documents/4b7d2f58-1c9e-4a63-b840-7e5f9a2c6d13)
`,
  },

  /** 会员权益对比，覆盖表格和删除线 */
  membershipComparison: {
    /** 场景标题 */
    title: '会员权益对比',
    /** 可直接赋给 Message.content 的 Markdown 源码 */
    content: `## 年卡与季卡权益对比

| 权益 | 年卡 | 季卡 |
| --- | --- | --- |
| 有效期 | 12 个月 | 3 个月 |
| 购物折扣 | 95 折 | 98 折 |
| 运费券 | 每月 4 张 | 每月 1 张 |
| 专属客服 | 支持 | ~~支持~~ 不支持 |
| 积分倍率 | 1.5 倍 | 1 倍 |

### 注意事项

- 家电、手机等指定品类不参与会员折扣
- 会员折扣不与大促活动叠加
- 积分有效期为获得后 12 个月

> 如果你主要购买家电，建议先确认商品页是否带有「会员折扣」标识

参考：[会员等级权益对比表](/documents/c3a8e6d2-5f47-4b91-9d08-1a6c3e7f2b95)
`,
  },

  /** 物流异常回答，覆盖时间线、表格、分隔线和引用 */
  logisticsIncident: {
    /** 场景标题 */
    title: '物流异常处理',
    /** 可直接赋给 Message.content 的 Markdown 源码 */
    content: `## 物流异常处理建议

包裹在转运中心停留超过 **72 小时** 且没有新轨迹，可以按疑似丢件处理

### 建议处理顺序

1. 联系承运商确认包裹所在网点
2. 发起丢件核查
3. 同步用户预计处理时间
4. 核查完成后补发或退款

### 时效要求

| 环节 | 时效 |
| --- | --- |
| 首次响应 | 30 分钟内 |
| 承运商核查 | 24 小时内 |
| 给出方案 | 48 小时内 |

---

> 当前已创建工单 **A1027**，状态为「处理中」

查看：[物流异常处理规范](/documents/e4a7c1d9-6b2f-4e83-a5c7-9d1f0b8e2a34)
`,
  },

  /** 工具调用结果，覆盖 JSON 代码块和状态表格 */
  toolCallResult: {
    /** 场景标题 */
    title: '工具调用结果',
    /** 可直接赋给 Message.content 的 Markdown 源码 */
    content: `## 工具调用结果

### search_knowledge

~~~json
{
  "query": "退款到账时效",
  "topK": 5,
  "hits": 2,
  "topScore": 0.95
}
~~~

### get_order

~~~json
{
  "orderNo": "SO-20261103-0042",
  "status": "已签收",
  "signedAt": "2026-11-01T15:20:00+08:00"
}
~~~

| 工具 | 状态 | 耗时 |
| --- | --- | --- |
| search_knowledge | success | 820 ms |
| get_order | success | 260 ms |

> 工具结果只作为回答依据，最终结论仍需结合业务规则判断
`,
  },

  /** TypeScript 类型收窄示例，覆盖代码高亮 */
  typescriptNarrowing: {
    /** 场景标题 */
    title: 'TypeScript 类型收窄',
    /** 可直接赋给 Message.content 的 Markdown 源码 */
    content: `## 类型收窄示例

工具调用使用 \`status\` 作为判别字段，可以通过 \`switch\` 安全地访问不同字段

~~~ts
interface ToolCallBase {
  id: string
  name: string
}

type ToolCall =
  | (ToolCallBase & { status: 'pending' })
  | (ToolCallBase & { status: 'running'; startAt: string })
  | (ToolCallBase & { status: 'success'; result: unknown })
  | (ToolCallBase & { status: 'error'; error: string })

function renderToolCall(call: ToolCall): string {
  switch (call.status) {
    case 'pending':
      return '等待执行'
    case 'running':
      return '执行中：' + call.startAt
    case 'success':
      return '执行成功：' + String(call.result)
    case 'error':
      return '执行失败：' + call.error
  }
}
~~~

> 新增状态时，TypeScript 会提示所有未覆盖的分支
`,
  },

  /** 评测报告，覆盖指标表格、问题列表和建议 */
  evalReport: {
    /** 场景标题 */
    title: '评测结果报告',
    /** 可直接赋给 Message.content 的 Markdown 源码 */
    content: `## 评测结果概览

本次评测共运行 **18** 条用例，整体通过率 **72%**

| 指标 | 结果 | 目标 | 状态 |
| --- | --- | --- | --- |
| 通过率 | 72% | 80% | 未达标 |
| 平均得分 | 81.4 | 85 | 接近达标 |
| 引用准确率 | 88% | 90% | 接近达标 |
| 工具成功率 | 100% | 95% | 达标 |

### 主要问题

- 退款类问题对「拆封商品」规则引用不准确
- 发票换开场景遗漏跨月红冲说明
- 物流丢件场景首次响应时效表达不清

### 建议

1. 补充退款品类规则到系统提示词
2. 为发票换开增加结构化流程模板
3. 将物流异常处理时效写入工具返回结果

> 详细失败样例见评测集「退款政策问答集」
`,
  },

  /** 长内容压力测试，覆盖多级标题、嵌套列表、代码、引用和分隔线 */
  longMixedContent: {
    /** 场景标题 */
    title: '长内容压力测试',
    /** 可直接赋给 Message.content 的 Markdown 源码 */
    content: `# 知识库问答压力测试

这是一段用于验证 Markdown 渲染效果的混合内容，包含标题、列表、表格、引用、代码和链接

## 二级标题

### 三级标题

普通段落支持 **加粗**、*斜体*、~~删除线~~、[链接](https://example.com) 和行内代码 \`const answer = 42\`

#### 无序列表

- 第一项
  - 嵌套项 A
  - 嵌套项 B
- 第二项
- 第三项

#### 有序列表

1. 检索知识库
2. rerank 结果
3. 生成回答
4. 返回引用

#### 表格

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 唯一标识 |
| score | number | 相似度分数 |
| snippet | string | 命中片段 |

#### 代码块

~~~bash
npm run type-check
npm run build
~~~

#### 引用

> 数据只存一份，需要不同视图时派生，不要复制

---

最后一段用于验证长内容的换行和滚动表现
`,
  },

  /** 流式输出片段，用于验证未完成内容的渲染和光标样式 */
  streamingPartial: {
    /** 场景标题 */
    title: '流式输出片段',
    /** 可直接赋给 Message.content 的 Markdown 源码 */
    content: `## 正在整理退款说明

已检索到 **2 条**相关资料：

1. 售后退款政策 v2
2. 客服处理 SLA v2

正在核对支付渠道流水
`,
  },
} as const

/** Markdown 场景 key，用于约束按场景取数据的地方 */
export type MarkdownSampleKey = keyof typeof markdownSamples
