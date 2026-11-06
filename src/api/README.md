# 接口层

每个业务域一个文件，负责模拟网络请求。接入真实后端时，只改本目录。

- `auth.ts`：登录接口。
- `conversations.ts`：会话列表、详情、创建、删除、重命名。
- `documents.ts`：文档接口骨架。
- `eval-cases.ts`：评测用例接口骨架。
- `tickets.ts`：工单接口骨架。

约定：函数返回 `Promise`，失败时 `throw Error`，错误信息可直接展示给用户。
