<script setup lang="ts">
const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    placeholder?: string
    loading?: boolean
  }>(),
  {
    placeholder: '向 KnoAgent 提问',
    loading: false,
  },
)

const emit = defineEmits<{
  submit: [content: string]
}>()

function submit() {
  const content = model.value.trim()
  if (!content || props.loading) {
    return
  }
  emit('submit', content)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="chat-composer">
    <el-input
      v-model="model"
      type="textarea"
      :autosize="{ minRows: 1, maxRows: 6 }"
      resize="none"
      enterkeyhint="send"
      :placeholder="placeholder"
      :disabled="loading"
      class="chat-composer__input"
      @keydown="handleKeydown"
    />

    <div class="chat-composer__footer">
      <span class="chat-composer__hint">Enter 发送，Shift + Enter 换行</span>
      <el-button
        type="primary"
        circle
        :loading="loading"
        :disabled="!model.trim() || loading"
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
  transition: border-color 0.2s ease;
}

.chat-composer:focus-within {
  border-color: var(--el-color-primary);
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

.chat-composer__hint {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

@media (max-width: 640px) {
  .chat-composer {
    padding: 8px 10px 8px 12px;
    border-radius: 14px;
  }

  .chat-composer__hint {
    display: none;
  }

  .chat-composer__footer {
    justify-content: flex-end;
  }

  .chat-composer__input :deep(.el-textarea__inner) {
    font-size: 16px;
  }

  .chat-composer__footer :deep(.el-button) {
    width: 38px;
    height: 38px;
    font-size: 17px;
  }
}
</style>
