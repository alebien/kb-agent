<script setup lang="ts">
import { ref } from 'vue'
import ChatPanel from './ChatPanel.vue'

/**
 * 第 6 步的外壳
 *
 * 聊天逻辑在 ChatPanel 里，这一层只负责两件事：
 * 1. 开关面板 = 卸载组件，用来看 onUnmounted 有没有把连接掐掉
 * 2. 切断流模式，用来看 failed 状态
 */

/** 是否挂载聊天面板，取消勾选就是卸载组件 */
const mounted = ref(true)

/** 切到断流模式：换地址参数重新打开本页，mock 服务会在生成到 40% 时发 error */
function useBrokenMode() {
  window.location.search = '?scenario=broken'
}

/** 切回正常模式 */
function useNormalMode() {
  window.location.search = ''
}
</script>

<template>
  <div class="lab">
    <h1>第 6 步 · useChat</h1>
    <p class="tip">
      这一页所有日志、状态、正文都来自 <code>src/composables/useChat.ts</code>。页面本身没有 fetch，
      也没有解析器。
    </p>

    <div class="row">
      <label class="switch">
        <input v-model="mounted" type="checkbox" />
        挂载聊天面板（取消勾选＝卸载组件）
      </label>
      <button class="btn" @click="useBrokenMode">切到断流模式</button>
      <button class="btn" @click="useNormalMode">切回正常</button>
    </div>

    <p v-if="!mounted" class="tip warn">
      组件已卸载。去 Network 看那条 /api/dev/sse/chat：是不是 canceled。控制台不该有红字。
    </p>

    <ChatPanel v-if="mounted" />
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 24px 16px 60px;
  background: #f5f6f8;
  color: #1f2328;
  font:
    15px/1.7 system-ui,
    -apple-system,
    'Segoe UI',
    'Microsoft YaHei',
    sans-serif;
}

code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #eceff3;
  font-size: 13px;
}
</style>

<style scoped>
.lab {
  max-width: 760px;
  margin: 0 auto;
}

h1 {
  margin: 0 0 6px;
  font-size: 20px;
}

.tip {
  margin: 0 0 12px;
  color: #6b7178;
  font-size: 13px;
}

.tip.warn {
  padding: 8px 12px;
  border-left: 3px solid #e8a33d;
  background: #fff8e8;
  color: #8a6320;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.switch {
  font-size: 13px;
  color: #3d4248;
}

.btn {
  font: inherit;
  font-size: 13px;
  padding: 5px 12px;
  border: 1px solid #cfd4da;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
}
</style>
