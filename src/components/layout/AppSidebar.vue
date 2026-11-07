<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteConversation, renameConversation } from '@/api/conversations'
import { PERMISSIONS, type PermissionCode } from '@/auth'
import { useAuthStore } from '@/stores/auth'
import { useConversationStore } from '@/stores/conversations'
import { debounce } from '@/utils/debounce'
import ConversationList from './ConversationList.vue'
import { createConversationMenuActions, type ConversationActionKey } from './conversationMenu'
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

/** 当前路由信息 */
const route = useRoute()
/** 路由实例，用于菜单跳转 */
const router = useRouter()
/** 登录状态 store，控制菜单可见性 */
const authStore = useAuthStore()
/** 会话列表 store，提供最近对话数据 */
const conversationStore = useConversationStore()
/** 是否正在播放开关动画，用于临时启用过渡效果 */
const isAnimating = ref(false)
/** 当前视口是否处于移动端断点 */
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= 900)
/** 侧边栏开关动画的结束定时器 */
let animationTimer: ReturnType<typeof setTimeout> | undefined
/** 断点切换时置为 true，用于跳过下一次滑出动画 */
let skipNextAnimation = false

/** 主菜单配置，每个菜单声明访问所需权限 */
const mainMenus: {
  /** 菜单文案 */
  label: string
  /** 点击后跳转的路由 */
  path: string
  /** 菜单图标的 SVG path */
  icon: string
  /** 菜单要求的权限码 */
  permission: PermissionCode
}[] = [
  {
    label: '文档',
    path: '/documents',
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
    permission: PERMISSIONS.DOCUMENT_VIEW,
  },
  {
    label: '评测中心',
    path: '/evaluation',
    icon: 'M18 20V10M12 20V4M6 20v-6',
    permission: PERMISSIONS.EVALUATION_VIEW,
  },
  {
    label: '工单',
    path: '/tickets',
    icon: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z',
    permission: PERMISSIONS.TICKET_VIEW,
  },
]

/** 当前用户可见的主菜单，按权限码逐项过滤 */
const visibleMenus = computed(() => mainMenus.filter((item) => authStore.can(item.permission)))
/** 当前高亮的菜单项，草稿页高亮「新对话」 */
const activeMenu = computed(() => {
  if (route.name === 'chat-draft') {
    return 'new-chat'
  }

  return route.path
})
/** 当前打开的会话 id，用于最近对话列表高亮 */
const activeConversationId = computed(() => {
  const id = route.params.conversationId
  return typeof id === 'string' ? id : ''
})
/** 最近对话的更多操作，重命名与删除分别按权限展示 */
const conversationActions = computed(() =>
  createConversationMenuActions({
    canRename: authStore.can(PERMISSIONS.CHAT_RENAME),
    canDelete: authStore.can(PERMISSIONS.CHAT_DELETE),
  }),
)
/** 侧边栏折叠按钮的图标路径，根据折叠状态切换方向 */
const toggleIcon = computed(() => {
  /** 是否处于可展开状态 */
  const canExpand = props.collapsed && !isMobile.value
  return canExpand ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'
})
/** 折叠按钮的无障碍提示文案 */
const toggleLabel = computed(() => {
  if (isMobile.value) {
    return '关闭导航'
  }

  return props.collapsed ? '展开侧边栏' : '收起侧边栏'
})

watch(
  () => props.open,
  () => {
    // 断点切换会主动收起侧边栏，这时不播放滑出动画，避免闪动
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

/** 请求父组件关闭移动端侧边栏 */
function close() {
  emit('close')
}

/** 移动端点击按钮关闭抽屉，桌面端切换折叠状态 */
function toggleAside() {
  if (isMobile.value) {
    close()
    return
  }

  emit('toggle-collapse')
}

/** 处理侧边栏菜单选中，关闭抽屉并跳转到对应路由 */
async function handleMenuSelect(index: string) {
  close()

  if (index === 'new-chat') {
    await router.push({ name: 'chat-draft' })
    return
  }

  await router.push(index)
}

/** 打开最近对话并收起移动端侧边栏 */
async function selectConversation(conversation: ConversationSummary) {
  close()
  await router.push(`/chat/${conversation.id}`)
}

/** 执行最近对话的操作，新增操作时在这里扩展分支 */
async function handleConversationAction(
  action: ConversationActionKey,
  conversation: ConversationSummary,
) {
  if (action === 'rename') {
    await renameConversationItem(conversation)
    return
  }

  await deleteConversationItem(conversation)
}

/** 重命名会话，执行前再次校验权限 */
async function renameConversationItem(conversation: ConversationSummary) {
  if (!authStore.can(PERMISSIONS.CHAT_RENAME)) {
    return
  }

  /** ElMessageBox 返回的新名称 */
  let nextTitle: string

  try {
    /** 重命名弹窗的确认结果 */
    const result = await ElMessageBox.prompt('请输入新的对话名称', '重命名对话', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: conversation.title,
      inputPlaceholder: '对话名称',
      inputValidator: (value: string) => {
        /** 去除首尾空白后的名称 */
        const title = value.trim()
        if (!title) {
          return '名称不能为空'
        }
        if (title.length > 40) {
          return '名称最多 40 个字符'
        }
        return true
      },
    })
    nextTitle = result.value.trim()
  } catch {
    return
  }

  try {
    /** 接口返回的更新后摘要 */
    const summary = await renameConversation(conversation.id, nextTitle)
    conversationStore.updateTitle(summary.id, summary.title)
    ElMessage.success('已重命名')
  } catch {
    ElMessage.error('重命名失败，请稍后重试')
  }
}

/** 删除会话，删除当前打开会话后回到新对话页 */
async function deleteConversationItem(conversation: ConversationSummary) {
  if (!authStore.can(PERMISSIONS.CHAT_DELETE)) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `删除「${conversation.title}」后无法恢复，确定继续吗？`,
      '删除对话',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
  } catch {
    return
  }

  try {
    await deleteConversation(conversation.id)
    conversationStore.remove(conversation.id)

    if (activeConversationId.value === conversation.id) {
      await router.push({ name: 'chat-draft' })
    }

    ElMessage.success('已删除对话')
  } catch {
    ElMessage.error('删除对话失败，请稍后重试')
  }
}

/** 按下 Esc 时关闭移动端侧边栏 */
function handleKeydown(event: KeyboardEvent) {
  if (props.open && event.key === 'Escape') {
    close()
  }
}

/** 防抖后的窗口尺寸处理：从移动端切回桌面端时收起抽屉 */
const handleResize = debounce(() => {
  if (window.innerWidth > 900 && props.open) {
    skipNextAnimation = true
    close()
  }
}, 150)

/** 更新移动端标记并触发防抖的尺寸处理 */
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
          v-for="item in visibleMenus"
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

      <ConversationList
        class="recent-conversations"
        :items="conversationStore.list"
        :active-id="activeConversationId"
        :actions="conversationActions"
        @select="selectConversation"
        @action="handleConversationAction"
      />
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
