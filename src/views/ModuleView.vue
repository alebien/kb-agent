<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (route.meta.title as string | undefined) ?? '页面')
</script>

<template>
  <el-card shadow="never" class="module-page">
    <template #header>
      <div class="module-header">
        <div>
          <h2>{{ title }}</h2>
          <p>当前页面已接入路由，可在此继续填充业务模块。</p>
        </div>
        <el-button type="primary">新建</el-button>
      </div>
    </template>
    <el-empty description="页面布局占位" />
  </el-card>
</template>

<style scoped>
.module-page {
  min-height: 100%;
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.module-header h2 {
  margin: 0;
  font-size: 18px;
}

.module-header p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
