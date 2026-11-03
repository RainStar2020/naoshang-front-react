/** 变更类操作备注：UI 选填；后端字段仍为 reason。空值时用占位，避免 HQ 写口 400。 */
export const EMPTY_REMARK_PLACEHOLDER = '（无备注）'

export function normalizeRemark(value: unknown, max = 200): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return EMPTY_REMARK_PLACEHOLDER
  return text.length > max ? text.slice(0, max) : text
}

export function remarkLabel(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || '（无）'
}
