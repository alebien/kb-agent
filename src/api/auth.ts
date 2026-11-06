import type { AuthUser } from '@/stores/auth'

/** 登录接口入参。 */
export interface LoginPayload {
  /** 登录账号。 */
  account: string
  /** 登录密码。 */
  password: string
}

/** 登录接口返回的用户与令牌。 */
export interface LoginResult {
  /** 当前用户基本信息。 */
  user: AuthUser
  /** 登录令牌，接入真实后端后用于后续请求鉴权。 */
  token: string
}

/** 演示环境可用的账号。 */
const DEMO_ACCOUNT = 'admin'
/** 演示环境可用的密码。 */
const DEMO_PASSWORD = '123456'

/** 模拟网络延迟，返回一个在指定毫秒后完成的 Promise。 */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

/** 模拟登录请求，账号或密码错误时抛出异常。 */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  /** 去除首尾空白后的账号，密码保持原样。 */
  const account = payload.account.trim()

  await delay(620)

  if (account !== DEMO_ACCOUNT || payload.password !== DEMO_PASSWORD) {
    throw new Error('账号或密码错误')
  }

  return {
    user: { id: 'demo-admin', name: account },
    token: `mock-token-${Date.now()}`,
  }
}
