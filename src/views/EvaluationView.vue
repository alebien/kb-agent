<script setup lang="ts">
import { onMounted } from 'vue'
import EvalCaseList from '@/components/evaluation/EvalCaseList.vue'
import { useEvalCaseStore } from '@/stores/eval-cases'

/** 评测 store，提供评测用例列表。 */
const evalCaseStore = useEvalCaseStore()

onMounted(() => {
  void evalCaseStore.load()
})
</script>

<template>
  <section class="page-surface evaluation-page">
    <!-- 评测页头部与运行操作待实现 -->
    <EvalCaseList :items="evalCaseStore.list" />
  </section>
</template>

<style scoped>
.evaluation-page {
  min-height: 100%;
  padding: 20px;
}
</style>
