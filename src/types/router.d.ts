import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 浏览器标题与菜单简称 */
    title?: string
    /** 顶部栏页面标题 */
    pageTitle?: string
    /** 标题右侧的状态标签 */
    status?: string
    /** 访问页面是否需要登录，MVP 只给真实会话页开启 */
    requiresAuth?: boolean
    /** 是否为 MVP 外页面，代码保留但导航入口隐藏 */
    deferred?: boolean
  }
}
