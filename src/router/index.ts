import { createRouter, createWebHistory } from 'vue-router'
import { setupRouterGuards } from './guard'
import { routes } from './routes'

/** 应用路由实例，历史模式与服务端回退配置保持一致 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  /** 路由切换后回到顶部，对话页自身的消息滚动由 ChatMessageList 维护 */
  scrollBehavior: () => ({ top: 0 }),
})

setupRouterGuards(router)

export default router
