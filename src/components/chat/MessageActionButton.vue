<script setup lang="ts">
import '@/assets/message-actions.css'
import MessageActionIcon from './MessageActionIcon.vue'

/** 图标名称联合类型，与图标组件保持一致 */
type MessageActionIconName = 'copy' | 'retry' | 'delete' | 'stop' | 'expand' | 'collapse'

withDefaults(
  defineProps<{
    /** 操作名称，同时作为悬停提示与无障碍标签 */
    label: string
    /** 按钮图标 */
    icon: MessageActionIconName
    /** 是否处于激活态，例如已展开内容 */
    active?: boolean
    /** 是否为危险操作，删除按钮使用红色 */
    danger?: boolean
    /** 是否禁用点击 */
    disabled?: boolean
  }>(),
  {
    active: false,
    danger: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  /** 点击按钮 */
  click: []
}>()
</script>

<template>
  <el-tooltip :content="label" placement="top" :show-after="200" :hide-after="0">
    <button
      type="button"
      class="message-action"
      :class="{ 'is-active': active, 'is-danger': danger }"
      :disabled="disabled"
      :aria-label="label"
      @click="emit('click')"
    >
      <MessageActionIcon :name="icon" />
    </button>
  </el-tooltip>
</template>
