<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { AgentMessage, Message, UserMessage } from '@/domain'
import ChatMessageItem from './ChatMessageItem.vue'

/** 同一提问的助手回答版本组 */
interface AgentVersionGroup {
  /** 版本组唯一键，优先由 replyToMessageId 派生 */
  key: string
  /** 该组回答的用户提问 id，旧 mock 可能缺失 */
  replyToMessageId?: string
  /** 组内全部助手回答版本，按消息出现顺序排列 */
  versions: AgentMessage[]
}

/** 消息流中实际渲染的一行，助手版本组只渲染当前版 */
interface MessageRow {
  /** 渲染行唯一键，避免用户消息与版本组键冲突 */
  key: string
  /** 当前行实际展示的消息 */
  message: Message
  /** 助手版本组键，用户消息为空 */
  groupKey?: string
  /** 当前版本序号，从 1 开始 */
  versionIndex?: number
  /** 版本组总版数 */
  versionCount?: number
  /** 当前版本是否为组内最新版，单版组恒为 true */
  isLatestVersion: boolean
  /** 是否允许重新生成，只有最后一组助手回答为 true */
  canRetry: boolean
}

/** 当前会话的消息列表 */
const props = defineProps<{
  /** 当前会话的消息列表，引用与工具调用都挂在各自的助手消息上 */
  messages: Message[]
  /** 最近一次转人工产生的工单号，展示在低置信度回答下方 */
  ticketCode?: string
}>()

/** 向页面派发的消息操作事件 */
const emit = defineEmits<{
  /** 请求重新生成指定助手消息 */
  retry: [message: AgentMessage]
  /** 请求停止指定助手消息 */
  stop: [message: AgentMessage]
  /** 请求删除指定消息 */
  delete: [message: UserMessage | AgentMessage]
}>()

/** 消息滚动容器实例 */
const scrollbarRef = ref<{ wrapRef?: HTMLElement }>()
/** 自动跟随开关，用户主动向上滚动后关闭，回到底部或点击回到底部时恢复 */
const isFollowing = ref(true)
/** 上一次的滚动位置，用于识别用户是否在向上滚动 */
let lastScrollTop = 0
/** 视为「位于底部」的最大误差，用于恢复自动跟随 */
const FOLLOW_THRESHOLD = 8
/** 是否展示回到底部按钮 */
const showBackToBottom = ref(false)

/** 每个版本组当前选中的版本下标，key 为组标识 */
const selectedVersionIndexes = reactive(new Map<string, number>())
/** 等待新版本落库后强制跳最新版的组键，用户从旧版发起重试时写入 */
let pendingLatestGroupKey = ''
/** 上一次已同步的版本 id 列表，用于识别新增或删除并调整当前版 */
const knownGroupVersionIds = new Map<string, string[]>()
/** 待执行的滚动帧 id，用于合并高频的流式更新 */
let scrollFrame = 0
/** 是否正在执行程序性滚动，用于忽略自己写 scrollTop 触发的 scroll 事件 */
let isProgrammaticScroll = false
/** 消息内容尺寸观察器，内容异步变高时补一次贴底，避免被新内容顶开 */
let resizeObserver: ResizeObserver | undefined
/** 已渲染过的用户提问 id，用于识别新提问并强制回到底部 */
const knownUserMessageIds = new Set<string>()

/**
 * 读取消息在原始列表中的前置用户提问 id
 *
 * @param message 待归属的助手消息
 * @returns 命中时返回提问 id，找不到前置提问时返回空串
 */
function findPreviousUserId(message: AgentMessage): string {
  /** 目标消息在当前列表中的下标 */
  const messageIndex = props.messages.indexOf(message)
  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    /** 倒序遇到的当前消息，命中用户提问即为归属提问 */
    const previous = props.messages[index]
    if (previous?.role === 'user') {
      return previous.id
    }
  }

  return ''
}

