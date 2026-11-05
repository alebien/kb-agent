<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

/** 登录状态 store，控制头像展示与登录弹窗。 */
const authStore = useAuthStore()

/** 头像提示文案：已登录显示用户名，未登录显示「未登录」。 */
const displayName = computed(
  () => authStore.user?.name.trim() || (authStore.isLoggedIn ? '用户' : '未登录'),
)
/** 头像内展示的文字：登录后取用户名首字，未登录显示「未登录」。 */
const avatarText = computed(() =>
  authStore.isLoggedIn ? displayName.value.slice(0, 1).toUpperCase() : '未登录',
)

/** 未登录时点击头像打开登录弹窗。 */
function openLogin() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginDialog()
  }
}
</script>

<template>
  <div class="header-actions">
    <el-tooltip :content="displayName" placement="bottom" :show-after="300">
      <button
        type="button"
        class="account-button"
        :class="{ 'is-guest': !authStore.isLoggedIn }"
        :aria-label="displayName"
        @click="openLogin"
      >
        <el-avatar :size="40" class="user-avatar" :class="{ 'is-guest': !authStore.isLoggedIn }">
          {{ avatarText }}
        </el-avatar>
      </button>
    </el-tooltip>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.account-button {
  display: inline-flex;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 50%;
}

.account-button.is-guest {
  cursor: pointer;
}

.account-button:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 2px;
}

.user-avatar {
  background: var(--el-color-primary);
  font-weight: 500;
}

.user-avatar.is-guest {
  --el-avatar-text-size: 11px;
  letter-spacing: -0.02em;
}
</style>
