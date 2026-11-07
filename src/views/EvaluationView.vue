<script setup lang="ts">
import { onMounted } from 'vue'
import EvalCaseList from '@/components/evaluation/EvalCaseList.vue'
import { PERMISSIONS } from '@/auth'
import { useEvalCaseStore } from '@/stores/eval-cases'

/** 评测 store，提供评测用例列表 */
const evalCaseStore = useEvalCaseStore()

onMounted(() => {
  void evalCaseStore.load()
})
</script>

<template>
  <section class="page-surface evaluation-page">
    <!-- 评测页头部与运行操作待实现 -->
    <div class="page-toolbar">
      <el-button v-permission="PERMISSIONS.EVALUATION_MANAGE" type="primary">批量运行</el-button>
    </div>
    <EvalCaseList :items="evalCaseStore.list" />
  </section>
</template>

<style scoped>
.evaluation-page {
  min-height: 100%;
  padding: 20px;
}

.page-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
