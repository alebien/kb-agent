# 领域类型

这里只放 TypeScript 类型，不放接口请求、mock 数据或 Vue 组件。

- `common.ts`：通用基础类型，如分页、任务状态。
- `message.ts`：聊天消息 `Message`，包含角色、内容、状态、引用和工具调用。
- `conversation.ts`：会话 `Conversation`、摘要、统计、质量指标和链路步骤。
- `citation.ts`：知识来源 `Citation`。
- `tool-call.ts`：工具调用 `ToolCall`。
- `document.ts`：知识库文档 `Document`。
- `eval-case.ts`：评测用例 `EvalCase`。
- `ticket.ts`：工单 `Ticket`，字段待补充。
- `index.ts`：统一出口，业务代码从 `@/domain` 导入。

新增领域对象时，在本目录建文件，并在 `index.ts` 追加导出；每个字段都要写中文注释。
