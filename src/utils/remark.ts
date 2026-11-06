/** 变更类操作原因/备注：前端必填；字段名默认 reason（与后端契约一致）。 */
export const EMPTY_REMARK_PLACEHOLDER = '（无备注）'

/** 规范化并校验操作原因：去空白后必填，最长 max 字。 */
export function normalizeRemark(value: unknown, max = 200): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error('请填写操作原因')
  return text.length > max ? text.slice(0, max) : text
}

export function remarkLabel(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || '（无）'
}
