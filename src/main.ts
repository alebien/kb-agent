import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './assets/layout.css'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

/** Vue 应用实例 */
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')

/** 应用挂载后同步登录态，刷新页面时以 mock 服务端返回的身份为准 */
void useAuthStore().syncSession()
