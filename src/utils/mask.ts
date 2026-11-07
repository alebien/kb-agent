/** 敏感信息脱敏工具，日志与埋点上报前统一走这里，禁止各处自写正则 */

/** 手机号脱敏，保留前三位与后四位，中间四位用星号，如 `138****8000` */
export function maskPhone(phone: string): string {
  /** 去掉分隔符后的纯数字 */
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) {
    return '***'
  }

  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

/** 姓名脱敏，保留首字，其余全部用星号，如 `张**` */
export function maskName(name: string): string {
  if (name.length <= 1) {
    return name
  }

  return `${name[0]}${'*'.repeat(name.length - 1)}`
}

/** 证件号与长编号脱敏，保留首尾各三位，如 `110********123` */
export function maskCode(code: string): string {
  if (code.length <= 6) {
    return '*'.repeat(code.length)
  }

  return `${code.slice(0, 3)}${'*'.repeat(code.length - 6)}${code.slice(-3)}`
}

/** 邮箱脱敏，@ 前只保留首字符，如 `y***@example.com` */
export function maskEmail(email: string): string {
  /** @ 的位置，缺失时视为非法邮箱 */
  const at = email.indexOf('@')
  if (at <= 0) {
    return '***'
  }

  return `${email.slice(0, 1)}***${email.slice(at)}`
}
