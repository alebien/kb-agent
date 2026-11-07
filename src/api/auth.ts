import type { AuthUser } from '@/stores/auth'
import { ROLE_PERMISSIONS, type RoleCode } from '@/auth'

/** 登录接口入参 */
export interface LoginPayload {
  /** 登录账号 */
  account: string
  /** 登录密码 */
  password: string
}

/** 登录接口返回的用户与令牌 */
export interface LoginResult {
  /** 当前用户基本信息 */
  user: AuthUser
  /** 登录令牌，接入真实后端后用于后续请求鉴权 */
  token: string
}

/** mock 演示账号配置，账号密码与角色一一对应 */
interface DemoAccount {
  /** 登录账号 */
  account: string
  /** 演示密码，仅用于本地 mock */
  password: string
  /** 用户展示名称 */
  name: string
  /** 用户拥有的角色 */
  roles: RoleCode[]
}

/** 演示账号列表，覆盖三类角色并额外保留兼容账号 admin */
const demoAccounts: DemoAccount[] = [
  { account: 'agent', password: '123456', name: '林晓', roles: ['agent'] },
  {
    account: 'knowledge',
    password: '123456',
    name: '周岚',
    roles: ['knowledge_admin'],
  },
  { account: 'supervisor', password: '123456', name: '陈明', roles: ['supervisor'] },
  {
    account: 'admin',
    password: '123456',
    name: '系统管理员',
    roles: ['knowledge_admin', 'supervisor'],
  },
]

/** 模拟网络延迟，返回一个在指定毫秒后完成的 Promise */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

/** 模拟登录请求，账号或密码错误时抛出异常，成功时返回角色与权限快照 */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  /** 去除首尾空白后的账号，密码保持原样 */
  const account = payload.account.trim()

  await delay(620)

  /** 命中的演示账号，账号或密码不匹配时为空 */
  const matched = demoAccounts.find((item) => item.account === account)
  if (!matched || payload.password !== matched.password) {
    throw new Error('账号或密码错误')
  }

  /** 多个角色的权限合并并去重后作为前端权限快照 */
  const permissions = [...new Set(matched.roles.flatMap((role) => ROLE_PERMISSIONS[role]))]

  return {
    user: {
      id: `demo-${matched.account}`,
      name: matched.name,
      roles: [...matched.roles],
      permissions,
    },
    token: `mock-token-${matched.account}-${Date.now()}`,
  }
}

/** 模拟退出登录，真实后端接入后在这里调用 /api/auth/logout */
export async function logout(): Promise<void> {
  await delay(120)
}

/** 当前登录会话信息，包含用户与权限，用于刷新页面后重新校验 */
export interface SessionResult {
  /** 当前登录用户 */
  user: AuthUser
  /** 登录令牌 */
  token: string
}

/**
 * 模拟恢复登录会话
 * 真实后端接入后应调用 /api/auth/session，以服务端返回的角色与权限快照为准
 */
export async function fetchSession(token: string): Promise<SessionResult> {
  await delay(80)

  /** 从 mock 令牌中解析演示账号，令牌格式为 mock-token-{account}-{timestamp} */
  const matchedAccount = token.match(/^mock-token-([a-z]+)-/)?.[1]
  /** 命中的演示账号 */
  const matched = demoAccounts.find((item) => item.account === matchedAccount)

  if (!matched) {
    throw new Error('登录状态已失效，请重新登录')
  }

  /** 按当前角色重新展开的权限快照 */
  const permissions = [...new Set(matched.roles.flatMap((role) => ROLE_PERMISSIONS[role]))]

  return {
    user: {
      id: `demo-${matched.account}`,
      name: matched.name,
      roles: [...matched.roles],
      permissions,
    },
    token,
  }
}
