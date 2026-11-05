import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/** 当前登录用户，仅用于控制菜单与内容展示。 */
export interface AuthUser {
  /** 用户唯一标识。 */
  id: string
  /** 用户名，用于头像文字与提示。 */
  name: string
}

/** 登录用户信息的 localStorage 键名。 */
const authStorageKey = 'kb-agent:auth-user'

/** 从 localStorage 读取登录用户，数据非法或不可用时返回 `null`。 */
function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    /** localStorage 中的原始用户 JSON。 */
    const raw = window.localStorage.getItem(authStorageKey)
    if (!raw) {
      return null
    }

    /** 解析后的用户对象，字段需在下方校验。 */
    const value = JSON.parse(raw) as Partial<AuthUser> | null
    if (!value || typeof value.id !== 'string' || typeof value.name !== 'string') {
      return null
    }

    return { id: value.id, name: value.name }
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  /** 当前登录用户，`null` 表示未登录。 */
  const user = ref<AuthUser | null>(readStoredUser())
  /** 是否已登录，由 `user` 派生。 */
  const isLoggedIn = computed(() => user.value !== null)
  /** 登录弹窗是否打开。 */
  const isLoginDialogOpen = ref(false)

  /** 打开登录弹窗，已登录时不做任何处理。 */
  function openLoginDialog() {
    if (!user.value) {
      isLoginDialogOpen.value = true
    }
  }

  /** 关闭登录弹窗。 */
  function closeLoginDialog() {
    isLoginDialogOpen.value = false
  }

  /** 写入登录用户并持久化到 localStorage。 */
  function login(nextUser: AuthUser) {
    user.value = { id: nextUser.id, name: nextUser.name }
    closeLoginDialog()

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(authStorageKey, JSON.stringify(user.value))
      } catch {
        // 登录状态仍保留在当前会话中。
      }
    }
  }

  /** 退出登录并清除本地持久化信息。 */
  function logout() {
    user.value = null

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(authStorageKey)
    }
  }

  return {
    user,
    isLoggedIn,
    isLoginDialogOpen,
    openLoginDialog,
    closeLoginDialog,
    login,
    logout,
  }
})
