<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'
import '@/assets/markdown.css'

const props = withDefaults(
  defineProps<{
    content: string
    streaming?: boolean
  }>(),
  {
    streaming: false,
  },
)

const html = computed(() => renderMarkdown(props.content))
</script>

<template>
  <div class="markdown-body" :class="{ 'is-streaming': streaming }" v-html="html" />
</template>
