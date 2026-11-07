import { useAuthStore } from '@/stores/auth'

/** 路由守卫的跳转结果，全部返回命名路由以便统一维护地址 */
type RouteGuardRedirect = { name: 'chat-draft'; query?: { redirect?: string } }

/**
 * 进入受保护页面前只校验登录态
 * MVP 采用单角色，不再判断权限码；记录原目标地址供登录成功后回跳
 */
export function checkRouteAuth(fullPath: string): true | RouteGuardRedirect {
  /** 当前登录状态 */
  const authStore = useAuthStore()

  if (!authStore.isLoggedIn) {
    authStore.openLoginDialog(fullPath)
    return { name: 'chat-draft', query: { redirect: fullPath } }
  }

  return true
}