/** 生成助手消息的版本组键，旧数据缺失 replyToMessageId 时按前置提问归属 */
function getVersionGroupKey(message: AgentMessage): string {
  /** 助手消息声明的提问 id，旧 mock 可能缺失 */
  const replyToMessageId = message.replyToMessageId ?? findPreviousUserId(message)
  return replyToMessageId ? `reply:${replyToMessageId}` : `single:${message.id}`
}

/** 按消息顺序构建助手版本组，组的位置以首次出现的版本为准 */
const versionGroups = computed<AgentVersionGroup[]>(() => {
  /** 已创建的版本组，key 为组标识 */
  const groupMap = new Map<string, AgentVersionGroup>()
  /** 按首次出现顺序保存的版本组 */
  const groups: AgentVersionGroup[] = []

  for (const message of props.messages) {
    if (message.role !== 'agent') {
      continue
    }

    /** 当前助手消息所属的版本组键 */
    const groupKey = getVersionGroupKey(message)
    /** 已存在的同组版本集合 */
    const existingGroup = groupMap.get(groupKey)
    if (existingGroup) {
      existingGroup.versions.push(message)
      continue
    }

    /** 首次出现的版本组 */
    const group: AgentVersionGroup = {
      key: groupKey,
      replyToMessageId: (message.replyToMessageId ?? findPreviousUserId(message)) || undefined,
      versions: [message],
    }
    groupMap.set(groupKey, group)
    groups.push(group)
  }

  return groups
})

/** 最后一条用户提问 id，用于判定哪一组助手回答可以重新生成 */
const lastUserMessageId = computed(() => {
  for (let index = props.messages.length - 1; index >= 0; index -= 1) {
    /** 倒序遇到的当前消息，命中用户消息时即为最后一条提问 */
    const message = props.messages[index]
    if (message?.role === 'user') {
      return message.id
    }
  }

  return ''
})

/** 最后一组助手回答的组键，只有该组显示重新生成入口 */
const retryGroupKey = computed(() => {
  if (!lastUserMessageId.value) {
    return ''
  }

  /** 严格按 replyToMessageId 命中的版本组 */
  const matchedGroup = versionGroups.value.find(
    (group) => group.replyToMessageId === lastUserMessageId.value,
  )
  if (matchedGroup) {
    return matchedGroup.key
  }

  // 旧 mock 的单版回答没有 replyToMessageId，回退到「最后一条助手消息所在组」
  for (let index = props.messages.length - 1; index >= 0; index -= 1) {
    /** 倒序遇到的当前消息，命中助手消息时返回其组键 */
    const message = props.messages[index]
    if (message?.role === 'agent') {
      return getVersionGroupKey(message)
    }
  }

  return ''
})

/** 读取版本组当前版下标，缺失或越界时收敛到最新版 */
function getSelectedVersionIndex(group: AgentVersionGroup): number {
  /** 用户手动切换后记录的版本下标 */
  const selectedIndex = selectedVersionIndexes.get(group.key)
  if (selectedIndex === undefined) {
    return group.versions.length - 1
  }

  return Math.min(Math.max(selectedIndex, 0), group.versions.length - 1)
}

/** 把用户消息与助手版本组转换成实际渲染行 */
const messageRows = computed<MessageRow[]>(() => {
  /** 版本组键到版本组实体的映射 */
  const groupMap = new Map(versionGroups.value.map((group) => [group.key, group]))
  /** 已渲染过的版本组，避免同组其它版本重复占行 */
  const renderedGroupKeys = new Set<string>()
  /** 按原始消息顺序生成的渲染行 */
  const rows: MessageRow[] = []

  for (const message of props.messages) {
    if (message.role !== 'agent') {
      rows.push({
        key: `message:${message.id}`,
        message,
        isLatestVersion: true,
        canRetry: false,
      })
      continue
    }

    /** 当前助手消息所属的版本组键 */
    const groupKey = getVersionGroupKey(message)
    if (renderedGroupKeys.has(groupKey)) {
      continue
    }

    /** 当前助手消息对应的完整版本组 */
    const group = groupMap.get(groupKey)
    if (!group) {
      continue
    }

    /** 当前应上屏的版本下标 */
    const currentIndex = getSelectedVersionIndex(group)
    rows.push({
      key: `group:${groupKey}`,
      message: group.versions[currentIndex]!,
      groupKey,
      versionIndex: currentIndex + 1,
      versionCount: group.versions.length,
      isLatestVersion: currentIndex === group.versions.length - 1,
      canRetry: groupKey === retryGroupKey.value,
    })
    renderedGroupKeys.add(groupKey)
  }

  return rows
})

