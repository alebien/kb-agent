import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/** 会话 id 的 UUID v4 校验规则，不符合时回落到新对话页 */
const conversationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * 注册全局路由守卫
 * 先校验地址参数，再校验登录态；登录成功后的回跳由登录弹窗读取 pendingRedirect 完成
 */
export function setupRouterGuards(router: Router) {
  router.beforeEach((to) => {
    // 非 UUID v4 的会话 id 直接回落草稿页，不发起无意义的详情请求
    if (to.name === 'chat') {
      /** 当前路由中的会话 id，用户可手动修改地址栏 */
      const conversationId = to.params.conversationId
      if (typeof conversationId !== 'string' || !conversationIdPattern.test(conversationId)) {
        return { name: 'chat-draft' }
      }
    }

    // 草稿页与重定向路由不要求登录
    if (to.meta.requiresAuth !== true) {
      return true
    }

    /** 当前登录状态，守卫内读取可保证拿到最新的 store 快照 */
    const authStore = useAuthStore()
    if (authStore.isLoggedIn) {
      return true
    }

    // 未登录时打开登录框并记录原目标地址，页面先落到草稿页避免白屏
    authStore.openLoginDialog(to.fullPath)
    return { name: 'chat-draft', query: { redirect: to.fullPath } }
  })

  router.afterEach((to) => {
    /** 页面标题，优先使用顶部栏标题，缺失时退回菜单简称 */
    const pageTitle = to.meta.pageTitle ?? to.meta.title
    document.title = pageTitle ? `${pageTitle} · KnoAgent` : 'KnoAgent'
  })
}
