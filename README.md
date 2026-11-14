# KnoAgent 客服 Agent

客服工作台里的 AI 助手，按《KnoAgent 客服 Agent · 产品需求文档（PRD · 精简版 MVP）v2.0》实现，页面状态同步记录见 PRD v2.0.1。

对外只做一个 Agent：登录、管理自己的会话、提问、查看引用、查订单与转人工建单。文档库、评测中心、工单后台与多角色权限属于 MVP 外能力，代码按 PRD 保留、导航入口隐藏，不参与本期验收。

## 技术栈

- Vue 3 + TypeScript + Vite
- Element Plus
- Pinia
- Vue Router

数据由 `src/api` 模拟接口 + `src/mock` 静态数据提供，接入真实后端时只需替换接口层。

## 演示账号

| 账号   | 密码   | 说明                          |
| ------ | ------ | ----------------------------- |
| agent  | 123456 | 演示账号一，会话创建人 u_1001 |
| agent2 | 123456 | 演示账号二，会话创建人 u_1002 |

两个账号用于验证会话按 `createdBy` 隔离，互相看不到对方创建的会话。

## 路由

对外只有两条路由，登录由全局弹窗承载：

| 路径                    | 名称       | 说明                             |
| ----------------------- | ---------- | -------------------------------- |
| `/chat/new`             | chat-draft | 新对话草稿页，游客可访问         |
| `/chat/:conversationId` | chat       | 真实会话页，需登录且校验会话归属 |

以下路由代码保留、导航入口隐藏，不参与本期验收：

| 路径            | 名称             | 说明                            |
| --------------- | ---------------- | ------------------------------- |
| `/documents`    | documents        | 文档库占位页                    |
| `/evaluation`   | evaluation       | 评测中心占位页                  |
| `/tickets`      | tickets          | 工单管理占位页                  |
| `/forbidden`    | forbidden        | 无权限页，单角色下不产生跳转    |
| `/dev/markdown` | markdown-preview | Markdown 联调页，仅开发环境注册 |

`/` 与未匹配路径统一重定向到 `/chat/new`；非 UUID v4 的会话 id 同样回落到草稿页。

## 目录结构

```text
dev/
└── mock-sse-server.ts      # 开发环境的 SSE 端点，提供真实流式演示
src/
├── api/                    # 模拟接口层，接入真实后端时只改这里
│   ├── auth.ts             # 登录、登出、会话恢复
│   ├── conversations.ts    # 会话与消息流
│   ├── sse.ts              # SSE 解析与流式传输，不含业务
│   ├── knowledge-bases.ts  # 知识库列表（固定 5 条）
│   ├── documents.ts        # 文档列表，MVP 外保留
│   ├── eval-cases.ts       # 评测用例，MVP 外保留
│   └── tickets.ts          # 工单列表，MVP 外保留
├── assets/                 # 全局样式与主题变量
├── auth/                   # 权限码定义，保留但不参与判定
├── components/
│   ├── auth/               # LoginDialog
│   ├── chat/               # 消息流、输入框、消息项、空态、观测面板
│   ├── common/             # MarkdownRenderer
│   ├── documents/          # 文档列表空壳
│   ├── evaluation/         # 评测用例列表空壳
│   ├── layout/             # Header、Sidebar、会话列表与操作菜单
│   └── tickets/            # 工单列表空壳
├── composables/            # useChatSession、useAppViewportHeight
├── directives/             # v-permission，保留但未注册
├── domain/                 # 领域类型
├── layouts/                # AppLayout
├── mock/                   # 会话、知识库与后移模块的静态数据
├── router/                 # routes、guard、index
├── services/               # analytics 埋点入口与 8 个核心事件
├── stores/                 # auth、conversations 及后移模块骨架
├── types/                  # RouteMeta 等全局类型扩展
├── utils/                  # datetime、debounce、markdown、mask
├── views/                  # ChatView 及隐藏的占位页
├── App.vue
└── main.ts
```

## 对话页交互细节

