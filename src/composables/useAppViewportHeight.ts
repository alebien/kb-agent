import { onBeforeUnmount, onMounted } from 'vue'
import { debounce } from '@/utils/debounce'

/**
 * 用可视视口高度驱动应用外壳高度
 * 移动端软键盘弹出时 visualViewport 会缩小，外壳随之收缩，底部输入框不会被键盘遮挡
 */
export function useAppViewportHeight() {
  /** 读取可视视口高度并写入 CSS 变量 `--app-height` */
  function updateHeight() {
    /** 移动端可视视口对象，桌面端可能为 undefined */
    const visualViewport = window.visualViewport

    if (visualViewport && visualViewport.scale !== 1) {
      return
    }

    /** 当前可用高度，优先使用 visualViewport */
    const height = visualViewport?.height ?? window.innerHeight
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`)
  }

  /** 防抖后的高度同步函数，首次触发立即执行 */
  const syncHeight = debounce(updateHeight, 100, { leading: true })

  onMounted(() => {
    syncHeight()
    window.addEventListener('resize', syncHeight)
    window.visualViewport?.addEventListener('resize', syncHeight)
  })

  onBeforeUnmount(() => {
    syncHeight.cancel()
    window.removeEventListener('resize', syncHeight)
    window.visualViewport?.removeEventListener('resize', syncHeight)
  })
}
