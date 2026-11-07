<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { InputInstance } from 'element-plus'

/** 输入框内容，通过 v-model 与父组件双向绑定 */
const model = defineModel<string>({ default: '' })

/** 输入框的占位与生成状态配置 */
const props = withDefaults(
  defineProps<{
    /** 输入框占位文案 */
    placeholder?: string
    /** 是否正在生成回答，生成期间按钮切换为停止 */
    streaming?: boolean
    /** 是否处于加载会话等不可操作状态 */
    disabled?: boolean
  }>(),
  {
    placeholder: '向 KnoAgent 提问',
    streaming: false,
    disabled: false,
  },
)

/** 向父组件派发的交互事件 */
const emit = defineEmits<{
  /** 提交非空内容时触发 */
  submit: [content: string]
  /** 请求停止当前生成 */
  stop: []
}>()

/** 单条消息最大字符数，与 PRD 输入限制保持一致 */
const maxLength = 2000
/** 输入框实例，用于快捷键聚焦与发送后恢复焦点 */
const inputRef = ref<InputInstance>()
/** 输入框是否已聚焦，用于样式反馈 */
const isFocused = ref(false)

/** 当前内容长度，用于计数器展示 */
const contentLength = computed(() => model.value.length)
/** 是否接近长度上限，用于计数变红提醒 */
const isNearLimit = computed(() => contentLength.value >= maxLength * 0.9)
/** 是否正在生成，决定按钮行为 */
const isStreaming = computed(() => props.streaming && !props.disabled)

/** 聚焦输入框，供快捷键与发送后调用 */
function focusInput() {
  void nextTick(() => inputRef.value?.focus())
}

/** 校验并提交输入内容，空白内容或生成中时忽略 */
function submit() {
  if (isStreaming.value || props.disabled) {
    return
  }

  /** 去除首尾空白后的输入内容 */
  const content = model.value.trim()
  if (!content) {
    return
  }

  if (content.length > maxLength) {
    ElMessage.warning(`单条消息最多 ${maxLength} 个字符`)
    return
  }

  emit('submit', content)
  focusInput()
}

/** 处理键盘事件：Enter 发送，Shift + Enter 换行，输入法组合中不拦截 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
    return
  }

  event.preventDefault()
  submit()
}

/** 输入内容变化时限制最大长度，粘贴超长文本也会被截断 */
function handleInput(value: string) {
  /** 截断到最大长度后的输入内容 */
  const nextValue = value.slice(0, maxLength)
  model.value = nextValue

  if (value.length > maxLength) {
    ElMessage.warning(`单条消息最多 ${maxLength} 个字符`)
  }
}

/** 全局快捷键：Ctrl/Cmd + K 聚焦输入框 */
function handleGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    focusInput()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

defineExpose({ focus: focusInput })
</script>

<template>
  <div class="chat-composer" :class="{ 'is-focused': isFocused, 'is-streaming': isStreaming }">
    <el-input
      ref="inputRef"
      :model-value="model"
      type="textarea"
      :autosize="{ minRows: 1, maxRows: 6 }"
      resize="none"
      enterkeyhint="send"
      :placeholder="placeholder"
      :disabled="disabled"
      class="chat-composer__input"
      @update:model-value="handleInput"
      @keydown="handleKeydown"
      @focus="isFocused = true"
      @blur="isFocused = false"
    />

    <div class="chat-composer__footer">
      <div class="chat-composer__meta">
        <span class="chat-composer__hint">Enter 发送，Shift + Enter 换行</span>
        <span
          v-if="contentLength > 0"
          class="chat-composer__counter"
          :class="{ 'is-near-limit': isNearLimit }"
        >
          {{ contentLength }} / {{ maxLength }}
        </span>
      </div>

      <el-button
        v-if="isStreaming"
        class="chat-composer__action"
        circle
        type="danger"
        plain
        aria-label="停止生成"
        @click="emit('stop')"
      >
        <span class="chat-composer__stop" />
      </el-button>

      <el-button
        v-else
        class="chat-composer__action"
        type="primary"
        circle
        :disabled="!model.trim() || disabled"
        aria-label="发送"
        @click="submit"
      >
        ↑
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.chat-composer {
  width: 100%;
  padding: 10px 12px 10px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 16px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 5%);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.chat-composer.is-focused {
  border-color: var(--el-color-primary);
}

.chat-composer.is-streaming {
  border-color: var(--el-color-danger-light-5);
}

.chat-composer__input :deep(.el-textarea__inner) {
  padding: 2px 0 8px;
  line-height: 1.7;
  background: transparent;
  box-shadow: none;
  resize: none;
}

.chat-composer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chat-composer__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.chat-composer__hint,
.chat-composer__counter {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.chat-composer__counter {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.chat-composer__counter.is-near-limit {
  color: var(--el-color-warning);
}

.chat-composer__action {
  flex-shrink: 0;
}

.chat-composer__stop {
  display: block;
  width: 9px;
  height: 9px;
  background: currentcolor;
  border-radius: 2px;
}

@media (max-width: 640px) {
  .chat-composer {
    padding: 8px 10px 8px 12px;
    border-radius: 14px;
  }

  .chat-composer__hint {
    display: none;
  }

  .chat-composer__meta {
    gap: 0;
  }

  .chat-composer__input :deep(.el-textarea__inner) {
    font-size: 16px;
  }

  .chat-composer__action {
    width: 38px;
    height: 38px;
    font-size: 17px;
  }
}
</style>
