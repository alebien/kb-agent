import type { PermissionCode } from '@/auth'
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 浏览器标题与菜单简称 */
    title?: string
    /** 顶部栏页面标题 */
    pageTitle?: string
    /** 标题右侧状态标签 */
    status?: string
    /** 访问页面所需的权限码，未配置表示访客也可访问 */
    permission?: PermissionCode | PermissionCode[]
  }
}
