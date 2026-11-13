import { createApp } from 'vue'
import UseChatLab from './UseChatLab.vue'

/**
 * 第 6 步验证页的入口，对应 kb-agent/usechat-demo.html
 *
 * 和 src/main.ts 完全独立：不装 router、不装 pinia、不装 Element Plus，
 * 就是为了验证 useChat 真的只依赖 vue
 */
createApp(UseChatLab).mount('#app')
