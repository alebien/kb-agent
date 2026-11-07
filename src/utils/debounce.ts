export interface DebouncedFunction<TArgs extends unknown[]> {
  /** 触发防抖函数 */
  (...args: TArgs): void
  /** 取消尚未执行的调用 */
  cancel: () => void
  /** 立即执行等待中的最后一次调用 */
  flush: () => void
}

interface DebounceOptions {
  /** 是否在连续触发的第一次立即执行 */
  leading?: boolean
}

/**
 * 延迟执行，连续触发时只保留最后一次
 * leading 为 true 时先立即执行一次，安静下来后再补一次最终状态
 */
export function debounce<TArgs extends unknown[]>(
  handler: (...args: TArgs) => void,
  wait = 150,
  options: DebounceOptions = {},
): DebouncedFunction<TArgs> {
  /** 等待下一次执行的定时器 */
  let timer: ReturnType<typeof setTimeout> | undefined
  /** 最近一次触发时传入的参数 */
  let pendingArgs: TArgs | undefined

  /** 定时器到期后执行挂起的调用 */
  function invoke() {
    timer = undefined

    if (!pendingArgs) {
      return
    }

    /** 本次要执行的参数，先取出再清空，避免重复执行 */
    const args = pendingArgs
    pendingArgs = undefined
    handler(...args)
  }

  /** 对外的防抖函数 */
  const debounced: DebouncedFunction<TArgs> = (...args) => {
    if (options.leading && timer === undefined) {
      handler(...args)
    } else {
      pendingArgs = args
    }

    if (timer !== undefined) {
      clearTimeout(timer)
    }

    timer = setTimeout(invoke, wait)
  }

  /** 取消定时器并丢弃挂起的参数 */
  debounced.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
    }

    timer = undefined
    pendingArgs = undefined
  }

  /** 立即执行挂起的调用；没有挂起内容时直接返回 */
  debounced.flush = () => {
    if (timer === undefined) {
      return
    }

    clearTimeout(timer)
    invoke()
  }

  return debounced
}
