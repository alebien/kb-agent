import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/** 会话 id 的 UUID v4 校验规则，不符合时回退到新对话页。 */
const conversationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 应用路由实例。 */
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
          },
        },
        {
          path: 'documents',
          name: 'documents',
          component: () => import('@/views/DocumentsView.vue'),
          meta: {
            title: '文档',
            pageTitle: '知识文档',
            requiresAuth: true,
          },
        },
        {
          path: 'evaluation',
          name: 'evaluation',
          component: () => import('@/views/EvaluationView.vue'),
          meta: {
            title: '评测中心',
            pageTitle: '评测中心',
            requiresAuth: true,
          },
        },
        {
          path: 'tickets',
          name: 'tickets',
          component: () => import('@/views/TicketsView.vue'),
          meta: {
            title: '工单',
            pageTitle: '工单管理',
            requiresAuth: true,
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
  /** 当前登录状态，用于保护需要登录的模块页。 */
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    authStore.openLoginDialog(to.fullPath)
    return { name: 'chat-draft' }
  }

  if (to.name !== 'chat') {
    return true
  }

  /** 当前路由中的会话 id。 */
  const conversationId = to.params.conversationId
  return typeof conversationId === 'string' && conversationIdPattern.test(conversationId)
    ? true
    : '/chat/new'
})

router.afterEach((to) => {
  /** 浏览器标签页标题，优先使用页面标题。 */
  const pageTitle = (to.meta.pageTitle ?? to.meta.title) as string | undefined
  document.title = pageTitle ? `${pageTitle} · KnoAgent` : 'KnoAgent'
})

export default router
