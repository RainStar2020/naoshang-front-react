import { useEffect, useState } from 'react'

/** Default delay for typable search boxes that trigger list/search APIs. */
export const SEARCH_DEBOUNCE_MS = 400

function shouldFlush<T>(value: T) {
  return value === '' || value == null
}

/** Returns `value` after `delay` ms. Empty/null values flush immediately so reset/clear stays snappy. */
export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value)

  if (shouldFlush(value) && !Object.is(debounced, value)) {
    setDebounced(value)
  }

  useEffect(() => {
    if (Object.is(value, debounced)) return
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay, debounced])

  return shouldFlush(value) ? value : debounced
}
