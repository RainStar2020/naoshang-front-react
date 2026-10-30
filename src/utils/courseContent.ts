/** 课程章节富文本：允许文字/图片/视频交错；禁止 script/iframe 等危险节点（保存前显式拒绝，不可静默入库）。 */

const COURSE_FORBIDDEN = new Set(['script', 'iframe', 'embed', 'object', 'link', 'style'])

function walkForbidden(nodes: unknown[]): string | null {
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue
    const node = raw as Record<string, unknown>
    const name = typeof node.name === 'string' ? node.name.toLowerCase() : ''
    if (COURSE_FORBIDDEN.has(name)) return name
    if (Array.isArray(node.children)) {
      const nested = walkForbidden(node.children)
      if (nested) return nested
    }
  }
  return null
}

export function findForbiddenCourseMedia(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null
  const nodes = (input as { nodes?: unknown }).nodes
  if (!Array.isArray(nodes)) return null
  return walkForbidden(nodes)
}

export function assertCourseContentAllowsSave(input: unknown): void {
  const forbidden = findForbiddenCourseMedia(input)
  if (forbidden) {
    throw new Error(`课程内容禁止包含「${forbidden}」节点，请删除后重试`)
  }
}