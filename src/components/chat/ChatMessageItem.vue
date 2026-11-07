<script setup lang="ts">
import type { AgentMessage, Message, UserMessage } from '@/domain'
import AgentMessageItem from './AgentMessageItem.vue'
import UserMessageItem from './UserMessageItem.vue'

/** 单条消息，按发送方分发到对应的展示组件 */
const props = withDefaults(
  defineProps<{
    /** 会话中的一条消息，可能是用户提问、助手回答或其他角色 */
    message: Message
    /** 是否为会话最后一条消息，只有最后一条助手消息允许重新生成 */
    canRetry?: boolean
    /** 本轮转人工产生的工单号 */
    ticketCode?: string
  }>(),
  {
    canRetry: false,
    ticketCode: '',
  },
)

/** 向消息列表透传消息操作事件 */
const emit = defineEmits<{
  /** 请求重新生成指定助手消息 */
  retry: [message: AgentMessage]
  /** 请求停止指定助手消息 */
  stop: [message: AgentMessage]
  /** 请求删除指定消息 */
  delete: [message: UserMessage | AgentMessage]
}>()
</script>

<template>
  <UserMessageItem
    v-if="props.message.role === 'user'"
    :message="props.message"
    @delete="emit('delete', $event)"
  />
  <AgentMessageItem
    v-else-if="props.message.role === 'agent'"
    :message="props.message"
    :can-retry="props.canRetry"
    :ticket-code="props.ticketCode"
    @retry="emit('retry', $event)"
    @stop="emit('stop', $event)"
    @delete="emit('delete', $event)"
  />
</template>
