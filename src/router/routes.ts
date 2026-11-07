import type { RouteRecordRaw } from 'vue-router'

/**
 * 开发环境专用的 Markdown 联调路由
 * 生产构建不注册，避免联调页进入对外路由表
 */
const devRoutes: RouteRecordRaw[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/markdown',
        name: 'markdown-preview',
        component: () => import('@/views/MarkdownPreviewView.vue'),
        meta: {
          title: 'Markdown 联调',
          pageTitle: 'Markdown 联调',
          deferred: true,
        },
      },
    ]
  : []

/**
 * 应用路由表
 * MVP 对外只有对话工作区两条路由，登录由全局弹窗承载
 * 文档库、评测中心、工单与无权限页按 PRD 6.8 保留代码、隐藏入口，不参与本期验收
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    redirect: '/chat/new',
    children: [
      {
        path: 'chat/new',
        name: 'chat-draft',
        component: () => import('@/views/ChatView.vue'),
        meta: {
          title: '新对话',
          pageTitle: '企业知识库 Agent',
          status: '运行中',
          // 草稿页允许游客进入，提交提问时再由页面弹出登录框
          requiresAuth: false,
        },
      },
      {
        path: 'chat/:conversationId',
        name: 'chat',
        component: () => import('@/views/ChatView.vue'),
        meta: {
          title: '对话',
          pageTitle: '企业知识库 Agent',
          status: '运行中',
          // 真实会话页必须登录，且会话归属由接口层按 createdBy 校验
          requiresAuth: true,
        },
      },
      {
        // 省略会话 id 时回到草稿页，避免出现空白工作区
        path: 'chat',
        redirect: '/chat/new',
      },
      {
        path: 'documents',
        name: 'documents',
        component: () => import('@/views/DocumentsView.vue'),
        meta: {
          title: '文档',
          pageTitle: '知识文档',
          deferred: true,
        },
      },
      {
        path: 'evaluation',
        name: 'evaluation',
        component: () => import('@/views/EvaluationView.vue'),
        meta: {
          title: '评测中心',
          pageTitle: '评测中心',
          deferred: true,
        },
      },
      {
        path: 'tickets',
        name: 'tickets',
        component: () => import('@/views/TicketsView.vue'),
        meta: {
          title: '工单',
          pageTitle: '工单管理',
          deferred: true,
        },
      },
      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/views/ForbiddenView.vue'),
        meta: {
          title: '无权访问',
          pageTitle: '无权访问',
          deferred: true,
        },
      },
      ...devRoutes,
    ],
  },
  {
    // 未匹配路径统一回到新对话页，MVP 不提供 404 页面
    path: '/:pathMatch(.*)*',
    redirect: '/chat/new',
  },
]
