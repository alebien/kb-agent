# Mock 数据

这里放可复用的假数据，只描述数据，不写请求逻辑。

MVP 内：

- `conversations.ts`：预置会话摘要，按 `createdBy` 分属两个演示账号。
- `knowledge-bases.ts`：固定 5 个知识库，其中 `kb_script` 为 paused，用于验证暂停库不参与检索。

MVP 外保留：

- `documents.ts`：知识库文档数据。
- `eval-cases.ts`：评测用例数据。
- `tickets.ts`：工单数据。
- `markdown.ts`：Markdown 联调样例。

接口层 `src/api` 负责模拟延迟、缓存和增删改，页面通过 store 或接口取数据。
