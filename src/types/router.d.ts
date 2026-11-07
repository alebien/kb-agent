import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 浏览器标题与菜单简称 */
    title?: string
    /** 顶部栏页面标题 */
    pageTitle?: string
    /** 标题右侧状态标签 */
    status?: string
    /** 访问页面是否需要登录，MVP 只给对话页开启 */
    requiresAuth?: boolean
  }
}
