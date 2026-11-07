import { createRouter, createWebHistory } from 'vue-router'
import { checkRouteAuth } from '@/auth/guard'

/** 会话 id 的 UUID v4 校验规则，不符合时回退到新对话页 */
const conversationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 应用路由实例 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layout/LayoutIndex.vue'),
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
            // 草稿页对游客开放，提交提问时再由页面弹出登录框
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
            requiresAuth: true,
          },
        },
        {
          path: 'documents',
          name: 'documents',
          component: () => import('@/views/DocumentsView.vue'),
          meta: {
            title: '文档',
            pageTitle: '知识文档',
          },
        },
        {
          path: 'evaluation',
          name: 'evaluation',
          component: () => import('@/views/EvaluationView.vue'),
          meta: {
            title: '评测中心',
            pageTitle: '评测中心',
          },
        },
        {
          path: 'tickets',
          name: 'tickets',
          component: () => import('@/views/TicketsView.vue'),
          meta: {
            title: '工单',
            pageTitle: '工单管理',
          },
        },
        {
          path: 'dev/markdown',
          name: 'markdown-preview',
          component: () => import('@/views/MarkdownPreviewView.vue'),
          meta: {
            title: 'Markdown 联调',
            pageTitle: 'Markdown 联调',
          },
        },
        {
          path: 'forbidden',
          name: 'forbidden',
          component: () => import('@/views/ForbiddenView.vue'),
          meta: {
            title: '无权访问',
            pageTitle: '无权访问',
          },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/chat/new',
    },
  ],
})

router.beforeEach((to) => {
  // 先校验会话 id 格式：非法 id 直接回草稿页，不打扰游客登录
  if (to.name === 'chat') {
    /** 当前路由中的会话 id */
    const conversationId = to.params.conversationId
    if (typeof conversationId !== 'string' || !conversationIdPattern.test(conversationId)) {
      return '/chat/new'
    }
  }

  /** 当前路由是否需要登录，MVP 只有真实会话页需要 */
  const requiresAuth = to.meta.requiresAuth === true
  if (!requiresAuth) {
    return true
  }

  /** 登录态校验结果，true 表示放行 */
  const authResult = checkRouteAuth(to.fullPath)
  return authResult === true ? true : authResult
})

router.afterEach((to) => {
  /** 浏览器标签页标题，优先使用页面标题 */
  const pageTitle = (to.meta.pageTitle ?? to.meta.title) as string | undefined
  document.title = pageTitle ? `${pageTitle} · KnoAgent` : 'KnoAgent'
})

export default router
