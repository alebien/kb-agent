# RBAC 权限管理方案

## 1 目标

项目采用 RBAC（Role-Based Access Control，基于角色的访问控制）

- 用户通过账号登录，一个用户可拥有一个或多个角色
- 角色只负责聚合权限，页面与接口只判断权限码
- 未登录访客保留免费对话能力，模块入口和受保护内容不展示
- 前端负责菜单、路由和按钮展示，接口层再校验一次，接入真实后端后以服务端结果为准

## 2 权限模型

```
用户 User
  └── 角色 Role
        └── 权限码 Permission
              ├── 页面权限
              └── 操作权限
```

| 层级   | 作用                         | 示例                                |
| ------ | ---------------------------- | ----------------------------------- |
| 用户   | 登录身份与权限快照           | agent、knowledge、supervisor、admin |
| 角色   | 权限集合的命名分组           | 一线客服、知识库管理员、客服主管    |
| 权限码 | 页面和接口实际判断的最小单位 | `document:view`、`chat:rename`      |

新增角色时只调整角色与权限映射，不需要修改页面中的角色名称判断

## 3 权限码

权限码集中定义在 `src/auth/permissions.ts`

| 权限码              | 含义                    | 访客 | 一线客服 | 知识库管理员 | 客服主管 |
| ------------------- | ----------------------- | ---- | -------- | ------------ | -------- |
| `chat:rename`       | 重命名会话              | 否   | 是       | 是           | 是       |
| `chat:delete`       | 删除会话                | 是   | 是       | 是           | 是       |
| `chat:insight:view` | 查看观测面板            | 否   | 是       | 是           | 是       |
| `document:view`     | 查看文档库              | 否   | 是       | 是           | 是       |
| `document:manage`   | 上传、删除、重建索引    | 否   | 否       | 是           | 否       |
| `evaluation:view`   | 查看评测中心            | 否   | 是       | 是           | 是       |
| `evaluation:manage` | 运行评测、沉淀 Bad case | 否   | 否       | 是           | 是       |
| `ticket:view`       | 查看工单                | 否   | 是       | 是           | 是       |
| `ticket:manage`     | 指派、推进状态、结单    | 否   | 是       | 否           | 是       |

说明：一线客服的工单权限在真实后端中还需叠加数据范围限制，例如只能处理本人及未指派工单。权限码只控制操作入口，数据范围由接口查询条件控制

## 4 代码结构

```text
src/
├── auth/
│   ├── permissions.ts     权限码、角色、角色权限映射、访客权限
│   ├── guard.ts           路由守卫使用的权限检查
│   └── index.ts           统一导出
├── directives/
│   └── permission.ts      全局 v-permission 指令
├── stores/
│   └── auth.ts            登录态、角色、权限快照、can、syncSession
├── api/
│   ├── auth.ts            mock 登录、退出、会话恢复
│   └── authorization.ts   mock 接口层权限断言
└── types/
    └── router.d.ts        RouteMeta.permission 类型声明
```

## 5 使用方式

### 5.1 路由权限

在路由 `meta.permission` 中声明页面所需权限

```ts
{
  path: 'documents',
  name: 'documents',
  component: () => import('@/views/DocumentsView.vue'),
  meta: {
    title: '文档',
    pageTitle: '知识文档',
    permission: PERMISSIONS.DOCUMENT_VIEW,
  },
}
```

守卫行为

- 未登录：打开登录弹窗，并回到 `/chat/new`
- 已登录但无权限：进入 `/forbidden`，不渲染目标页面
- 权限满足：正常进入

### 5.2 菜单权限

菜单项复用同一个权限码，由 `authStore.can()` 过滤。访客只保留免费对话与删除会话权限，因此模块菜单不会展示

### 5.3 按钮权限

全局指令 `v-permission` 已注册，适合后续新增的上传、删除、运行评测、结单等按钮

```vue
<el-button v-permission="PERMISSIONS.DOCUMENT_MANAGE" type="primary">
  上传文档
</el-button>

<el-button v-permission="[PERMISSIONS.TICKET_MANAGE, PERMISSIONS.TICKET_VIEW]">
  指派工单
</el-button>
```

传入数组表示需要同时满足

指令采用隐藏元素而不是删除 DOM 的方式，并在 `updated` 时重新计算，因此登录、退出或权限刷新后可以恢复

### 5.4 代码逻辑权限

页面内部需要做条件渲染或提前返回时，使用 store 的 `can`

```ts
if (!authStore.can(PERMISSIONS.CHAT_RENAME)) {
  return
}
```

### 5.5 接口权限

mock 接口在入口处调用 `assertPermission`，避免绕过按钮直接触发操作

```ts
export async function renameConversation(id: string, title: string) {
  assertPermission(PERMISSIONS.CHAT_RENAME)
  // 业务逻辑
}
```

真实后端接入后保留同样的权限码语义，由服务端返回 HTTP 403，并将错误码映射为统一提示

## 6 登录态与权限快照

登录接口返回以下字段

```ts
interface AuthUser {
  id: string
  name: string
  roles: RoleCode[]
  permissions: PermissionCode[]
}
```

`permissions` 是服务端下发的权限快照，前端不再根据角色名临时推断

页面刷新时 `syncSession()` 会使用本地令牌重新获取角色与权限，避免角色调整后继续使用旧权限。获取失败时清除登录态，防止继续访问受保护页面

## 7 演示账号

| 账号         | 密码     | 角色                    |
| ------------ | -------- | ----------------------- |
| `agent`      | `123456` | 一线客服                |
| `knowledge`  | `123456` | 知识库管理员            |
| `supervisor` | `123456` | 客服主管                |
| `admin`      | `123456` | 知识库管理员 + 客服主管 |

## 8 安全边界

- 前端权限只用于控制展示和交互，不是安全边界
- 接口层必须独立校验权限与数据范围，真实后端不能信任前端传入的角色或权限
- 令牌当前保存在 `localStorage`，仅用于演示；生产环境应改用 HttpOnly Cookie 或短时效令牌
- 权限码应保持稳定，展示名称可以变化；不要新增按角色名判断的页面逻辑
- 工单数据范围、文档所属知识库范围属于数据权限，应在接口查询层追加约束，而不是继续细分前端权限码

## 9 扩展方式

新增权限

1. 在 `PERMISSIONS` 中增加权限码
2. 在对应角色的 `ROLE_PERMISSIONS` 中授权
3. 路由配置 `meta.permission`，按钮添加 `v-permission`
4. 接口入口添加 `assertPermission`

新增角色

1. 在 `RoleCode` 中增加角色标识
2. 在 `ROLE_LABELS` 中增加展示名称
3. 在 `ROLE_PERMISSIONS` 中配置权限集合
4. 在 mock 登录账号中绑定角色

页面无需修改，因为页面只认识权限码
