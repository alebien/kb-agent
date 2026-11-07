import type { PermissionCode } from './permissions'
import { useAuthStore } from '@/stores/auth'

/** 路由守卫的跳转结果，全部返回命名路由以便统一维护地址 */
type RouteGuardRedirect = { name: 'chat-draft' } | { name: 'forbidden'; query: { from: string } }

/**
 * 进入受保护页面前校验登录态和权限码
 * 未登录时打开登录弹窗并回到新对话，已登录但缺权限时进入 403 页面
 */
export function checkRoutePermission(
  required: PermissionCode | PermissionCode[] | undefined,
  fullPath: string,
): true | RouteGuardRedirect {
  /** 当前登录状态与权限快照 */
  const authStore = useAuthStore()

  if (!required) {
    return true
  }

  if (!authStore.isLoggedIn) {
    authStore.openLoginDialog(fullPath)
    return { name: 'chat-draft' }
  }

  if (!authStore.can(required)) {
    return { name: 'forbidden', query: { from: fullPath } }
  }

  return true
}
