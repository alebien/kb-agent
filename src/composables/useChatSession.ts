import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createConversation,
  deleteMessage,
  fetchConversationDetail,
  regenerateMessage,
  sendMessage,
  stopMessage,
} from '@/api/conversations'
import type { AgentMessage, Conversation, UserMessage } from '@/domain'
import { useAuthStore } from '@/stores/auth'
import { useConversationStore } from '@/stores/conversations'
import { resetSseDebugEntries } from '@/dev/sse-debug'

/** 加载态延迟显示时间，快速返回时不闪现 loading */
const LOADING_DELAY_MS = 800
/** 会话详情请求超时时间，超过后按加载失败处理 */
const LOAD_TIMEOUT_MS = 10000

/**
 * 给任意 Promise 补充超时控制
 *
 * mock 接口没有真实网络错误，用超时模拟弱网时的兜底：超时后统一抛错，
 * 由调用方展示错误态与重试入口
 *
 * @param task 原始请求
 * @param milliseconds 超时毫秒数
 * @param message 超时后抛出的提示文案
 */
function withTimeout<T>(task: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    /** 超时定时器，请求先结束时需要清理 */
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds)

    task.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(message))
      },
    )
  })
}

/**
 * 对话页业务编排
 * 页面组件只负责布局与组件串联，加载、发送、停止、重试与删除都在这里统一处理
 */
