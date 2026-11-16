import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { mockSseServer } from './dev/mock-sse-server'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    // 开发环境提供真实 SSE 端点，接真实后端后可整行删除
    mockSseServer(),
  ],
  server: {
    proxy: {
      // 只代理 /api/chat，不要写成 /api
      // 否则会把 mock 的 /api/dev/sse/chat 也转给 Python，两套实现就没法对照
      '/api/chat': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
