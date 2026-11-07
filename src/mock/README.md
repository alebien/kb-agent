# Mock 数据

这里放可复用的假数据，只描述数据，不写请求逻辑。

- `conversations.ts`：预置会话摘要，已接入侧边栏。
- `documents.ts`：知识库文档 `documents`，覆盖 5 个知识库与 4 种解析状态。
- `eval-cases.ts`：评测用例 `evalCases`，按 4 个评测集组织。
- `tickets.ts`：工单 `tickets`，工单号与会话摘要里的编号对齐。

接口层 `src/api` 负责模拟延迟、缓存和增删改，页面通过 store 或接口取数据。
