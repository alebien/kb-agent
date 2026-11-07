<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AgentMessage, Message, UserMessage } from '@/domain'
import ChatMessageItem from './ChatMessageItem.vue'

/** 当前会话的消息列表 */
const props = defineProps<{
  /** 当前会话的消息列表，引用与工具调用都挂在各自的助手消息上 */
  messages: Message[]
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

/** 最后一条消息 id，只有它允许重新生成 */
const lastMessageId = computed(() => props.messages.at(-1)?.id ?? '')
/** 待执行的滚动帧 id，用于合并高频的流式更新 */
let scrollFrame = 0
/** 是否正在执行程序性滚动，用于忽略自己写 scrollTop 触发的 scroll 事件 */
let isProgrammaticScroll = false
/** 消息内容尺寸观察器，内容异步变高时补一次贴底，避免被新内容顶开 */
let resizeObserver: ResizeObserver | undefined

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

// 消息变化时仅在自动跟随开启时滚到底部，用户向上滚动后立即暂停
watch(
  () => props.messages,
  () => {
    if (isFollowing.value) {
      scheduleScrollToBottom()
    }
  },
  { deep: true },
)

onMounted(() => {
  const wrap = getScrollWrap()
  wrap?.addEventListener('scroll', updateScrollState, { passive: true })
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
        <ChatMessageItem
          v-for="message in messages"
          :key="message.id"
          v-memo="[message.content, message.status, message.id === lastMessageId]"
          :message="message"
          :can-retry="message.id === lastMessageId"
          @retry="emit('retry', $event)"
          @stop="emit('stop', $event)"
          @delete="emit('delete', $event)"
        />
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
