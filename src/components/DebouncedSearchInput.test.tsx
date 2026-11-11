// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DebouncedSearchInput } from './DebouncedSearchInput'
import { SEARCH_DEBOUNCE_MS } from '../utils/useDebouncedValue'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DebouncedSearchInput', () => {
  it('shows typed text immediately and emits onChange only after the debounce', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    render(<DebouncedSearchInput aria-label="合伙人搜索" value="" onChange={onChange} />)
    const input = screen.getByLabelText('合伙人搜索') as HTMLInputElement

    fireEvent.change(input, { target: { value: '13' } })
    expect(input.value).toBe('13')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '136' } })
    expect(input.value).toBe('136')
    act(() => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1) })
    expect(onChange).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(1) })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('136')
  })

  it('emits an empty value immediately when the box is cleared', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    render(<DebouncedSearchInput aria-label="搜索" value="136" onChange={onChange} />)
    const input = screen.getByLabelText('搜索') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
    expect(onChange).toHaveBeenCalledWith('')
  })
})
