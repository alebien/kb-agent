import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { debounce } from '@/utils/debounce'

/** 移动端断点宽度，与组件样式里的媒体查询保持一致 */
const MOBILE_BREAKPOINT = 900
/** 抽屉滑出动画时长，与组件样式里的过渡时间保持一致 */
const ANIMATION_DURATION_MS = 300

/** 侧边栏布局交互的入参 */
export interface SidebarLayoutOptions {
  /** 移动端抽屉是否打开，读取父组件的受控状态 */
  isOpen: () => boolean
  /** 桌面端是否折叠，读取父组件的受控状态 */
  isCollapsed: () => boolean
  /** 请求父组件关闭移动端抽屉 */
  onClose: () => void
  /** 请求父组件切换桌面端折叠状态 */
  onToggleCollapse: () => void
}

/**
 * 侧边栏布局交互
 *
 * 负责移动端抽屉、桌面端折叠、断点监听与滑出动画，
 * 不关心会话数据与路由，便于单独复用和测试
 *
 * @param options 受控状态读取函数与交互回调
 */
export function useSidebarLayout(options: SidebarLayoutOptions) {
  /** 是否正在播放开关动画，用于临时启用过渡效果 */
  const isAnimating = ref(false)
  /** 当前视口是否处于移动端断点 */
  const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT)
  /** 开关动画的结束定时器 */
  let animationTimer: ReturnType<typeof setTimeout> | undefined
  /** 断点切换时置为 true，用于跳过下一次滑出动画 */
  let skipNextAnimation = false

  /** 折叠按钮图标路径，根据折叠状态切换方向 */
  const toggleIcon = computed(() => {
    /** 是否处于可展开状态 */
    const canExpand = options.isCollapsed() && !isMobile.value
    return canExpand ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'
  })

  /** 折叠按钮的无障碍提示文案 */
  const toggleLabel = computed(() => {
    if (isMobile.value) {
      return '关闭导航'
    }

    return options.isCollapsed() ? '展开侧边栏' : '收起侧边栏'
  })

  /** 清理动画定时器并收起动画标记 */
  function stopAnimation() {
    if (animationTimer !== undefined) {
      clearTimeout(animationTimer)
      animationTimer = undefined
    }

    isAnimating.value = false
  }

  // 抽屉开关时临时启用过渡，避免首屏与断点切换出现闪动
  watch(options.isOpen, () => {
    // 断点切换会主动收起侧边栏，这时不播放滑出动画
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
    }, ANIMATION_DURATION_MS)
  })

  /** 请求父组件关闭移动端侧边栏 */
  function close() {
    options.onClose()
  }

  /** 移动端点击按钮关闭抽屉，桌面端切换折叠状态 */
  function toggleAside() {
    if (isMobile.value) {
      close()
      return
    }

    options.onToggleCollapse()
  }

  /** 按下 Esc 时关闭移动端侧边栏 */
  function handleKeydown(event: KeyboardEvent) {
    if (options.isOpen() && event.key === 'Escape') {
      close()
    }
  }

  /** 防抖后的窗口尺寸处理：从移动端切回桌面端时收起抽屉 */
  const handleResize = debounce(() => {
    if (window.innerWidth > MOBILE_BREAKPOINT && options.isOpen()) {
      skipNextAnimation = true
      close()
    }
  }, 150)

  /** 更新移动端标记并触发防抖的尺寸处理 */
  function handleViewportChange() {
    isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
    handleResize()
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('resize', handleViewportChange)
  })

  onBeforeUnmount(() => {
    if (animationTimer !== undefined) {
      clearTimeout(animationTimer)
    }

    handleResize.cancel()
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('resize', handleViewportChange)
  })

  return { isAnimating, isMobile, toggleIcon, toggleLabel, close, toggleAside }
}