/** 同步版本选择：新增版本跳最新，删除当前版优先落到前一版 */
function reconcileVersionSelection() {
  /** 当前待跳最新版的组，新版本写入后消费一次 */
  const latestGroupKey = pendingLatestGroupKey
  /** 待跳组是否在本轮发现新版本 */
  let latestGroupApplied = false

  /** 本轮仍存在的版本组键，用于清理已删空的组状态 */
  const activeGroupKeys = new Set<string>()

  for (const group of versionGroups.value) {
    activeGroupKeys.add(group.key)
    /** 当前组最新版本 id 列表 */
    const currentVersionIds = group.versions.map((version) => version.id)
    /** 上一次同步时的版本 id 列表 */
    const previousVersionIds = knownGroupVersionIds.get(group.key)

    if (!previousVersionIds) {
      selectedVersionIndexes.set(group.key, currentVersionIds.length - 1)
    } else if (currentVersionIds.length > previousVersionIds.length) {
      // 重新生成会追加新版本，组内自动跳到最新版展示流式内容
      selectedVersionIndexes.set(group.key, currentVersionIds.length - 1)
      if (group.key === latestGroupKey) {
        latestGroupApplied = true
      }
    } else if (currentVersionIds.length < previousVersionIds.length) {
      /** 删除前选中的版本下标，越界时收敛到旧版最后一版 */
      const previousSelection = Math.min(
        Math.max(selectedVersionIndexes.get(group.key) ?? previousVersionIds.length - 1, 0),
        previousVersionIds.length - 1,
      )
      /** 删除前选中的版本 id */
      const selectedVersionId = previousVersionIds[previousSelection]
      /** 选中版本仍存在时的新下标，-1 表示当前版已被删除 */
      const survivingIndex = selectedVersionId ? currentVersionIds.indexOf(selectedVersionId) : -1

      if (survivingIndex !== -1) {
        selectedVersionIndexes.set(group.key, survivingIndex)
      } else {
        /** 删除当前版后优先找到的前一版下标，-1 表示未找到 */
        let adjacentIndex = -1
        for (let index = previousSelection - 1; index >= 0; index -= 1) {
          /** 删除前位于当前版之前的版本 id */
          const versionId = previousVersionIds[index]
          if (!versionId) {
            continue
          }
          /** 该版本在当前列表中的新下标 */
          const nextIndex = currentVersionIds.indexOf(versionId)
          if (nextIndex !== -1) {
            adjacentIndex = nextIndex
            break
          }
        }

        if (adjacentIndex === -1) {
          for (let index = previousSelection + 1; index < previousVersionIds.length; index += 1) {
            /** 删除前位于当前版之后的版本 id */
            const versionId = previousVersionIds[index]
            if (!versionId) {
              continue
            }
            /** 该版本在当前列表中的新下标 */
            const nextIndex = currentVersionIds.indexOf(versionId)
            if (nextIndex !== -1) {
              adjacentIndex = nextIndex
              break
            }
          }
        }

        selectedVersionIndexes.set(
          group.key,
          adjacentIndex === -1 ? currentVersionIds.length - 1 : adjacentIndex,
        )
      }
    } else {
      /** 版本数不变时校正可能越界的下标 */
      const selectedIndex = selectedVersionIndexes.get(group.key)
      if (selectedIndex === undefined || selectedIndex >= currentVersionIds.length) {
        selectedVersionIndexes.set(group.key, currentVersionIds.length - 1)
      }
    }

    knownGroupVersionIds.set(group.key, currentVersionIds)
  }

  for (const groupKey of knownGroupVersionIds.keys()) {
    if (!activeGroupKeys.has(groupKey)) {
      knownGroupVersionIds.delete(groupKey)
      selectedVersionIndexes.delete(groupKey)
    }
  }

  if (latestGroupApplied) {
    pendingLatestGroupKey = ''
  }
}

