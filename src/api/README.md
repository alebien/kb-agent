# 接口层

每个业务域一个文件，负责模拟网络请求。接入真实后端时，只改本目录。

MVP 内：

- `auth.ts`：登录、登出与会话恢复。
- `conversations.ts`：会话列表、详情、创建、重命名、删除、发送消息、停止与重新生成。回答走真实 SSE，事件消费与消息写入集中在 `runAnswerStream`。
- `sse.ts`：SSE 解析与流式传输，不含业务含义，可原样抽到其它项目。
- `knowledge-bases.ts`：知识库列表，固定 5 条，其中 `kb_script` 为 paused。

MVP 外保留，不对应导航入口：

- `documents.ts`：知识库文档列表。
- `eval-cases.ts`：评测用例列表。
- `tickets.ts`：工单列表。

约定：函数返回 `Promise`，失败时 `throw Error`，错误信息可直接展示给用户；会话相关接口统一按 `createdBy` 校验归属，失败抛出 `ConversationForbiddenError`。

列表接口返回前都会拷贝一份数据，调用方可以放心改动，不会影响 mock 源数据。
