<script setup lang="ts">
import type { Document } from '@/domain'

/** 文档列表参数 */
defineProps<{
  /** 待展示的文档列表 */
  items: Document[]
}>()
</script>

<template>
  <!-- 文档列表待实现 -->
  <div class="document-list">
    <el-empty description="暂无文档" />
  </div>
</template>
