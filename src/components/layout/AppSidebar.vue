<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useConversationStore } from '@/stores/conversations'
import { useConversationActions } from '@/composables/useConversationActions'
import { useSidebarLayout } from '@/composables/useSidebarLayout'
import { useSidebarNavigation } from '@/composables/useSidebarNavigation'
import ConversationList from './ConversationList.vue'
import type { ConversationSummary } from '@/domain'

/** 侧边栏的受控状态 */
const props = defineProps<{
  /** 移动端侧边栏抽屉是否打开 */
  open: boolean
  /** 桌面端侧边栏是否处于折叠状态 */
  collapsed: boolean
}>()

/** 向父组件派发的侧边栏事件 */
const emit = defineEmits<{
  close: []
  'toggle-collapse': []
}>()

/** 登录状态 store，账号变化时重新拉取会话列表，避免跨账号缓存 */
const authStore = useAuthStore()
/** 会话列表 store，提供最近对话数据 */
const conversationStore = useConversationStore()

/** 菜单高亮、会话高亮与路由跳转 */
const {
  activeMenu,
  activeConversationId,
  conversationActions,
  goToNewChat,
  handleMenuSelect,
  openConversation,
} = useSidebarNavigation()

/** 移动端抽屉、桌面端折叠与断点监听 */
const { isAnimating, isMobile, toggleIcon, toggleLabel, close, toggleAside } = useSidebarLayout({
  isOpen: () => props.open,
  isCollapsed: () => props.collapsed,
  onClose: () => emit('close'),
  onToggleCollapse: () => emit('toggle-collapse'),
})

/** 最近对话的重命名与删除 */
const { handleConversationAction } = useConversationActions({
  activeConversationId: () => activeConversationId.value,
  onDeletedActive: goToNewChat,
})

/** 重新拉取最近对话，供列表错误态的重试按钮调用 */
function retryLoadConversations() {
  void conversationStore.load(true)
}

/** 空态快捷新建对话，先收起移动端抽屉再跳转 */
async function createNewChat() {
  close()
  await goToNewChat()
}

/** 打开最近对话并收起移动端侧边栏 */
async function selectConversation(conversation: ConversationSummary) {
  close()
  await openConversation(conversation)
}

/** 处理菜单选中，先收起移动端抽屉再跳转 */
async function handleSelect(index: string) {
  close()
  await handleMenuSelect(index)
}

onMounted(() => {
  void conversationStore.load()
})

// 登录、退出或切换到另一个账号后，会话列表必须按新的登录人重新过滤
watch(
  () => authStore.user?.id ?? '',
  () => {
    conversationStore.reset()
    if (authStore.isLoggedIn) {
      void conversationStore.load()
    }
  },
)
</script>

<template>
  <Transition name="aside-overlay">
    <button v-if="open" type="button" class="aside-overlay" aria-label="关闭导航" @click="close" />
  </Transition>

  <el-aside
    class="app-aside"
    :class="{
      'is-mobile-open': open,
      'is-animating': isAnimating,
      'is-collapsed': collapsed,
    }"
  >
    <div class="brand">
      <div class="brand-mark">K</div>
      <div class="brand-copy">
        <strong>KnoAgent</strong>
        <span>ENTERPRISE AI</span>
      </div>
      <el-button
        text
        class="aside-toggle"
        :aria-label="toggleLabel"
        :aria-expanded="!collapsed"
        @click="toggleAside"
      >
        <svg class="aside-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path :d="toggleIcon" />
        </svg>
      </el-button>
    </div>

    <el-scrollbar class="aside-scroll">
      <el-menu :default-active="activeMenu" class="aside-menu" @select="handleSelect">
        <el-menu-item index="new-chat" :title="collapsed && !isMobile ? '新对话' : undefined">
          <svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span class="menu-label">新对话</span>
        </el-menu-item>
      </el-menu>

      <template v-if="authStore.isLoggedIn">
        <el-divider class="aside-divider" />
        <p class="aside-section-title">最近对话</p>

        <ConversationList
          class="recent-conversations"
          :items="conversationStore.list"
          :active-id="activeConversationId"
          :actions="conversationActions"
          :loading="conversationStore.isLoading"
          :error="conversationStore.error"
          @select="selectConversation"
          @action="handleConversationAction"
          @retry="retryLoadConversations"
          @new-chat="createNewChat"
        />
      </template>
    </el-scrollbar>
  </el-aside>
</template>

<style scoped>
.app-aside {
  display: flex;
  width: 232px;
  flex-direction: column;
  overflow: hidden;
  padding-top: env(safe-area-inset-top);
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0;
  height: var(--app-header-height);
  padding: 0 10px 0 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: padding 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  margin-right: 10px;
  place-items: center;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  background: var(--el-color-primary);
  border-radius: 8px;
  transition: margin-right 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.brand-copy {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  line-height: 1.2;
  opacity: 1;
  transition: opacity 0.16s ease;
}

.brand-copy strong {
  overflow: hidden;
  font-size: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-copy span {
  overflow: hidden;
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aside-toggle {
  width: 28px;
  height: 28px;
  min-width: 28px;
  margin-left: auto;
  padding: 0;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.aside-toggle__icon {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
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
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  margin: 2px 0;
  padding: 0 12px;
  border-radius: 8px;
}

.menu-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.menu-label {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aside-divider {
  width: calc(100% - 32px);
  margin: 10px auto 8px;
}

.aside-section-title {
  margin: 0;
  padding: 4px 20px 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.aside-scroll :deep(.el-scrollbar__wrap) {
  overscroll-behavior: contain;
}

.aside-overlay {
  display: none;
}

.aside-overlay-enter-active,
.aside-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.aside-overlay-enter-from,
.aside-overlay-leave-to {
  opacity: 0;
}

@media (min-width: 901px) {
  .app-aside {
    transition: width 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .app-aside.is-collapsed {
    width: 80px;
  }

  .app-aside.is-collapsed .brand {
    padding: 0 5px;
  }

  .app-aside.is-collapsed .brand-mark {
    margin-right: 4px;
  }

  .app-aside.is-collapsed .brand-copy {
    opacity: 0;
  }

  .app-aside.is-collapsed .menu-label,
  .app-aside.is-collapsed .aside-divider,
  .app-aside.is-collapsed .aside-section-title,
  .app-aside.is-collapsed .recent-conversations {
    display: none;
  }

  .app-aside.is-collapsed .aside-menu {
    padding: 10px 8px;
  }

  .app-aside.is-collapsed .aside-menu :deep(.el-menu-item) {
    justify-content: center;
    gap: 0;
    padding: 0;
  }
}

@media (max-width: 900px) {
  .app-aside {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 2001;
    width: min(86vw, 280px);
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    transform: translateX(-100%);
  }

  .app-aside.is-animating {
    transition:
      transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.18s ease,
      visibility 0.22s;
  }

  .app-aside.is-mobile-open {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
    transform: translateX(0);
    box-shadow: var(--el-box-shadow-dark);
  }

  .aside-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: block;
    width: 100%;
    padding: 0;
    background: rgb(0 0 0 / 35%);
    border: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-aside.is-animating,
  .aside-overlay-enter-active,
  .aside-overlay-leave-active {
    transition: none;
  }
}
</style>
