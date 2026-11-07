import type { AuthUser } from '@/stores/auth'

/** 登录接口入参 */
export interface LoginPayload {
  /** 登录账号 */
  account: string
  /** 登录密码 */
  password: string
}

/** 登录接口返回的用户与令牌 */
export interface LoginResult {
  /** 当前用户基本信息，只有 id 与 name，不含角色与权限 */
  user: AuthUser
  /** 登录令牌，接入真实后端后用于后续请求鉴权 */
  token: string
}

/** mock 演示账号配置，MVP 下所有账号都是同一个客服角色 */
interface DemoAccount {
  /** 登录账号 */
  account: string
  /** 演示密码，仅用于本地 mock */
  password: string
  /** 用户唯一标识，同时作为会话 createdBy 的取值 */
  id: string
  /** 用户展示名称 */
  name: string
}

/**
 * 演示账号列表
 * 提供两个同角色账号，用于验证 FR-1-2 会话按创建人隔离；
 * MVP 不区分角色，因此不再维护 role 与 permission 字段
 */
const demoAccounts: DemoAccount[] = [
  { account: 'agent', password: '123456', id: 'u_1001', name: '林晓' },
  { account: 'agent2', password: '123456', id: 'u_1002', name: '周岚' },
]

/** 模拟网络延迟，返回一个在指定毫秒后完成的 Promise */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

/** 按账号生成登录令牌，真实后端接入后替换为服务端下发的 JWT */
function createToken(account: string): string {
  return `mock-token-${account}-${Date.now()}`
}

/** 模拟登录请求，账号或密码错误时抛出异常，成功时只返回用户与令牌 */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  /** 去除首尾空白后的账号，密码保持原样 */
  const account = payload.account.trim()

  await delay(620)

  /** 命中的演示账号，账号或密码不匹配时为空 */
  const matched = demoAccounts.find((item) => item.account === account)
  if (!matched || payload.password !== matched.password) {
    throw new Error('账号或密码错误')
  }

  return {
    user: { id: matched.id, name: matched.name },
    token: createToken(matched.account),
  }
}

/** 模拟退出登录，真实后端接入后在这里调用 /api/auth/logout */
export async function logout(): Promise<void> {
  await delay(120)
}

/** 当前登录会话信息，用于刷新页面后重新校验 */
export interface SessionResult {
  /** 当前登录用户 */
  user: AuthUser
  /** 登录令牌 */
  token: string
}

/**
 * 模拟恢复登录会话
 * 真实后端接入后应调用 /api/auth/session，以服务端返回的用户身份为准
 */
export async function fetchSession(token: string): Promise<SessionResult> {
  await delay(80)

  /** 从 mock 令牌中解析演示账号，令牌格式为 mock-token-{account}-{timestamp} */
  const matchedAccount = token.match(/^mock-token-([a-z0-9]+)-/)?.[1]
  /** 命中的演示账号 */
  const matched = demoAccounts.find((item) => item.account === matchedAccount)

  if (!matched) {
    throw new Error('登录状态已失效，请重新登录')
  }

  return {
    user: { id: matched.id, name: matched.name },
    token,
  }
}
