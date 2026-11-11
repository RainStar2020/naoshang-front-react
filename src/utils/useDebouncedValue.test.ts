// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  it('keeps the initial value and only updates after the delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: '' },
    })
    expect(result.current).toBe('')

    rerender({ value: '13' })
    expect(result.current).toBe('')
    act(() => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1) })
    expect(result.current).toBe('')

    rerender({ value: '136' })
    act(() => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1) })
    expect(result.current).toBe('')
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe('136')
    vi.useRealTimers()
  })

  it('flushes empty values immediately so a reset does not reuse the previous keyword', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: '1360000' },
    })
    rerender({ value: '' })
    expect(result.current).toBe('')
    vi.useRealTimers()
  })
})
