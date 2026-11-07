import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/** 当前登录用户，仅用于控制菜单与内容展示 */
export interface AuthUser {
  /** 用户唯一标识 */
  id: string
  /** 用户名，用于头像文字与提示 */
  name: string
}

/** 登录用户信息的 localStorage 键名 */
const authStorageKey = 'kb-agent:auth-user'
/** 登录令牌的 localStorage 键名 */
const authTokenStorageKey = 'kb-agent:auth-token'
/** 上次登录账号的 localStorage 键名，用于「记住账号」 */
const rememberAccountStorageKey = 'kb-agent:remembered-account'

/** 从 localStorage 读取登录用户，数据非法或不可用时返回 `null` */
function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    /** localStorage 中的原始用户 JSON */
    const raw = window.localStorage.getItem(authStorageKey)
    if (!raw) {
      return null
    }

    /** 解析后的用户对象，字段需在下方校验 */
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
  /** 当前登录用户，`null` 表示未登录 */
  const user = ref<AuthUser | null>(readStoredUser())
  /** 是否已登录，由 `user` 派生 */
  const isLoggedIn = computed(() => user.value !== null)
  /** 登录弹窗是否打开 */
  const isLoginDialogOpen = ref(false)
  /** 当前登录令牌，暂存于内存并在登录成功后持久化 */
  const token = ref(readStoredValue(authTokenStorageKey))
  /** 上次成功登录的账号，用于预填表单 */
  const rememberedAccount = ref(readStoredValue(rememberAccountStorageKey))
  /** 登录成功后需要返回的原始地址，空字符串表示不跳转 */
  const pendingRedirect = ref('')

  /** 读取 localStorage 中的字符串值，异常或缺失时返回空字符串 */
  function readStoredValue(key: string) {
    if (typeof window === 'undefined') {
      return ''
    }

    try {
      return window.localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  }

  /** 打开登录弹窗，已登录时不做任何处理；可记录登录后要返回的地址 */
  function openLoginDialog(redirect = '') {
    if (!user.value) {
      if (redirect) {
        pendingRedirect.value = redirect
      }
      isLoginDialogOpen.value = true
    }
  }

  /** 关闭登录弹窗并清除未完成的跳转意图 */
  function closeLoginDialog() {
    isLoginDialogOpen.value = false
    pendingRedirect.value = ''
  }

  /** 写入登录用户并持久化到 localStorage */
  function login(nextUser: AuthUser, nextToken = '') {
    user.value = { id: nextUser.id, name: nextUser.name }
    token.value = nextToken

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(authStorageKey, JSON.stringify(user.value))
        if (nextToken) {
          window.localStorage.setItem(authTokenStorageKey, nextToken)
        }
      } catch {
        // 登录状态仍保留在当前会话中
      }
    }
  }

  /** 取出并清空登录后的目标地址，避免下次登录重复跳转 */
  function consumePendingRedirect() {
    /** 本次登录后要返回的地址 */
    const redirect = pendingRedirect.value
    pendingRedirect.value = ''
    return redirect
  }

  /** 记住本次登录账号，传空字符串时清除记录 */
  function setRememberedAccount(account: string) {
    rememberedAccount.value = account.trim()

    if (typeof window === 'undefined') {
      return
    }

    try {
      if (rememberedAccount.value) {
        window.localStorage.setItem(rememberAccountStorageKey, rememberedAccount.value)
      } else {
        window.localStorage.removeItem(rememberAccountStorageKey)
      }
    } catch {
      // 记住账号失败不影响本次登录
    }
  }

  /** 退出登录并清除本地持久化信息 */
  function logout() {
    user.value = null
    token.value = ''

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(authStorageKey)
        window.localStorage.removeItem(authTokenStorageKey)
      } catch {
        // 本地存储不可用时只清空内存状态
      }
    }
  }

  return {
    user,
    isLoggedIn,
    isLoginDialogOpen,
    token,
    rememberedAccount,
    pendingRedirect,
    openLoginDialog,
    closeLoginDialog,
    login,
    consumePendingRedirect,
    setRememberedAccount,
    logout,
  }
})
