import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', () => {
  /** 当前计数值。 */
  const count = ref(0)
  /** 计数值的两倍，用于演示派生状态。 */
  const doubleCount = computed(() => count.value * 2)
  /** 将计数值加一。 */
  function increment() {
    count.value++
  }

  return { count, doubleCount, increment }
})
