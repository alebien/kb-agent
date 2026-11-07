/** 会话操作标识，新增操作时在这里扩展 */
export type ConversationActionKey = 'rename' | 'delete'

/** 会话操作菜单可用的图标类型 */
export type ConversationActionIcon = 'edit' | 'trash'

/** 会话操作菜单项配置 */
export interface ConversationMenuAction {
  /** 操作唯一标识，用于事件回传 */
  key: ConversationActionKey
  /** 菜单展示文案 */
  label: string
  /** 菜单图标类型 */
  icon: ConversationActionIcon
  /** 是否使用危险操作样式 */
  danger?: boolean
  /** 当前状态下是否展示该项 */
  visible: boolean
}

/**
 * 会话操作菜单
 * MVP 只有客服一个角色，登录人对自己创建的会话固定拥有重命名与删除能力
 */
export const CONVERSATION_MENU_ACTIONS: ConversationMenuAction[] = [
  {
    key: 'rename',
    label: '重命名',
    icon: 'edit',
    visible: true,
  },
  {
    key: 'delete',
    label: '删除此对话',
    icon: 'trash',
    danger: true,
    visible: true,
  },
]
