<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'
import '@/assets/markdown.css'

/** Markdown 渲染参数 */
const props = withDefaults(
  defineProps<{
    /** 待渲染的 Markdown 源码 */
    content: string
    /** 是否处于流式输出中，用于追加光标等样式 */
    streaming?: boolean
  }>(),
  {
    streaming: false,
  },
)

/** 将 Markdown 源码转换为已清洗的安全 HTML */
const html = computed(() => renderMarkdown(props.content))
</script>

<template>
  <div class="markdown-body" :class="{ 'is-streaming': streaming }" v-html="html" />
</template>
