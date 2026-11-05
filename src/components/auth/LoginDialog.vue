<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

/** 登录状态 store，提供弹窗开关。 */
const authStore = useAuthStore()

/** 登录弹窗的显隐状态，与 auth store 双向同步。 */
const visible = computed({
  get: () => authStore.isLoginDialogOpen,
  set: (value: boolean) => {
    if (value) {
      authStore.openLoginDialog()
      return
    }

    authStore.closeLoginDialog()
  },
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="登录"
    width="min(420px, 92vw)"
    align-center
    append-to-body
    modal-class="login-dialog-overlay"
    class="login-dialog"
  >
    <div class="login-dialog__placeholder">
      <!-- 登录表单待补充 -->
    </div>
  </el-dialog>
</template>

<style scoped>
:global(.login-dialog) {
  border-radius: 12px;
}

:global(.login-dialog .el-dialog__header) {
  padding: 24px 24px 8px;
  text-align: center;
}

:global(.login-dialog .el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
}

:global(.login-dialog .el-dialog__body) {
  padding: 16px 24px 24px;
}

.login-dialog__placeholder {
  min-height: 220px;
}

:global(.login-dialog-overlay) {
  backdrop-filter: blur(3px);
}
</style>
