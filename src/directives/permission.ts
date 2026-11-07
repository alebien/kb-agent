import type { App, Directive, DirectiveBinding } from 'vue'
import type { PermissionCode } from '@/auth'

/**
 * 权限指令绑定的值，支持单个权限码或多个权限码
 * MVP 单角色下不再参与展示判定，只保留类型签名供后续后台模块恢复
 */
type PermissionBindingValue = PermissionCode | PermissionCode[]

/**
 * v-permission 指令
 * 当前产品只有一个客服角色，指令不隐藏任何元素；
 * 多角色与工单后台恢复时，再把权限快照判断接回 mounted 与 updated
 */
export const permissionDirective: Directive<HTMLElement, PermissionBindingValue> = {
  mounted(_el: HTMLElement, _binding: DirectiveBinding<PermissionBindingValue>) {
    // MVP 不按权限码隐藏元素
  },
  updated(_el: HTMLElement, _binding: DirectiveBinding<PermissionBindingValue>) {
    // MVP 不按权限码隐藏元素
  },
}

/** 注册全局权限指令，保留调用点避免后续恢复时改 main.ts */
export function setupPermissionDirective(app: App) {
  app.directive('permission', permissionDirective)
}
