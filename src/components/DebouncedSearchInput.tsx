import { Input, type InputProps, type InputRef } from 'antd'
import { forwardRef, useEffect, useRef, useState } from 'react'
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../utils/useDebouncedValue'

type DebouncedSearchInputProps = Omit<InputProps, 'value' | 'defaultValue' | 'onChange'> & {
  value?: string
  onChange: (value: string) => void
  debounceMs?: number
}

/** Search input that shows keystrokes immediately but emits `onChange` after a debounce. */
export const DebouncedSearchInput = forwardRef<InputRef, DebouncedSearchInputProps>(function DebouncedSearchInput(
  { value, onChange, debounceMs = SEARCH_DEBOUNCE_MS, onPressEnter, ...rest },
  ref,
) {
  const committed = value ?? ''
  const [inner, setInner] = useState(committed)
  const committedRef = useRef(committed)
  const onChangeRef = useRef(onChange)
  committedRef.current = committed
  onChangeRef.current = onChange

  useEffect(() => {
    setInner(committed)
  }, [committed])

  const debouncedInner = useDebouncedValue(inner, debounceMs)

  useEffect(() => {
    if (debouncedInner === committedRef.current) return
    onChangeRef.current(debouncedInner)
  }, [debouncedInner])

  const emit = (next: string) => {
    if (next === committedRef.current) return
    onChangeRef.current(next)
  }

  return (
    <Input
      {...rest}
      ref={ref}
      value={inner}
      onChange={(event) => setInner(event.target.value)}
      onPressEnter={(event) => {
        emit(inner)
        onPressEnter?.(event)
      }}
    />
  )
})
