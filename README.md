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
- 流式渲染：增量按消息 id 追加，Markdown 渲染 80ms 节流，滚动跟随按帧合并，列表项用 `v-memo` 跳过无关重渲染
- 消息操作：助手消息常驻图标按钮，用户消息在悬停或聚焦时出现；悬停图标显示文字说明
- 复制：助手回答提供「复制文本」与「复制为 Markdown」两个选项，用户提问复制纯文本，均对手机号与邮箱脱敏
- 重试：只有会话最后一条助手消息可重新生成，历史回答不提供该操作
- 引用溯源：引用卡片展示页码、相似度与片段，点击打开来源抽屉；来源下线时卡片置灰，文档缺失时提示「文档已删除或无权访问」
- 工具调用：检索、查订单、建单三类工具展示等待、执行、成功、失败四态；订单结果对手机号、姓名与门牌号脱敏，失败态展示错误码与降级提示
- 置信度：85 及以上绿色、75 至 84 黄色、低于 75 红色；无引用时展示兜底横幅与转人工入口，低置信度展示已转人工与工单号
- 质量提示：助手回答下方默认收起总耗时、引用数、置信度，展开后按「检索 → 查订单 → 建单」固定顺序展示工具链路
- 建单弹窗：展示标题、分类、优先级与关联会话；会话已有工单时提示复用规则，是否复用仍由后端判定
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

事件约定：

| 事件 | 负载 | 说明 |
| --- | --- | --- |
| `start` | `{ answerId, model, createdAt }` | 建连成功 |
| `tool` | `ToolCall` | 同一个 id 先推 `running` 再推 `success` |
| `citation` | `Citation` | 可多次，前端按 id 覆盖 |
| `delta` | `{ text }` | 增量正文，前端追加 |
| `done` | `{ confidence, model, durationMs, tokens }` | 收尾统计 |
| `error` | `{ message }` | 生成中途失败，前端走失败态 |

自测原始报文：

```sh
pnpm dev
curl -N -X POST http://localhost:5173/api/dev/sse/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"发票怎么换开","answerId":"demo"}'
```

`-N` 关闭 curl 缓冲，能逐条看到事件与 `: ping` 心跳。另外两个 query 开关：

- `?scenario=broken`：生成到 40% 时断开，用来验证错误态
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
