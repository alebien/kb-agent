<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useAppViewportHeight } from '@/composables/useAppViewportHeight'

const route = useRoute()
const isSidebarOpen = ref(false)
const sidebarCollapsedKey = 'kb-agent:sidebar-collapsed'
const isSidebarCollapsed = ref(
  typeof window !== 'undefined' && window.localStorage.getItem(sidebarCollapsedKey) === '1',
)

useAppViewportHeight()

function openSidebar() {
  isSidebarOpen.value = true
}

function closeSidebar() {
  isSidebarOpen.value = false
}

function toggleSidebarCollapse() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

watch(
  () => route.fullPath,
  () => closeSidebar(),
)

watch(isSidebarCollapsed, (value) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(sidebarCollapsedKey, value ? '1' : '0')
  }
})
</script>

<template>
  <el-container class="app-shell">
    <AppSidebar
      :open="isSidebarOpen"
      :collapsed="isSidebarCollapsed"
      @close="closeSidebar"
      @toggle-collapse="toggleSidebarCollapse"
    />

    <el-container class="app-body" direction="vertical">
      <AppHeader :nav-open="isSidebarOpen" @open-nav="openSidebar" />

      <el-main class="app-main" :class="{ 'is-chat': route.name === 'chat' }">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-shell {
  height: var(--app-height, 100vh);
  background: var(--el-bg-color-page);
}

.app-body {
  min-width: 0;
}

.app-main {
  min-height: 0;
  padding: var(--app-page-gutter) var(--app-page-gutter) 0;
  overflow: hidden;
}

.app-main.is-chat {
  padding-bottom: var(--app-page-gutter);
}

.app-main:not(.is-chat) {
  padding-bottom: var(--app-page-gutter);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
