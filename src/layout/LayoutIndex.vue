<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { createConversation, fetchConversationList } from '@/api/conversations'

const route = useRoute()
const isLoadingConversations = ref(true)
const recentChats = ref<{ label: string; path: string }[]>([])

const mainMenus = [
  { label: '对话', path: '/chat' },
  { label: '文档', path: '/documents' },
  { label: '评测中心', path: '/evaluation' },
  { label: '工单', path: '/tickets' },
  { label: '设置', path: '/settings' },
]

onMounted(async () => {
  try {
    const list = await fetchConversationList()
    recentChats.value = list.map((conversation) => ({
      label: conversation.title,
      path: `/chat/${conversation.id}`,
    }))
  } finally {
    isLoadingConversations.value = false
  }
})

async function handleCreateConversation() {
  const conversation = await createConversation()
  recentChats.value.unshift({
    label: conversation.title,
    path: `/chat/${conversation.id}`,
  })
}

const activeMenu = computed(() => (route.meta.menu as string | undefined) ?? route.path)
const breadcrumbs = computed(() => (route.meta.breadcrumb as string[] | undefined) ?? [])
const pageTitle = computed(() => (route.meta.pageTitle as string | undefined) ?? '企业知识库 Agent')
const status = computed(() => route.meta.status as string | undefined)
</script>

<template>
  <el-container class="app-shell">
    <el-aside width="232px" class="app-aside">
      <div class="brand">
        <div class="brand-mark">K</div>
        <div class="brand-copy">
          <strong>KnoAgent</strong>
          <span>ENTERPRISE AI</span>
        </div>
      </div>

      <el-scrollbar class="aside-scroll">
        <el-menu :default-active="activeMenu" router class="aside-menu">
          <el-menu-item v-for="item in mainMenus" :key="item.path" :index="item.path">
            {{ item.label }}
          </el-menu-item>
          <el-menu-item
            v-if="route.name === 'chat'"
            :index="`new-chat-${Date.now()}`"
            class="new-chat-item"
            @click="handleCreateConversation"
          >
            新对话
          </el-menu-item>
        </el-menu>

        <el-divider class="aside-divider" />
        <p class="aside-section-title">最近对话</p>

        <el-menu :default-active="route.path" router class="aside-menu recent-menu">
          <el-menu-item v-for="chat in recentChats" :key="chat.path" :index="chat.path">
            {{ chat.label }}
          </el-menu-item>
        </el-menu>
      </el-scrollbar>

      <div class="usage-panel">
        <el-divider class="usage-divider" />
        <div class="usage-label">
          <span>本月用量</span>
          <span>68%</span>
        </div>
        <el-progress :percentage="68" :show-text="false" :stroke-width="6" />
      </div>
    </el-aside>

    <el-container class="app-body">
      <el-header class="app-header">
        <div class="header-title-area">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="item in breadcrumbs" :key="item">
              {{ item }}
            </el-breadcrumb-item>
          </el-breadcrumb>
          <div class="page-title-row">
            <h1>{{ pageTitle }}</h1>
            <el-tag v-if="status" type="success" effect="plain" round>{{ status }}</el-tag>
          </div>
        </div>

        <div class="header-actions">
          <el-tag type="info" effect="plain">知识库 128</el-tag>
          <el-select model-value="DeepSeek-V3" class="model-select">
            <el-option label="DeepSeek-V3" value="DeepSeek-V3" />
            <el-option label="GPT-4.1" value="GPT-4.1" />
          </el-select>
          <el-button plain>流程</el-button>
          <el-avatar :size="32" class="user-avatar">Y</el-avatar>
        </div>
      </el-header>

      <el-main class="app-main">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  min-width: 1200px;
  background: var(--el-bg-color-page);
}

.app-aside {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 64px;
  padding: 0 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  background: var(--el-color-primary);
  border-radius: 8px;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-copy strong {
  font-size: 17px;
}

.brand-copy span {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 9px;
  letter-spacing: 0.12em;
}

.aside-scroll {
  flex: 1;
  min-height: 0;
}

.aside-menu {
  padding: 10px 8px;
  border-right: 0;
}

.aside-menu :deep(.el-menu-item) {
  height: 44px;
  margin: 2px 0;
  border-radius: 8px;
}

.aside-divider {
  margin: 10px 16px 8px;
}

.aside-section-title {
  margin: 0;
  padding: 4px 20px 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.recent-menu :deep(.el-menu-item) {
  height: 38px;
  font-size: 13px;
}

.usage-panel {
  padding: 0 16px 14px;
}

.usage-divider {
  margin: 12px 0 10px;
}

.usage-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.app-body {
  min-width: 0;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: auto;
  min-height: 64px;
  padding: 10px 28px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.header-title-area {
  min-width: 0;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.page-title-row h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.3;
}

.header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.model-select {
  width: 128px;
}

.user-avatar {
  background: var(--el-color-primary);
}

.app-main {
  min-height: 0;
  padding: 20px 24px 0;
  overflow: hidden;
}
</style>
