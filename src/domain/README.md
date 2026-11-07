# 领域类型

这里只放 TypeScript 类型，不放接口请求、mock 数据或 Vue 组件。

- `common.ts`：通用分页参数、分页结果与任务状态。
- `message.ts`：聊天消息 `Message`，包含角色、内容、状态、引用和工具调用。
- `conversation.ts`：会话详情 `Conversation` 与摘要；统计、质量指标与链路步骤供未挂载的观测面板保留使用。
- `citation.ts`：知识来源 `Citation`。
- `tool-call.ts`：工具调用 `ToolCall`。
- `knowledge-base.ts`：知识库 `KnowledgeBase`，固定 5 个业务域。
- `document.ts`：文档 `Document`，本版只读，作为引用溯源的数据契约。
- `eval-case.ts`：评测用例 `EvalCase`，MVP 外保留。
- `ticket.ts`：工单 `Ticket`，保留完整模型，MVP 只使用建单字段。
- `index.ts`：统一出口，业务代码从 `@/domain` 导入。

新增领域对象时，在本目录建文件，并在 `index.ts` 追加导出；每个字段都要写中文注释。
