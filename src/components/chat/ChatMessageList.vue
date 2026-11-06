<script setup lang="ts">
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import type { Citation, Message } from '@/domain'

defineProps<{
  /** 当前会话的消息列表。 */
  messages: Message[]
  /** 助手回答引用的知识来源。 */
  citations: Citation[]
}>()
</script>

<template>
  <el-scrollbar class="message-scroll">
    <div class="message-stack">
      <article
        v-for="message in messages"
        :key="message.id"
        :class="['message-row', message.role === 'user' ? 'is-user' : 'is-agent']"
      >
        <div v-if="message.role === 'user'" class="user-bubble">
          {{ message.content }}
        </div>

        <div v-else class="agent-content">
          <MarkdownRenderer :content="message.content" />

          <div v-if="citations.length" class="message-sources">
            <div v-for="citation in citations" :key="citation.id" class="source-card">
              <strong>{{ citation.name }}</strong>
              <p>{{ citation.description }}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  </el-scrollbar>
</template>

<style scoped>
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

.message-row {
  display: flex;
  width: 100%;
}

.message-row.is-user {
  justify-content: flex-end;
}

.message-row.is-agent {
  justify-content: flex-start;
}

.user-bubble {
  max-width: min(78%, 620px);
  padding: 10px 16px;
  line-height: 1.75;
  white-space: pre-wrap;
  background: var(--el-color-primary-light-9);
  background: color-mix(in srgb, var(--el-color-primary-light-8) 55%, var(--el-bg-color));
  border-radius: 14px;
}

.agent-content {
  width: 100%;
  padding: 0;
}

.agent-content :deep(.markdown-body) {
  font-size: 14px;
}

.message-sources {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.source-card {
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.source-card strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}

.source-card p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
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

  .user-bubble {
    max-width: 88%;
    padding: 9px 13px;
  }

  .message-sources {
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 14px;
  }

  .source-card {
    padding: 8px 10px;
  }
}
</style>