- 加载态：会话详情超过 800ms 才显示 loading，请求超过 10 秒按超时进入错误态；会话列表加载时显示骨架
- 错误态：详情加载失败给出原因、重试与新建对话入口；会话列表失败保留旧数据并提供重试
- 空态：草稿页与「真实但无消息」的会话使用不同文案，草稿页不抢占输入框焦点
- 长内容：超过 900 字默认折叠，折叠按段落边界截断并自动补齐未闭合代码块；代码块超过约 20 行内部滚动
- 流式渲染：增量按消息 id 追加，Markdown 渲染 80ms 节流，滚动跟随按帧合并；列表先按提问归组再渲染，同组只上屏当前版
- 消息操作：助手消息常驻图标按钮，用户消息在悬停或聚焦时出现；悬停图标显示文字说明
- 复制：助手回答提供「复制文本」与「复制为 Markdown」两个选项，用户提问复制纯文本，均对手机号与邮箱脱敏
- 重试：只有回答最后一条提问的那一组可重新生成；组内任意版本点击都是「按该提问重新请求」，结果追加为最新版，原版本保留、消息条数加一
- 多版分页：同一提问的多个回答按 `replyToMessageId` 归组，折叠为一条展示，操作栏右侧显示 `‹ 2/2 ›` 分页器，默认最新版，箭头切换时正文、引用、工具、质量提示同步换；单版组不显示分页器
- 工单归属：工单号取会话级 `ticketCode`，随会话变化；「转人工」入口与工单提示行只在最新版显示，翻到历史版时只剩正文、引用、工具与质量提示
- 引用溯源：引用卡片展示页码、相似度与片段，点击打开来源抽屉；来源下线时卡片置灰，文档缺失时提示「文档已删除或无权访问」
- 工具调用：检索、查订单、建单三类工具展示等待、执行、成功、失败四态；订单结果对手机号、姓名与门牌号脱敏，失败态展示错误码与降级提示
- 置信度：85 及以上绿色、75 至 84 黄色、低于 75 红色；无引用时展示兜底横幅与转人工入口，低置信度展示已转人工与工单号
- 质量提示：助手回答下方默认收起总耗时、引用数、置信度，展开后按「检索 → 查订单 → 建单」固定顺序展示工具链路
- 建单弹窗：展示标题、分类、优先级与关联会话，宽度为 `min(460px, 92vw)`；会话已有工单时提示复用规则，是否复用仍由后端判定
- 来源抽屉：宽度为 `min(420px, 92vw)`，并在 420px 以下用媒体查询兜底到 92vw
- 快捷键：Enter 发送、Shift + Enter 换行、Esc 关闭侧边栏抽屉、Ctrl/Cmd + B 折叠侧边栏、Ctrl/Cmd + K 聚焦输入框

演示数据覆盖三档置信度、工具失败降级、零引用兜底与澄清轮；`agent` 默认可见退款政策、发票、会员、赔付与澄清场景，`agent2` 可见物流与话术场景。

## MVP 外保留说明

- 文档库、评测中心、工单管理只有页面与列表空壳，不接导航入口
- `ConversationInsightPanel.vue` 保留但不挂载，`ChatView` 不引用
- `src/auth/permissions.ts` 与 `src/directives/permission.ts` 保留代码，单角色下不参与路由、菜单与按钮判定
- `/dev/markdown` 只在开发环境注册

## 流式实现（SSE）

回答现在是真实的 `text/event-stream`，不是前端定时器伪造的假流：

- `src/api/sse.ts`：传输层。用 `fetch` + `ReadableStream` 手写解析，按空行切事件，兼容 `\r\n`、跨 chunk 分包与结尾缺空行；不用 `EventSource`，因为需要 POST 请求体、自定义请求头与 `AbortController`
- `src/api/conversations.ts`：业务层。`runAnswerStream` 消费事件写消息，`stopMessage` 通过 `abort()` 直接关闭连接，已生成内容保留
- `dev/mock-sse-server.ts`：开发端点。Vite 插件的 connect 中间件，只在 `pnpm dev` 下提供 `POST /api/dev/sse/chat`，接真实后端时删掉插件、改掉 `STREAM_URL` 即可
- `src/components/dev/SseDebugPanel.vue`：开发调试面板。展示原始事件、切换分片大小、模拟断流，只在 `pnpm dev` 下出现

完成语义：`done` 是唯一的成功信号。业务层收到 `done` 后立即停止读取并释放连接，不依赖网关关闭长连接；连接提前关闭但没有 `done` 时按失败处理，避免把半截回答显示成完整回答

事件约定：

| 事件       | 负载                                        | 说明                                    |
| ---------- | ------------------------------------------- | --------------------------------------- |
| `start`    | `{ answerId, model, createdAt }`            | 建连成功                                |
| `tool`     | `ToolCall`                                  | 同一个 id 先推 `running` 再推 `success` |
| `citation` | `Citation`                                  | 可多次，前端按 id 覆盖                  |
| `delta`    | `{ text }`                                  | 增量正文，前端追加                      |
| `done`     | `{ confidence, model, durationMs, tokens }` | 收尾统计                                |
| `error`    | `{ message }`                               | 生成中途失败，前端走失败态              |

