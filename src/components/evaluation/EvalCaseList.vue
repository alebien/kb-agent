<script setup lang="ts">
import type { EvalCase } from '@/domain'

/** 评测用例列表参数。 */
defineProps<{
  /** 待展示的评测用例。 */
  items: EvalCase[]
}>()
</script>

<template>
  <!-- 评测用例列表待实现 -->
  <div class="eval-case-list">
    <el-empty description="暂无评测用例" />
  </div>
</template>
