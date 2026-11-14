<script setup lang="ts">
import type { AgentMessage, Message, UserMessage } from '@/domain'
import AgentMessageItem from './AgentMessageItem.vue'
import UserMessageItem from './UserMessageItem.vue'

/** 单条消息，按发送方分发到对应的展示组件 */
const props = withDefaults(
  defineProps<{
    /** 会话中的一条消息，可能是用户提问、助手回答或其他角色 */
    message: Message
    /** 是否为会话最后一组助手回答，只有该组允许重新生成 */
    canRetry?: boolean
    /** 当前助手回答在版本组中的序号，从 1 开始 */
    versionIndex?: number
    /** 当前助手回答所属版本组的总版数 */
    versionCount?: number
    /** 当前助手回答是否为版本组内最新版，旧版隐藏兜底与转人工提示 */
    isLatestVersion?: boolean
    /** 本轮转人工产生的工单号 */
    ticketCode?: string
  }>(),
  {
    canRetry: false,
    versionIndex: 1,
    versionCount: 1,
    isLatestVersion: true,
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
  /** 请求切换助手回答版本，-1 为上一版，1 为下一版 */
  'change-version': [direction: number]
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
    :version-index="props.versionIndex"
    :version-count="props.versionCount"
    :is-latest-version="props.isLatestVersion"
    :ticket-code="props.ticketCode"
    @retry="emit('retry', $event)"
    @stop="emit('stop', $event)"
    @delete="emit('delete', $event)"
    @change-version="emit('change-version', $event)"
  />
</template>