/** 记录重试意图，待新版本写入后把该组切到最新版 */
function handleRetry(message: AgentMessage) {
  pendingLatestGroupKey = getVersionGroupKey(message)
  emit('retry', message)
}

/** 切换指定版本组的当前版 */
function handleVersionChange(groupKey: string, direction: number) {
  /** 待切换的版本组 */
  const group = versionGroups.value.find((item) => item.key === groupKey)
  if (!group) {
    return
  }

  /** 切换目标下标，停留在合法范围内 */
  const nextIndex = getSelectedVersionIndex(group) + direction
  if (nextIndex < 0 || nextIndex >= group.versions.length) {
    return
  }

  selectedVersionIndexes.set(groupKey, nextIndex)
}

/**
 * 把容器滚到底部并同步内部状态
 *
 * 写入 scrollTop 会异步触发 scroll 事件，那一刻内容可能又变高了，
 * 会被误判成「用户不在底部」而永久关闭跟随，因此写之前打上标记
 *
 * @param wrap 真实滚动容器
 */
function scrollWrapToBottom(wrap: HTMLElement) {
  isProgrammaticScroll = true
  wrap.scrollTop = wrap.scrollHeight
  lastScrollTop = wrap.scrollTop
  showBackToBottom.value = false
}

/** 获取真实滚动容器，Element Plus 的 scrollbar 实例包含 wrapRef */
function getScrollWrap(): HTMLElement | null {
  return scrollbarRef.value?.wrapRef ?? null
}

/** 更新滚动状态：识别用户主动向上滚动，并同步回到底部按钮 */
function updateScrollState() {
  /** 当前滚动容器 */
  const wrap = getScrollWrap()
  if (!wrap) {
    return
  }

  // 自己触发的滚动不代表用户意图，只同步位置，不改变跟随状态
  if (isProgrammaticScroll) {
    isProgrammaticScroll = false
    lastScrollTop = wrap.scrollTop
    /** 程序性滚动后的剩余距离，用于同步按钮显隐 */
    const programmaticDistance = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight
    showBackToBottom.value = programmaticDistance > 240
    return
  }

  /** 距离底部剩余的滚动距离 */
  const distance = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight
  /** 本次滚动是否在向上移动，用户一滚就停跟随，避免被流式内容拽回底部 */
  const scrollingUp = wrap.scrollTop < lastScrollTop
  lastScrollTop = wrap.scrollTop

  if (scrollingUp && distance > FOLLOW_THRESHOLD) {
    isFollowing.value = false
  } else {
    // 只有回到底部附近才恢复跟随，向上停在半路时保持暂停
    isFollowing.value = distance <= FOLLOW_THRESHOLD
  }

  // 用户接管滚动后立刻取消尚未执行的跟随帧
  if (!isFollowing.value && scrollFrame) {
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }

  showBackToBottom.value = distance > 240
}

/** 滚动到底部，用于发送消息、流式追加和回到底部按钮 */
async function scrollToBottom() {
  await nextTick()
  /** 当前滚动容器 */
  const wrap = getScrollWrap()
  if (!wrap) {
    return
  }

  scrollWrapToBottom(wrap)
  isFollowing.value = true
}

/**
 * 合并高频滚动请求
 *
 * 流式输出时每个 chunk 都会触发消息变化，如果每次都 nextTick + scrollTo，
 * 会造成大量强制重排；这里用一帧内的合并代替
 */
function scheduleScrollToBottom() {
  if (scrollFrame) {
    return
  }

  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0

    // 用户已经向上滚动时不再抢回滚动位置
    if (!isFollowing.value) {
      return
    }

    /** 当前滚动容器 */
    const wrap = getScrollWrap()
    if (!wrap) {
      return
    }

    scrollWrapToBottom(wrap)
  })
}

