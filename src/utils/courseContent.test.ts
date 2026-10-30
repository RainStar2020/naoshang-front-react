import { describe, expect, it } from 'vitest'
import { normalizeContent } from './richContent'
import { assertCourseContentAllowsSave, findForbiddenCourseMedia } from './courseContent'
import { assertProductContentAllowsSave, findForbiddenProductMedia } from './productContent'

describe('课程 vs 商品媒体策略', () => {
  const interleaved = {
    version: 1 as const,
    format: 'nodes' as const,
    nodes: [
      { name: 'p' as const, attrs: {}, children: [{ type: 'text' as const, text: 'a' }] },
      { name: 'img' as const, attrs: { src: 'https://example.com/a.png' }, children: [] },
      { name: 'video' as const, attrs: { src: 'https://example.com/a.mp4' }, children: [] },
      { name: 'p' as const, attrs: {}, children: [{ type: 'text' as const, text: 'b' }] },
    ],
  }

  it('课程允许视频并保持交错顺序', () => {
    expect(findForbiddenCourseMedia(interleaved)).toBeNull()
    expect(() => assertCourseContentAllowsSave(interleaved)).not.toThrow()
    const normalized = normalizeContent(interleaved)
    expect(normalized.nodes.map((n) => ('type' in n ? 'text' : n.name))).toEqual(['p', 'img', 'video', 'p'])
  })

  it('商品仍禁止视频（回归）', () => {
    expect(findForbiddenProductMedia(interleaved)).toBe('video')
    expect(() => assertProductContentAllowsSave(interleaved)).toThrow(/图片|video/)
  })

  it('课程拒绝 script/iframe', () => {
    expect(findForbiddenCourseMedia({ version: 1, format: 'nodes', nodes: [{ name: 'script', attrs: {}, children: [] }] })).toBe('script')
    expect(() => assertCourseContentAllowsSave({ version: 1, format: 'nodes', nodes: [{ name: 'iframe', attrs: {}, children: [] }] })).toThrow(/iframe/)
  })
})