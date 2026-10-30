/** 商品详情仅允许文字+图片；视频节点须在保存前显式拒绝（不可静默剥离）。 */

const FORBIDDEN_MEDIA = new Set(['video', 'iframe', 'source', 'embed', 'object'])

function walkForbidden(nodes: unknown[]): string | null {
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue
    const node = raw as Record<string, unknown>
    const name = typeof node.name === 'string' ? node.name.toLowerCase() : ''
    if (FORBIDDEN_MEDIA.has(name)) return name
    if (Array.isArray(node.children)) {
      const nested = walkForbidden(node.children)
      if (nested) return nested
    }
  }
  return null
}

/** 若含视频等禁止节点，返回节点名；否则 null */
export function findForbiddenProductMedia(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null
  const nodes = (input as { nodes?: unknown }).nodes
  if (!Array.isArray(nodes)) return null
  return walkForbidden(nodes)
}

export function assertProductContentAllowsSave(input: unknown): void {
  const forbidden = findForbiddenProductMedia(input)
  if (forbidden) {
    throw new Error(`商品详情仅支持文字和图片，不能包含「${forbidden}」节点，请删除后重试`)
  }
}