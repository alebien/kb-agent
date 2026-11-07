<script setup lang="ts">
import type { Ticket } from '@/domain'

/** 工单列表参数 */
defineProps<{
  /** 待展示的工单 */
  items: Ticket[]
}>()
</script>

<template>
  <!-- 工单列表待实现 -->
  <div class="ticket-list">
    <el-empty description="暂无工单" />
  </div>
</template>
