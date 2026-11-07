import type { Ticket } from '@/domain'
import { tickets } from '@/mock'
import { PERMISSIONS } from '@/auth'
import { assertPermission } from './authorization'

/** 模拟网络延迟，统一返回传入的值 */
function delay<T>(value: T, milliseconds = 240): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), milliseconds)
  })
}

/** 获取工单列表，按创建时间倒序返回，新建的工单排在前面 */
export async function fetchTickets(): Promise<Ticket[]> {
  assertPermission(PERMISSIONS.TICKET_VIEW)

  /** 拷贝并按创建时间倒序排列的列表，tags 单独复制一份，避免调用方改动影响 mock 源数据 */
  const list = tickets
    .map((ticket) => ({
      ...ticket,
      ...(ticket.tags ? { tags: [...ticket.tags] } : {}),
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  return delay(list)
}
