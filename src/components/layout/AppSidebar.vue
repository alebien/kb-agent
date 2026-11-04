<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConversationStore } from '@/stores/conversations'
import { debounce } from '@/utils/debounce'

const props = defineProps<{
  open: boolean
  collapsed: boolean
}>()

const emit = defineEmits<{
  close: []
  'toggle-collapse': []
}>()

const route = useRoute()
const router = useRouter()
const conversationStore = useConversationStore()
const isAnimating = ref(false)
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= 900)
let animationTimer: ReturnType<typeof setTimeout> | undefined
let skipNextAnimation = false

const mainMenus = [
  {
    label: '文档',
    path: '/documents',
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  },
  { label: '评测中心', path: '/evaluation', icon: 'M18 20V10M12 20V4M6 20v-6' },
  {
    label: '工单',
    path: '/tickets',
    icon: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z',
  },
  {
    label: '设置',
    path: '/settings',
    icon: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  },
]

const activeMenu = computed(() => {
  if (route.name === 'chat-draft') {
    return 'new-chat'
  }

  return route.path
})
const recentChats = computed(() =>
  conversationStore.list.map((conversation) => ({
    label: conversation.title,
    path: `/chat/${conversation.id}`,
  })),
)
const toggleIcon = computed(() => {
  const canExpand = props.collapsed && !isMobile.value
  return canExpand ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'
})
const toggleLabel = computed(() => {
  if (isMobile.value) {
    return '关闭导航'
  }

  return props.collapsed ? '展开侧边栏' : '收起侧边栏'
})

watch(
  () => props.open,
  () => {
    // 断点切换会主动收起侧边栏，这时不播放滑出动画，避免闪动。
    if (skipNextAnimation) {
      skipNextAnimation = false
      stopAnimation()
      return
    }

    isAnimating.value = true

    if (animationTimer !== undefined) {
      clearTimeout(animationTimer)
    }

    animationTimer = setTimeout(() => {
      isAnimating.value = false
    }, 300)
  },
)

function stopAnimation() {
  if (animationTimer !== undefined) {
    clearTimeout(animationTimer)
    animationTimer = undefined
  }

  isAnimating.value = false
}

function close() {
  emit('close')
}

function toggleAside() {
  if (isMobile.value) {
    close()
    return
  }

  emit('toggle-collapse')
}

async function handleMenuSelect(index: string) {
  close()

  if (index === 'new-chat') {
    await router.push({ name: 'chat-draft' })
    return
  }

  await router.push(index)
}

function handleKeydown(event: KeyboardEvent) {
  if (props.open && event.key === 'Escape') {
    close()
  }
}

const handleResize = debounce(() => {
  if (window.innerWidth > 900 && props.open) {
    skipNextAnimation = true
    close()
  }
}, 150)

function handleViewportChange() {
  isMobile.value = window.innerWidth <= 900
  handleResize()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleViewportChange)
  void conversationStore.load()
})

onBeforeUnmount(() => {
  if (animationTimer !== undefined) {
    clearTimeout(animationTimer)
  }

  handleResize.cancel()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleViewportChange)
})
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
      <el-menu :default-active="activeMenu" class="aside-menu" @select="handleMenuSelect">
        <el-menu-item
          v-for="item in mainMenus"
          :key="item.path"
          :index="item.path"
          :title="collapsed && !isMobile ? item.label : undefined"
        >
          <svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path :d="item.icon" />
          </svg>
          <span class="menu-label">{{ item.label }}</span>
        </el-menu-item>
        <el-menu-item index="new-chat" :title="collapsed && !isMobile ? '新对话' : undefined">
          <svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span class="menu-label">新对话</span>
        </el-menu-item>
      </el-menu>

      <el-divider class="aside-divider" />
      <p class="aside-section-title">最近对话</p>

      <el-menu
        :default-active="route.path"
        class="aside-menu recent-menu"
        @select="handleMenuSelect"
      >
        <el-menu-item v-for="chat in recentChats" :key="chat.path" :index="chat.path">
          <svg class="menu-icon menu-icon--recent" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span class="menu-label">{{ chat.label }}</span>
        </el-menu-item>
      </el-menu>
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

.menu-icon--recent {
  width: 16px;
  height: 16px;
  opacity: 0.7;
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

.recent-menu :deep(.el-menu-item) {
  height: 38px;
  font-size: 13px;
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
  .app-aside.is-collapsed .recent-menu {
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
