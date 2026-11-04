import { createRouter, createWebHistory } from 'vue-router'
import { defaultConversationId } from '@/data/conversations'

const conversationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layout/LayoutIndex.vue'),
      redirect: `/chat/${defaultConversationId}`,
      children: [
        {
          path: 'chat',
          redirect: `/chat/${defaultConversationId}`,
        },
        {
          path: 'chat/:conversationId',
          name: 'chat',
          component: () => import('@/views/ChatView.vue'),
          beforeEnter: (to) => {
            const conversationId = to.params.conversationId
            return typeof conversationId === 'string' && conversationIdPattern.test(conversationId)
              ? true
              : `/chat/${defaultConversationId}`
          },
          meta: {
            title: '对话',
            pageTitle: '企业知识库 Agent',
            status: '运行中',
            breadcrumb: ['工作台', '客户支持', '对话'],
            menu: '/chat',
          },
        },
        {
          path: 'documents',
          name: 'documents',
          component: () => import('@/views/ModuleView.vue'),
          meta: {
            title: '文档',
            pageTitle: '知识文档',
            breadcrumb: ['工作台', '知识库', '文档'],
            menu: '/documents',
          },
        },
        {
          path: 'evaluation',
          name: 'evaluation',
          component: () => import('@/views/ModuleView.vue'),
          meta: {
            title: '评测中心',
            pageTitle: '评测中心',
            breadcrumb: ['工作台', '知识库', '评测中心'],
            menu: '/evaluation',
          },
        },
        {
          path: 'tickets',
          name: 'tickets',
          component: () => import('@/views/ModuleView.vue'),
          meta: {
            title: '工单',
            pageTitle: '工单管理',
            breadcrumb: ['工作台', '客户支持', '工单'],
            menu: '/tickets',
          },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/ModuleView.vue'),
          meta: {
            title: '设置',
            pageTitle: '系统设置',
            breadcrumb: ['工作台', '系统', '设置'],
            menu: '/settings',
          },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: `/chat/${defaultConversationId}`,
    },
  ],
})

router.afterEach((to) => {
  const pageTitle = to.meta.pageTitle as string | undefined
  document.title = pageTitle ? `${pageTitle} · KnoAgent` : 'KnoAgent'
})

export default router
