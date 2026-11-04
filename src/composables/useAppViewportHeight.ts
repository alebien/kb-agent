import { onBeforeUnmount, onMounted } from 'vue'
import { debounce } from '@/utils/debounce'

/**
 * 用可视视口高度驱动应用外壳高度。
 * 移动端软键盘弹出时 visualViewport 会缩小，外壳随之收缩，底部输入框不会被键盘遮挡。
 */
export function useAppViewportHeight() {
  function updateHeight() {
    const visualViewport = window.visualViewport

    if (visualViewport && visualViewport.scale !== 1) {
      return
    }

    const height = visualViewport?.height ?? window.innerHeight
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`)
  }

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