自测原始报文：

```sh
pnpm dev
curl -N -X POST http://localhost:5173/api/dev/sse/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"发票怎么换开","answerId":"demo"}'
```

`-N` 关闭 curl 缓冲，能逐条看到事件与 `: ping` 心跳。另外两个 query 开关：

- `?scenario=broken`：生成到 40% 时断开，用来验证错误态
- `?scenario=keep-alive`：`done` 之后保持连接 1.5 秒，用来验证前端不依赖断连判定完成
- `?chunkSize=20`：每帧字符数（默认 6），改它只变颗粒度、不变总耗时，可对比「细腻打字机」与「整段蹦出」两种体感

注意：SSE 端点只在 `pnpm dev` 下存在，`pnpm preview` 静态预览时发送消息会走失败分支。

## 开发命令

```sh
pnpm install
pnpm dev          # 本地开发
pnpm type-check   # 类型检查
pnpm lint         # oxlint + eslint
pnpm build        # 类型检查并构建
```

## 代码规范

- 新增或修改的变量必须写中文注释，包括常量、`ref`、`computed`、`props` 字段、接口字段与 store 状态
- 类型、函数与导出成员使用 JSDoc，简单局部变量可用行内 `//`
- 注释说明用途、来源或边界条件，结尾不加句号

## 验收状态（D6 走查，2026-11-14）

按 PRD 第十三章 12 项逐条走查的结果：

| #   | 验收项         | 结果                                             |
| --- | -------------- | ------------------------------------------------ |
| 1   | 页面与路由     | 通过                                             |
| 2   | 登录闭环       | 通过                                             |
| 3   | 会话隔离       | 通过                                             |
| 4   | 会话管理       | 通过                                             |
| 5   | 对话交互       | 通过：重试追加新消息并保留原回答，多版分页可切换 |
| 6   | 引用溯源       | 通过                                             |
| 7   | 置信度口径     | 通过                                             |
| 8   | 工具与降级     | **待补**：缺订单号不追问                         |
| 9   | 防重复建单     | 通过                                             |
| 10  | 质量提示       | **待定口径**：三步耗时之和与总耗时不等           |
| 11  | 时间与脱敏     | 通过                                             |
| 12  | 通用体验与工程 | 通过：360px 下建单弹窗与来源抽屉均收窄到视口 92% |

工程口径：`pnpm type-check` 无类型错误；`pnpm build` 通过，主入口 `index` 约 1,041 kB，触发 Vite 的 500 kB chunk 告警；控制台除 Vue DevTools 扩展重复安装的提示外无报错。

## 已知问题

1. **缺订单号不追问**（第 8 项）：提问里没有订单号时不会反问「请提供订单号」，也没有订单号格式校验，直接走通用回答。追问属于 Agent 侧行为，等后端接入后随 `get_order` 一起补。
2. **三步耗时之和与总耗时不一致**（第 10 项）：预置会话里两者相等，实时提问时「检索」一步固定 360ms、总耗时取真实生成时长，差额约 2.4 秒，超出 100ms 的验收要求。根因是口径未定：三步只含工具调用，总耗时含模型生成。需要先定「总耗时是否含生成」，再接后端。
3. **会话标题占 25 个字符位**：标题取首条提问前 24 字符后追加省略号，实际渲染 25 位，且 emoji 可能被切半。
4. **演示工单数据存在交叉**：`A1026` 标为新建但工单表里已是已结单状态，`A1025` 关联的文档与话术场景不一致，演示时避免用这两条做二次建单演示。
5. **脱敏未完全收口**：`ToolCallCard` 内自写地址脱敏正则，未统一走 `src/utils/mask.ts`。
6. **`intentConfidence` 承载位置**：PRD 9.3 要求挂在 user 消息上，当前挂在会话摘要上，接后端时需对齐。
7. **主包体积**：`index` 约 1,041 kB，超过 500 kB 告警线，计划后续用 `manualChunks` 拆 vendor。

## 已知取舍

- **重试采用「追加新消息 + 同组多版分页」**：数据层每次重试都新增一条消息，页面按 `replyToMessageId` 归组后只展示当前版。业界另一种做法是把多版存在同一条消息里用 `variants[]` 切换，两者体验相近，后者需要后端支持版本字段，本期不引入。
- **工单复用判定归后端**：前端只展示 `reused` 与 `code`，不自行判断复用或新建。
