import type { App, Directive, DirectiveBinding } from 'vue'
import type { PermissionCode } from '@/auth'
import { useAuthStore } from '@/stores/auth'

/** 权限指令绑定的值，支持单个权限或多个权限同时满足 */
type PermissionBindingValue = PermissionCode | PermissionCode[]

/** 记录元素原始显示方式，权限恢复时按原值还原 */
const originalDisplay = new WeakMap<HTMLElement, string>()

/** 根据当前权限快照显示或隐藏元素，不做整块 DOM 删除 */
function applyPermission(el: HTMLElement, binding: DirectiveBinding<PermissionBindingValue>) {
  /** 当前登录用户的权限快照 */
  const authStore = useAuthStore()
  /** 是否拥有指令要求的权限 */
  const allowed = authStore.can(binding.value)

  if (!originalDisplay.has(el)) {
    originalDisplay.set(el, el.style.display)
  }

  el.style.display = allowed ? (originalDisplay.get(el) ?? '') : 'none'
}

/** v-permission 指令，按钮级权限控制入口 */
export const permissionDirective: Directive<HTMLElement, PermissionBindingValue> = {
  mounted: applyPermission,
  updated: applyPermission,
}

/** 注册全局权限指令 */
export function setupPermissionDirective(app: App) {
  app.directive('permission', permissionDirective)
}
