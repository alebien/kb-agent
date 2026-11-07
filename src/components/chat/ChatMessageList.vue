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
/** 用户是否停留在底部，上滑阅读时不强制跟随 */
const isNearBottom = ref(true)
/** 是否展示回到底部按钮 */
const showBackToBottom = ref(false)

/** 最后一条消息 id，只有它允许重新生成 */
const lastMessageId = computed(() => props.messages.at(-1)?.id ?? '')
/** 待执行的滚动帧 id，用于合并高频的流式更新 */
let scrollFrame = 0

/** 获取真实滚动容器，Element Plus 的 scrollbar 实例包含 wrapRef */
function getScrollWrap(): HTMLElement | null {
  return scrollbarRef.value?.wrapRef ?? null
}

/** 判断滚动位置是否接近底部，容忍 80px 误差 */
function updateScrollState() {
  /** 当前滚动容器 */
  const wrap = getScrollWrap()
  if (!wrap) {
    return
  }

  /** 距离底部剩余的滚动距离 */
  const distance = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight
  isNearBottom.value = distance < 80
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

  wrap.scrollTop = wrap.scrollHeight
  isNearBottom.value = true
  showBackToBottom.value = false
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
    /** 当前滚动容器 */
    const wrap = getScrollWrap()
    if (!wrap) {
      return
    }

    wrap.scrollTop = wrap.scrollHeight
    isNearBottom.value = true
    showBackToBottom.value = false
  })
}

/** 点击回到底部，恢复自动跟随 */
function handleBackToBottom() {
  void scrollToBottom()
}

// 消息变化时仅在用户停留在底部时自动跟随，避免打断向上阅读
watch(
  () => props.messages,
  () => {
    if (isNearBottom.value) {
      scheduleScrollToBottom()
    }
  },
  { deep: true },
)

onMounted(() => {
  const wrap = getScrollWrap()
  wrap?.addEventListener('scroll', updateScrollState, { passive: true })
  void scrollToBottom()
})

onBeforeUnmount(() => {
  getScrollWrap()?.removeEventListener('scroll', updateScrollState)

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
      <el-button
        v-if="showBackToBottom"
        class="back-to-bottom"
        circle
        aria-label="回到底部"
        @click="handleBackToBottom"
      >
        ↓
      </el-button>
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
  right: 24px;
  bottom: 12px;
  box-shadow: var(--el-box-shadow-light);
}

.back-bottom-enter-active,
.back-bottom-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.back-bottom-enter-from,
.back-bottom-leave-to {
  opacity: 0;
  transform: translateY(6px);
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

  .back-to-bottom {
    right: 16px;
  }
}
</style>
