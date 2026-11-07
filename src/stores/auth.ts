import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  GUEST_PERMISSIONS,
  hasPermission,
  PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type PermissionCode,
  type RoleCode,
} from '@/auth'
import { fetchSession } from '@/api/auth'

/** 当前登录用户及其角色、权限快照 */
export interface AuthUser {
  /** 用户唯一标识 */
  id: string
  /** 用户名，用于头像文字与提示 */
  name: string
  /** 用户拥有的角色，一个账号可同时拥有多个角色 */
  roles: RoleCode[]
  /** 登录时下发的权限快照，页面和接口统一按这份权限判断 */
  permissions: PermissionCode[]
}

/** 登录用户信息的 localStorage 键名 */
const authStorageKey = 'kb-agent:auth-user'
/** 登录令牌的 localStorage 键名 */
const authTokenStorageKey = 'kb-agent:auth-token'
/** 上次登录账号的 localStorage 键名，用于「记住账号」 */
const rememberAccountStorageKey = 'kb-agent:remembered-account'

/** 旧版存储数据没有角色时使用的默认角色，兼容已登录的演示账号 */
const legacyRoles: RoleCode[] = ['knowledge_admin', 'supervisor']

/** 合并多个角色的权限并去重 */
function mergeRolePermissions(roles: RoleCode[]): PermissionCode[] {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]))]
}

/** 判断值是否为合法的角色标识 */
function isRoleCode(value: unknown): value is RoleCode {
  return value === 'agent' || value === 'knowledge_admin' || value === 'supervisor'
}

/** 判断值是否为合法的权限码 */
function isPermissionCode(value: unknown): value is PermissionCode {
  return typeof value === 'string' && Object.values(PERMISSIONS).includes(value as PermissionCode)
}

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

    /** 恢复后的角色列表，旧数据缺少角色或角色全部非法时按演示管理员处理 */
    const storedRoles = Array.isArray(value.roles)
      ? value.roles.filter((role): role is RoleCode => isRoleCode(role))
      : legacyRoles
    const roles = storedRoles.length ? storedRoles : legacyRoles
    /** 恢复后的权限快照，旧数据缺少权限或权限全部非法时按角色重新展开 */
    const storedPermissions = Array.isArray(value.permissions)
      ? value.permissions.filter((permission): permission is PermissionCode =>
          isPermissionCode(permission),
        )
      : mergeRolePermissions(roles)
    const permissions = storedPermissions.length ? storedPermissions : mergeRolePermissions(roles)

    return {
      id: value.id,
      name: value.name,
      roles,
      permissions,
    }
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  /** 当前登录用户，`null` 表示未登录 */
  const user = ref<AuthUser | null>(readStoredUser())
  /** 是否已登录，由 `user` 派生 */
  const isLoggedIn = computed(() => user.value !== null)
  /** 当前生效的权限集合，未登录时使用访客权限 */
  const permissions = computed<PermissionCode[]>(() => user.value?.permissions ?? GUEST_PERMISSIONS)
  /** 当前用户的角色名称列表，用于头像菜单展示 */
  const roleLabels = computed(() => (user.value?.roles ?? []).map((role) => ROLE_LABELS[role]))
  /** 登录弹窗是否打开 */
  const isLoginDialogOpen = ref(false)
  /** 当前登录令牌，暂存于内存并在登录成功后持久化 */
  const token = ref(readStoredValue(authTokenStorageKey))
  /** 上次成功登录的账号，用于预填表单 */
  const rememberedAccount = ref(readStoredValue(rememberAccountStorageKey))
  /** 登录成功后需要返回的原始地址，空字符串表示不跳转 */
  const pendingRedirect = ref('')
  /** 是否已经向 mock 服务端同步过权限快照，避免重复请求 */
  let hasSyncedSession = false

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

  /** 写入登录用户、角色和权限快照，并持久化到 localStorage */
  function login(nextUser: AuthUser, nextToken = '') {
    hasSyncedSession = true

    /** 合并后的角色，未传角色时按演示管理员处理 */
    const roles = nextUser.roles.length ? nextUser.roles : legacyRoles
    /** 优先使用后端下发的权限，未传时按角色展开 */
    const nextPermissions = nextUser.permissions.length
      ? [...new Set(nextUser.permissions)]
      : mergeRolePermissions(roles)

    user.value = {
      id: nextUser.id,
      name: nextUser.name,
      roles: [...roles],
      permissions: nextPermissions,
    }
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
    hasSyncedSession = false
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

  /** 判断当前用户是否拥有指定权限，数组表示需要同时满足 */
  function can(required: PermissionCode | PermissionCode[] | undefined): boolean {
    return hasPermission(permissions.value, required)
  }

  /**
   * 从服务端刷新当前用户的角色与权限
   * 页面刷新或权限调整后调用，失败时直接退出登录，防止继续使用过期权限
   */
  async function syncSession() {
    if (!token.value || hasSyncedSession) {
      return
    }

    hasSyncedSession = true

    try {
      /** 服务端返回的最新会话信息 */
      const session = await fetchSession(token.value)
      login(session.user, session.token)
    } catch {
      hasSyncedSession = false
      logout()
    }
  }

  return {
    user,
    isLoggedIn,
    permissions,
    roleLabels,
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
    can,
    syncSession,
  }
})