/** 点击回到底部，恢复自动跟随 */
function handleBackToBottom() {
  void scrollToBottom()
}

// 版本数量或顺序变化时同步当前版，内容流式更新时不打断用户已选版本
watch(
  () => props.messages,
  () => {
    reconcileVersionSelection()
  },
  { deep: true, immediate: true },
)

// 新提问必须回到底部，其余消息变化仅在自动跟随开启时贴底，避免打断用户向上阅读
watch(
  () => props.messages,
  () => {
    /** 当前消息列表中是否存在尚未记录的用户提问 */
    const hasNewUserMessage = props.messages.some(
      (message) => message.role === 'user' && !knownUserMessageIds.has(message.id),
    )

    // 同步本轮用户提问，后续流式增量与消息替换不会重复触发强制贴底
    for (const message of props.messages) {
      if (message.role === 'user') {
        knownUserMessageIds.add(message.id)
      }
    }

    if (hasNewUserMessage) {
      void scrollToBottom()
      return
    }

    if (isFollowing.value) {
      scheduleScrollToBottom()
    }
  },
  { deep: true },
)

onMounted(() => {
  const wrap = getScrollWrap()
  wrap?.addEventListener('scroll', updateScrollState, { passive: true })

  // 记录首屏已有提问，避免打开历史会话时把旧消息误判成新提问
  for (const message of props.messages) {
    if (message.role === 'user') {
      knownUserMessageIds.add(message.id)
    }
  }

  void scrollToBottom()

  // Markdown 渲染、代码高亮与图片加载都会异步改变高度，跟随期间需要补一次贴底
  if (wrap && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (isFollowing.value) {
        scheduleScrollToBottom()
      }
    })
    resizeObserver.observe(wrap)
  }
})

onBeforeUnmount(() => {
  getScrollWrap()?.removeEventListener('scroll', updateScrollState)
  resizeObserver?.disconnect()
  resizeObserver = undefined

  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }
})
</script>

<template>
  <div class="message-viewport">
    <el-scrollbar ref="scrollbarRef" class="message-scroll">
      <div class="message-stack">
        <template v-for="row in messageRows" :key="row.key">
          <ChatMessageItem
            :message="row.message"
            :can-retry="row.canRetry"
            :version-index="row.versionIndex"
            :version-count="row.versionCount"
            :is-latest-version="row.isLatestVersion"
            :ticket-code="ticketCode"
            @retry="handleRetry"
            @stop="emit('stop', $event)"
            @delete="emit('delete', $event)"
            @change-version="handleVersionChange(row.groupKey ?? '', $event)"
          />
        </template>
      </div>
    </el-scrollbar>

    <Transition name="back-bottom">
      <button
        v-if="showBackToBottom"
        type="button"
        class="back-to-bottom"
        aria-label="回到底部"
        @click="handleBackToBottom"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.message-viewport {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.message-scroll {
  flex: 1;
  min-height: 0;
}

.message-stack {
  display: flex;
  width: min(100%, calc(var(--app-chat-max-width) + var(--app-chat-inline-padding) * 2));
  margin: 0 auto;
  flex-direction: column;
  gap: 20px;
  padding: 24px var(--app-chat-inline-padding) 28px;
}

.back-to-bottom {
  position: absolute;
  bottom: 12px;
  left: 50%;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 50%;
  box-shadow: var(--el-box-shadow-light);
  cursor: pointer;
  transform: translate(-50%, 0);
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.back-to-bottom:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}

.back-to-bottom:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.back-to-bottom svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.back-bottom-enter-active,
.back-bottom-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    visibility 0.16s ease;
}

.back-bottom-enter-from,
.back-bottom-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}

@media (max-width: 900px) {
  .message-stack {
    padding-top: 20px;
  }
}

@media (max-width: 640px) {
  .message-stack {
    gap: 16px;
    padding-top: 16px;
    padding-bottom: 20px;
  }
}
</style>
