/**
 * 系统权限码
 * 页面与接口只判断权限码，不直接判断角色名，新增角色时不需要改动业务组件
 */
export const PERMISSIONS = {
  /** 会话重命名 */
  CHAT_RENAME: 'chat:rename',
  /** 会话删除 */
  CHAT_DELETE: 'chat:delete',
  /** 查看观测面板 */
  CHAT_INSIGHT_VIEW: 'chat:insight:view',
  /** 查看文档库 */
  DOCUMENT_VIEW: 'document:view',
  /** 上传、删除、重建索引等文档管理操作 */
  DOCUMENT_MANAGE: 'document:manage',
  /** 查看评测中心 */
  EVALUATION_VIEW: 'evaluation:view',
  /** 运行评测与沉淀 Bad case */
  EVALUATION_MANAGE: 'evaluation:manage',
  /** 查看工单 */
  TICKET_VIEW: 'ticket:view',
  /** 推进工单状态、指派与结单 */
  TICKET_MANAGE: 'ticket:manage',
} as const

/** 权限码字面量联合类型，新增权限时先补到 PERMISSIONS */
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** 系统角色标识，角色只负责聚合权限，不直接出现在页面判断里 */
export type RoleCode = 'agent' | 'knowledge_admin' | 'supervisor'

/** 角色在界面上的展示名称 */
export const ROLE_LABELS: Record<RoleCode, string> = {
  agent: '一线客服',
  knowledge_admin: '知识库管理员',
  supervisor: '客服主管',
}

/**
 * 角色与权限的映射表
 * 真实后端接入后权限快照以登录接口返回为准，这张表只用于 mock 和前端兜底展示
 */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  agent: [
    PERMISSIONS.CHAT_RENAME,
    PERMISSIONS.CHAT_DELETE,
    PERMISSIONS.CHAT_INSIGHT_VIEW,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.EVALUATION_VIEW,
    PERMISSIONS.TICKET_VIEW,
    PERMISSIONS.TICKET_MANAGE,
  ],
  knowledge_admin: [
    PERMISSIONS.CHAT_RENAME,
    PERMISSIONS.CHAT_DELETE,
    PERMISSIONS.CHAT_INSIGHT_VIEW,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_MANAGE,
    PERMISSIONS.EVALUATION_VIEW,
    PERMISSIONS.EVALUATION_MANAGE,
    PERMISSIONS.TICKET_VIEW,
  ],
  supervisor: [
    PERMISSIONS.CHAT_RENAME,
    PERMISSIONS.CHAT_DELETE,
    PERMISSIONS.CHAT_INSIGHT_VIEW,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.EVALUATION_VIEW,
    PERMISSIONS.EVALUATION_MANAGE,
    PERMISSIONS.TICKET_VIEW,
    PERMISSIONS.TICKET_MANAGE,
  ],
}

/** 未登录访客可用的权限，只保留免费对话与删除自己的会话 */
export const GUEST_PERMISSIONS: PermissionCode[] = [PERMISSIONS.CHAT_DELETE]

/** 判断权限集合是否包含目标权限码 */
export function hasPermission(
  granted: readonly PermissionCode[],
  required: PermissionCode | PermissionCode[] | undefined,
): boolean {
  if (!required) {
    return true
  }

  /** 需要同时满足的权限码列表 */
  const requiredList = Array.isArray(required) ? required : [required]
  return requiredList.every((permission) => granted.includes(permission))
}