export function useChatSession() {
  /** 当前路由信息，用于区分草稿页与会话页 */
  const route = useRoute()
  /** 路由实例，用于创建会话后的地址替换 */
  const router = useRouter()
  /** 会话列表 store，新建会话后同步侧边栏 */
  const conversationStore = useConversationStore()
  /** 登录状态 store，游客提交提问时先弹出登录框 */
  const authStore = useAuthStore()

  /** 会话详情是否正在加载 */
  const isLoading = ref(true)
  /** 是否展示加载骨架，延迟 800ms 后才为 true，避免快速返回时闪烁 */
  const isLoadingVisible = ref(false)
  /** 会话加载失败时的提示文案，空字符串表示无错误 */
  const loadError = ref('')
  /** 当前展示的会话详情 */
  const currentDetail = ref<Conversation | null>(null)
  /** 已加载的会话 id，用于避免重复请求同一会话 */
  const activeConversationId = ref('')
  /** 正在创建并准备跳转的会话 id，用于跳过路由切换后的重复加载 */
  let pendingConversationId = ''
  /** 输入框草稿内容 */
  const draft = ref('')
  /** 是否正在创建新会话，防止重复提交 */
  const isCreating = ref(false)
  /** 当前是否正在生成回答，控制停止按钮与输入状态 */
  const isStreaming = ref(false)
  /** 当前正在生成的助手消息 id，用于停止 */
  const activeAnswerId = ref('')
  /** 加载请求序号，用于丢弃过期请求的结果 */
  let loadRequestId = 0
  /** loading 延迟显示的定时器，切换会话或加载结束时清理 */
  let loadingTimer: ReturnType<typeof setTimeout> | undefined

  /** 进入加载态：立即置为加载中，超过 800ms 才显示骨架，避免闪屏 */
  function beginLoading() {
    isLoading.value = true
    isLoadingVisible.value = false

    if (loadingTimer !== undefined) {
      clearTimeout(loadingTimer)
    }

    loadingTimer = setTimeout(() => {
      isLoadingVisible.value = true
      loadingTimer = undefined
    }, LOADING_DELAY_MS)
  }

  /** 退出加载态：清理延迟定时器并收起骨架 */
  function endLoading() {
    isLoading.value = false
    isLoadingVisible.value = false

    if (loadingTimer !== undefined) {
      clearTimeout(loadingTimer)
      loadingTimer = undefined
    }
  }

  /** 当前是否处于「新对话」草稿页 */
  const isDraft = computed(() => route.name === 'chat-draft')
  /** 当前路由中的会话 id */
  const conversationId = computed(() => route.params.conversationId as string | undefined)
  /** 当前会话是否已有消息 */
  const hasMessages = computed(() => (currentDetail.value?.messages.length ?? 0) > 0)
  /** 输入框是否位于页面中部：草稿页和没有消息的会话使用居中布局 */
  const isComposerCentered = computed(
    () => isDraft.value || (currentDetail.value !== null && !hasMessages.value),
  )
  /** 输入框是否禁用：加载会话、创建会话或加载失败时不可输入 */
  const isComposerDisabled = computed(
    () => isLoading.value || isCreating.value || !!loadError.value,
  )

  /** 按 id 加载会话详情，并通过请求序号避免竞态覆盖 */
  async function loadConversation(id: string) {
    if (!id || activeConversationId.value === id) {
      return
    }

    // 新会话创建后已写入详情，路由切换时复用同一对象，避免清空正在流式更新的消息
    if (pendingConversationId === id && currentDetail.value) {
      activeConversationId.value = id
      pendingConversationId = ''
      return
    }

    activeConversationId.value = id
    /** 本次加载请求的序号 */
    const requestId = ++loadRequestId
    currentDetail.value = null
    beginLoading()
    loadError.value = ''
    isStreaming.value = false
    activeAnswerId.value = ''

    try {
      /** 接口返回的会话详情，超过 10 秒按超时处理 */
      const detail = await withTimeout(
        fetchConversationDetail(id),
        LOAD_TIMEOUT_MS,
        '加载会话超时，请检查网络后重试',
      )

      if (requestId !== loadRequestId) {
        return
      }

      currentDetail.value = detail
    } catch {
      if (requestId !== loadRequestId) {
        return
      }

      currentDetail.value = null
      loadError.value = '会话不存在或无权访问，请从左侧选择自己的会话'
    } finally {
      if (requestId === loadRequestId) {
        endLoading()
      }
    }
  }

  /** 重新加载当前会话，供错误态的重试按钮调用 */
  async function reload() {
    /** 当前路由中的会话 id */
    const id = conversationId.value
    if (!id) {
      return
    }

    // 清空已加载标记，强制重新请求同一会话
    activeConversationId.value = ''
    await loadConversation(id)
  }

  /**
   * 把流式片段追加到当前助手消息
   *
   * 接口层不再逐块回传整份快照，这里按 id 精准追加文本，
   * 只触发单条消息更新，避免每个 chunk 都重建整个消息列表
   *
   * @param chunk 本次收到的增量文本
   */
  function appendStreamChunk(chunk: string) {
    /** 当前会话的消息列表 */
    const messages = currentDetail.value?.messages
    if (!messages) {
      return
    }

    /** 正在生成的助手消息，按 id 定位以兼容重试场景 */
    const target = messages.find((message) => message.id === activeAnswerId.value)
    if (!target || target.role !== 'agent') {
      return
    }

    target.content += chunk
  }

  /** 把接口返回的最新消息快照写回页面，触发响应式渲染 */
  function syncMessages(messages: Conversation['messages'], conversationId?: string) {
    if (
      currentDetail.value &&
      (!conversationId || currentDetail.value.summary.id === conversationId)
    ) {
      currentDetail.value.messages = messages
    }
  }

  /** 向当前会话发送提问，并流式追加助手回答 */
  async function sendCurrentMessage(content: string, reuseUserMessageId?: string) {
    /** 当前会话，草稿页还没有会话 */
    const conversation = currentDetail.value
    if (!conversation || isStreaming.value) {
      return
    }

    isStreaming.value = true
    draft.value = ''
    // 每轮提问单独记录事件，避免上一轮日志混进本轮观察
    resetSseDebugEntries()

    try {
      /** 发送接口返回的会话摘要与助手消息 id */
      const result = await sendMessage(
        conversation.summary.id,
        content,
        {
          onStart: (answerId) => {
            activeAnswerId.value = answerId
          },
          onChunk: appendStreamChunk,
          onUpdate: (messages) => syncMessages(messages, conversation.summary.id),
          onDone: () => {
            isStreaming.value = false
            activeAnswerId.value = ''
          },
          onStopped: () => {
            isStreaming.value = false
            activeAnswerId.value = ''
            ElMessage.info('已停止生成')
          },
          onError: (message) => {
            isStreaming.value = false
            activeAnswerId.value = ''
            // 服务端可能在流中途给出具体原因，优先展示它
            ElMessage.error(message.error || '回答生成失败，请重试')
          },
        },
        reuseUserMessageId ? { reuseUserMessageId } : undefined,
      )

      conversationStore.updateTime(result.summary.id, result.summary.updatedAt)
    } catch (error) {
      isStreaming.value = false
      activeAnswerId.value = ''
      /** 接口返回的错误信息 */
      const message = error instanceof Error ? error.message : '发送失败，请稍后重试'
      ElMessage.error(message)
    }
  }

  /** 提交输入内容：草稿页先创建会话，已有会话直接发送 */
  async function submit(content: string) {
    if (isCreating.value || isStreaming.value) {
      return
    }

    /** 去除首尾空白后的提问内容 */
    const message = content.trim()
    if (!message) {
      return
    }

    // 草稿页对游客开放，提交动作才要求登录，登录成功后保留输入内容
    if (!authStore.isLoggedIn) {
      authStore.openLoginDialog()
      ElMessage.info('登录后即可发送消息')
      return
    }

    if (!isDraft.value && currentDetail.value) {
      await sendCurrentMessage(message)
      return
    }

    isCreating.value = true

    try {
      /** 新建的会话摘要 */
      const created = await createConversation(message)
      conversationStore.add(created.summary)
      draft.value = ''
      activeConversationId.value = created.summary.id
      pendingConversationId = created.summary.id
      currentDetail.value = created.detail
      isLoading.value = false
      await router.replace(`/chat/${created.summary.id}`)

      // 创建阶段结束后先解除禁用，流式开始时停止按钮才能正常切换
      isCreating.value = false
      /** 创建会话时已写入的首条用户消息，发送时复用避免重复 */
      const firstUserMessage = created.detail.messages.find((item) => item.role === 'user')
      await sendCurrentMessage(message, firstUserMessage?.id)
    } catch (error) {
      /** 创建失败时的错误信息 */
      const errorMessage = error instanceof Error ? error.message : '创建对话失败，请稍后重试'
      ElMessage.error(errorMessage)
    } finally {
      isCreating.value = false
    }
  }

  /** 停止当前正在生成的回答 */
  async function stop() {
    /** 当前会话 */
    const conversation = currentDetail.value
    /** 当前正在生成的消息 id */
    const answerId = activeAnswerId.value
    if (!conversation || !answerId) {
      return
    }

    try {
      await stopMessage(conversation.summary.id, answerId)
    } catch {
      ElMessage.error('停止失败，请稍后重试')
    }
  }

  /** 重新生成指定助手回答 */
  async function retry(message: AgentMessage) {
    /** 当前会话 */
    const conversation = currentDetail.value
    if (!conversation || isStreaming.value) {
      return
    }

    isStreaming.value = true
    activeAnswerId.value = message.id
    // 重试同样开启新的一轮事件记录
    resetSseDebugEntries()

    try {
      await regenerateMessage(conversation.summary.id, message.id, {
        onStart: (answerId) => {
          activeAnswerId.value = answerId
        },
        onChunk: appendStreamChunk,
        onUpdate: (messages) => syncMessages(messages, conversation.summary.id),
        onDone: () => {
          isStreaming.value = false
          activeAnswerId.value = ''
        },
        onStopped: () => {
          isStreaming.value = false
          activeAnswerId.value = ''
          ElMessage.info('已停止生成')
        },
        onError: (message) => {
          isStreaming.value = false
          activeAnswerId.value = ''
          // 服务端可能在流中途给出具体原因，优先展示它
          ElMessage.error(message.error || '重新生成失败，请稍后重试')
        },
      })
    } catch {
      isStreaming.value = false
      activeAnswerId.value = ''
      ElMessage.error('重新生成失败，请稍后重试')
    }
  }

  /** 删除消息，二次确认后从 mock 中移除 */
  async function removeMessage(message: UserMessage | AgentMessage) {
    /** 当前会话 */
    const conversation = currentDetail.value
    if (!conversation || isStreaming.value) {
      return
    }

    try {
      await ElMessageBox.confirm('删除后无法恢复，确定继续吗？', '删除消息', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      })
    } catch {
      return
    }

    try {
      /** 删除后剩余的完整消息列表 */
      const messages = await deleteMessage(conversation.summary.id, message.id)
      if (currentDetail.value) {
        currentDetail.value.messages = messages
      }
      ElMessage.success('已删除消息')
    } catch {
      ElMessage.error('删除消息失败，请稍后重试')
    }
  }

  /** 回到「新对话」草稿页，供空态与错误态的主操作调用 */
  async function startNewChat() {
    if (isStreaming.value) {
      return
    }

    await router.push({ name: 'chat-draft' })
  }

  watch(
    () => route.fullPath,
    async () => {
      // 切换会话或回到草稿页时中止旧流，避免上一轮回答继续占用生成状态
      if (isStreaming.value && activeAnswerId.value && activeConversationId.value) {
        try {
          await stopMessage(activeConversationId.value, activeAnswerId.value)
        } catch {
          // 会话可能已被删除，停止失败不阻塞路由切换
        }
      }

      draft.value = ''

      if (isDraft.value) {
        loadRequestId += 1
        activeConversationId.value = ''
        currentDetail.value = null
        loadError.value = ''
        endLoading()
        isStreaming.value = false
        activeAnswerId.value = ''
        return
      }

      if (conversationId.value) {
        void loadConversation(conversationId.value)
      }
    },
    { immediate: true },
  )

  return {
    draft,
    isLoading,
    isLoadingVisible,
    isCreating,
    loadError,
    currentDetail,
    isDraft,
    hasMessages,
    isComposerCentered,
    isComposerDisabled,
    isStreaming,
    submit,
    stop,
    retry,
    reload,
    startNewChat,
    removeMessage,
  }
}
