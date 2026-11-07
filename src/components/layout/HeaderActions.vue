<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { logout as requestLogout } from '@/api/auth'

/** 登录状态 store，控制头像展示与登录弹窗 */
const authStore = useAuthStore()
/** 当前路由信息，用于退出登录后的页面回流 */
const route = useRoute()
/** 路由实例，退出登录时离开受保护页面 */
const router = useRouter()

/** 头像提示文案：已登录显示用户名，未登录显示「未登录」 */
const displayName = computed(
  () => authStore.user?.name.trim() || (authStore.isLoggedIn ? '用户' : '未登录'),
)
/** 头像内展示的文字：登录后取用户名首字，未登录显示「未登录」 */
const avatarText = computed(() =>
  authStore.isLoggedIn ? displayName.value.slice(0, 1).toUpperCase() : '未登录',
)
/** 当前账号角色文案，统一从权限模型派生 */
const roleText = computed(() => authStore.roleLabels.join(' / ') || '普通用户')

/** 未登录时点击头像打开登录弹窗 */
function openLogin() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginDialog()
  }
}

/** 处理账号菜单，目前仅支持退出登录 */
async function handleAccountCommand(command: string) {
  if (command !== 'logout') {
    return
  }

  await requestLogout().catch(() => undefined)
  authStore.logout()
  ElMessage.success('已退出登录')

  if (route.meta.permission) {
    await router.push({ name: 'chat-draft' })
  }
}
</script>

<template>
  <div class="header-actions">
    <el-dropdown
      v-if="authStore.isLoggedIn"
      trigger="click"
      placement="bottom-end"
      @command="handleAccountCommand"
    >
      <button type="button" class="account-button" :aria-label="displayName">
        <el-avatar :size="40" class="user-avatar">{{ avatarText }}</el-avatar>
      </button>

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item disabled>
            <div class="account-summary">
              <strong>{{ displayName }}</strong>
              <span>{{ roleText }}</span>
            </div>
          </el-dropdown-item>
          <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-tooltip v-else content="未登录" placement="bottom" :show-after="300">
      <button
        type="button"
        class="account-button is-guest"
        aria-label="未登录，点击登录"
        @click="openLogin"
      >
        <el-avatar :size="40" class="user-avatar is-guest">
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

.account-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}

.account-summary strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.account-summary span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
