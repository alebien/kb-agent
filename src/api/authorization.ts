import type { PermissionCode } from '@/auth'
import { useAuthStore } from '@/stores/auth'

/** 接口层权限错误，真实后端接入后可保留 message 并映射为 HTTP 403 */
export class ForbiddenError extends Error {
  /** 区分权限不足与普通业务异常的错误码 */
  readonly code = 'FORBIDDEN'

  constructor(message = '当前账号无权执行此操作') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/**
 * mock 接口层权限校验
 * 让前端页面与接口使用同一份权限快照，避免绕过按钮直接调用函数
 */
export function assertPermission(required: PermissionCode | PermissionCode[]): void {
  /** 当前登录用户的权限 store */
  const authStore = useAuthStore()

  if (!authStore.can(required)) {
    throw new ForbiddenError()
  }
}
