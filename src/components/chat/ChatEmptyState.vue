<script setup lang="ts">
import { computed } from 'vue'

/** 空状态出现的场景 */
type EmptyVariant = 'draft' | 'conversation'

/** 空状态参数 */
const props = withDefaults(
  defineProps<{
    /** 场景：草稿页与「真实但无消息」的会话文案不同 */
    variant?: EmptyVariant
    /** 覆盖默认主标题，为空时按场景取默认文案 */
    title?: string
    /** 覆盖默认辅助说明，为空时按场景取默认文案 */
    description?: string
  }>(),
  {
    variant: 'draft',
    title: '',
    description: '',
  },
)

/** 向页面派发的空状态主操作 */
const emit = defineEmits<{
  /** 请求新建对话，仅有消息的会话空态提供该操作 */
  'new-chat': []
}>()

/** 当前场景的默认文案，遵循「现状 + 下一步」的写法 */
const preset = computed(() =>
  props.variant === 'draft'
    ? {
        title: '你好，我是 KnoAgent',
        description: '输入问题开始对话，我会结合企业知识库作答',
      }
    : {
        title: '这个对话还没有消息',
        description: '在下方输入框提问即可继续，或新建一个对话',
      },
)

/** 最终展示的主标题 */
const displayTitle = computed(() => props.title || preset.value.title)
/** 最终展示的辅助说明 */
const displayDescription = computed(() => props.description || preset.value.description)
/** 是否展示「新建对话」主操作，空会话需要给出明确出口 */
const showNewChat = computed(() => props.variant === 'conversation')
</script>

<template>
  <div class="chat-empty">
    <div class="chat-empty__mark">K</div>
    <h1>{{ displayTitle }}</h1>
    <p v-if="displayDescription">{{ displayDescription }}</p>
    <el-button v-if="showNewChat" class="chat-empty__action" @click="emit('new-chat')">
      新建对话
    </el-button>
  </div>
</template>

<style scoped>
.chat-empty {
  display: flex;
  width: min(100%, 720px);
  margin: auto;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
  text-align: center;
}

.chat-empty__mark {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: var(--el-color-white);
  font-size: 26px;
  font-weight: 700;
  background: var(--el-color-primary);
  border-radius: 14px;
}

.chat-empty h1 {
  margin: 20px 0 0;
  font-size: 28px;
  font-weight: 500;
  line-height: 1.4;
}

.chat-empty p {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.chat-empty__action {
  margin-top: 20px;
}

@media (max-width: 640px) {
  .chat-empty {
    padding: 16px 0;
  }

  .chat-empty__mark {
    width: 40px;
    height: 40px;
    font-size: 22px;
    border-radius: 12px;
  }

  .chat-empty h1 {
    margin-top: 14px;
    font-size: 22px;
  }

  .chat-empty p {
    font-size: 13px;
  }
}

@media (max-height: 620px) {
  .chat-empty {
    padding: 8px 0;
  }

  .chat-empty__mark {
    width: 40px;
    height: 40px;
    font-size: 22px;
    border-radius: 12px;
  }

  .chat-empty h1 {
    margin-top: 12px;
    font-size: 22px;
  }

  .chat-empty p {
    font-size: 13px;
  }
}
</style>
