export interface DebouncedFunction<TArgs extends unknown[]> {
  (...args: TArgs): void
  cancel: () => void
  flush: () => void
}

interface DebounceOptions {
  leading?: boolean
}

/**
 * 延迟执行，连续触发时只保留最后一次。
 * leading 为 true 时先立即执行一次，安静下来后再补一次最终状态。
 */
export function debounce<TArgs extends unknown[]>(
  handler: (...args: TArgs) => void,
  wait = 150,
  options: DebounceOptions = {},
): DebouncedFunction<TArgs> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingArgs: TArgs | undefined

  function invoke() {
    timer = undefined

    if (!pendingArgs) {
      return
    }

    const args = pendingArgs
    pendingArgs = undefined
    handler(...args)
  }

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

  debounced.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
    }

    timer = undefined
    pendingArgs = undefined
  }

  debounced.flush = () => {
    if (timer === undefined) {
      return
    }

    clearTimeout(timer)
    invoke()
  }

  return debounced
}
