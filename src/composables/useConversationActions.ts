import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ConversationForbiddenError,
  deleteConversation,
  renameConversation,
} from '@/api/conversations'
import { useConversationStore } from '@/stores/conversations'
import type { ConversationActionKey } from '@/components/layout/conversationMenu'
import type { ConversationSummary } from '@/domain'

/** 会话操作需要的外部回调 */
export interface ConversationActionsOptions {
  /** 当前打开的会话 id，删除后据此决定是否回到草稿页 */
  activeConversationId: () => string
  /** 删除当前会话后跳回草稿页 */
  onDeletedActive: () => Promise<void>
}

/** 名称最大长度，与重命名弹窗的校验保持一致 */
const MAX_TITLE_LENGTH = 40

/**
 * 最近对话的增删改操作
 *
 * 把弹窗、接口调用、store 更新与错误提示收在一起，
 * 侧边栏只负责把事件转发进来
 *
 * @param options 当前会话读取函数与删除后的跳转回调
 */
export function useConversationActions(options: ConversationActionsOptions) {
  /** 会话列表 store，操作成功后同步最近对话 */
  const conversationStore = useConversationStore()

  /** 把接口异常转换成可展示文案，归属失败统一提示会话不存在或无权访问 */
  function getActionErrorMessage(error: unknown, fallback: string): string {
    return error instanceof ConversationForbiddenError ? error.message : fallback
  }

  /** 重命名会话，接口层会再次校验会话归属 */
  async function renameConversationItem(conversation: ConversationSummary) {
    /** ElMessageBox 返回的新名称 */
    let nextTitle: string

    try {
      /** 重命名弹窗的确认结果 */
      const result = await ElMessageBox.prompt('请输入新的对话名称', '重命名对话', {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: conversation.title,
        inputPlaceholder: '对话名称',
        inputValidator: (value: string) => {
          /** 去除首尾空白后的名称 */
          const title = value.trim()
          if (!title) {
            return '名称不能为空'
          }
          if (title.length > MAX_TITLE_LENGTH) {
            return `名称最多 ${MAX_TITLE_LENGTH} 个字符`
          }
          return true
        },
      })
      nextTitle = result.value.trim()
    } catch {
      return
    }

    try {
      /** 接口返回的更新后摘要 */
      const summary = await renameConversation(conversation.id, nextTitle)
      conversationStore.updateTitle(summary.id, summary.title)
      ElMessage.success('已重命名')
    } catch (error) {
      ElMessage.error(getActionErrorMessage(error, '重命名失败，请稍后重试'))
    }
  }

  /** 删除会话，删除当前打开会话后回到新对话页 */
  async function deleteConversationItem(conversation: ConversationSummary) {
    try {
      await ElMessageBox.confirm(
        `删除「${conversation.title}」后无法恢复，确定继续吗？`,
        '删除对话',
        {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          confirmButtonClass: 'el-button--danger',
        },
      )
    } catch {
      return
    }

    try {
      await deleteConversation(conversation.id)
      conversationStore.remove(conversation.id)

      if (options.activeConversationId() === conversation.id) {
        await options.onDeletedActive()
      }

      ElMessage.success('已删除对话')
    } catch (error) {
      ElMessage.error(getActionErrorMessage(error, '删除对话失败，请稍后重试'))
    }
  }

  /** 执行最近对话的操作，新增操作时在这里扩展分支 */
  async function handleConversationAction(
    action: ConversationActionKey,
    conversation: ConversationSummary,
  ) {
    if (action === 'rename') {
      await renameConversationItem(conversation)
      return
    }

    await deleteConversationItem(conversation)
  }

  return { handleConversationAction }
}
