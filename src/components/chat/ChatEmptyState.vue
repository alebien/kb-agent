<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 空状态主标题 */
    title?: string
    /** 空状态辅助说明，为空时不展示 */
    description?: string
  }>(),
  {
    title: '你好，我是 KnoAgent',
    description: '有什么可以帮你的吗？',
  },
)
</script>

<template>
  <div class="chat-empty">
    <div class="chat-empty__mark">K</div>
    <h1>{{ title }}</h1>
    <p v-if="description">{{ description }}</p>
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
