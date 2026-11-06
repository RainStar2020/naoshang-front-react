import type { CSSProperties } from 'react'
import { Form, Input } from 'antd'
import type { TextAreaProps } from 'antd/es/input'

/** 共用变更备注：文案「备注」、必填、带字数；字段名默认 reason（与后端契约一致）。 */
export function RemarkFormItem({
  name = 'reason',
  maxLength = 200,
  rows = 3,
  placeholder = '请填写操作原因',
  disabled,
}: {
  name?: string
  maxLength?: number
  rows?: number
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <Form.Item
      name={name}
      label="备注"
      rules={[
        { required: true, whitespace: true, message: '请填写操作原因' },
        { max: maxLength, message: `备注不能超过${maxLength}字` },
      ]}
    >
      <Input.TextArea rows={rows} maxLength={maxLength} showCount placeholder={placeholder} disabled={disabled} />
    </Form.Item>
  )
}

export function RemarkTextArea({
  value,
  onChange,
  maxLength = 200,
  rows = 3,
  placeholder = '请填写操作原因',
  disabled,
  'aria-label': ariaLabel = '备注',
  style,
}: {
  value?: string
  onChange?: (value: string) => void
  maxLength?: number
  rows?: number
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
  style?: CSSProperties
}) {
  const props: TextAreaProps = {
    'aria-label': ariaLabel,
    value,
    rows,
    maxLength,
    showCount: true,
    placeholder,
    disabled,
    style,
    onChange: (e) => onChange?.(e.target.value),
  }
  return <Input.TextArea {...props} />
}
