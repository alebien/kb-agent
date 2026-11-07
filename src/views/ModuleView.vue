<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

/** 当前路由信息，用于读取模块标题 */
const route = useRoute()
/** 模块页标题，取路由 meta 中的 title */
const title = computed(() => (route.meta.title as string | undefined) ?? '页面')
</script>

<template>
  <el-card shadow="never" class="module-page page-surface">
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

@media (max-width: 480px) {
  .module-header {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .module-header > div {
    min-width: 0;
    flex: 1 1 180px;
  }

  .module-header > .el-button {
    flex-shrink: 0;
  }

  .module-header p {
    font-size: 12px;
  }
}
</style>
