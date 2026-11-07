<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import HeaderActions from './HeaderActions.vue'

defineProps<{
  /** 移动端侧边栏是否打开，用于同步按钮的展开状态 */
  navOpen: boolean
}>()

/** 向父组件派发的顶部栏事件 */
const emit = defineEmits<{
  'open-nav': []
}>()

/** 当前路由信息，用于读取页面标题与状态 */
const route = useRoute()

/** 顶部栏页面标题，取路由 meta 配置 */
const pageTitle = computed(() => (route.meta.pageTitle as string | undefined) ?? '企业知识库 Agent')
/** 标题右侧的状态标签文案 */
const status = computed(() => route.meta.status as string | undefined)

/** 请求父组件打开移动端侧边栏 */
function openNav() {
  emit('open-nav')
}
</script>

<template>
  <el-header class="app-header">
    <div class="header-leading">
      <el-button
        text
        class="mobile-menu-button"
        aria-label="打开导航"
        :aria-expanded="navOpen"
        @click="openNav"
      >
        <span class="mobile-menu-icon" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
      </el-button>

      <div class="header-title-area">
        <div class="page-title-row">
          <h1>{{ pageTitle }}</h1>
          <el-tag v-if="status" type="success" effect="plain" round>{{ status }}</el-tag>
        </div>
      </div>
    </div>

    <HeaderActions />
  </el-header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: calc(var(--app-header-height) + env(safe-area-inset-top));
  min-height: 0;
  padding: env(safe-area-inset-top) max(24px, env(safe-area-inset-right)) 0
    max(24px, env(safe-area-inset-left));
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.header-leading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.mobile-menu-button {
  display: none;
  flex-shrink: 0;
  padding: 6px;
}

.mobile-menu-icon {
  display: flex;
  width: 16px;
  flex-direction: column;
  gap: 4px;
}

.mobile-menu-icon i {
  width: 100%;
  height: 1.5px;
  background: currentColor;
  border-radius: 2px;
}

.header-title-area {
  min-width: 0;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title-row h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.3;
}

@media (max-width: 900px) {
  .mobile-menu-button {
    display: inline-flex;
  }

  .app-header {
    gap: 12px;
    padding-right: max(14px, env(safe-area-inset-right));
    padding-left: max(14px, env(safe-area-inset-left));
  }

  .page-title-row h1 {
    font-size: 18px;
  }
}

@media (max-width: 640px) {
  .page-title-row h1 {
    overflow: hidden;
    font-size: 17px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 380px) {
  .page-title-row :deep(.el-tag) {
    display: none;
  }

  .app-header {
    padding-right: 10px;
    padding-left: 10px;
  }
}

@media (max-width: 900px) and (max-height: 560px) {
  .page-title-row h1 {
    font-size: 17px;
  }
}
</style>
