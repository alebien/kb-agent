# Mock 数据

这里放可复用的假数据，只描述数据，不写请求逻辑。

- `conversations.ts`：预置会话摘要，已接入侧边栏。
- `documents.ts`：文档 mock 数据，待补充。
- `eval-cases.ts`：评测用例 mock 数据，待补充。
- `tickets.ts`：工单 mock 数据，待补充。

接口层 `src/api` 负责模拟延迟、缓存和增删改，页面通过 store 或接口取数据。
