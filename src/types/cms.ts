export type RichTag = 'p' | 'div' | 'span' | 'strong' | 'b' | 'em' | 'i' | 'u' | 's' | 'br' | 'h2' | 'h3' | 'ul' | 'ol' | 'li' | 'blockquote' | 'img' | 'video'
export type ContentNode = { type: 'text'; text: string } | { name: RichTag; attrs: { style?: string; src?: string; alt?: string; poster?: string; controls?: string }; children: ContentNode[] }
export interface RichContent { version: 1; format: 'nodes'; nodes: ContentNode[] }
export interface CmsTier { membershipTierId: string; number: number; name: string; summary: string; coverUrl: string; benefits: RichContent; version: number }
export interface CmsChapter { id: string; title: string; type: 'article' | 'video'; order: number; accessibility: 'membership-required'; content: RichContent; videoUrl: string; posterUrl: string }
export interface CmsCourseDraft { levelId: string; membershipTierId: string; number: number; name: string; summary: string; covers: string[]; content: RichContent; chapters: CmsChapter[] }
export interface CmsPublication { revision: number; publishedAt: string; draftVersion: number; tierName: string; course: CmsCourseDraft }
export interface CmsCourse { draft: CmsCourseDraft; version: number; status: 'draft' | 'published' | 'offline'; publication: CmsPublication | null }
export interface CmsAudit { operationId: string; requestId: string; targetId: string; action: 'save-tier' | 'save-course' | 'publish' | 'offline'; operatorId: string; operatorName: string; reason: string; occurredAt: string; beforeVersion: number; afterVersion: number }
export interface CmsCatalog { tiers: CmsTier[]; courses: CmsCourse[]; audit: CmsAudit[] }
export type CmsMutation =
  | { action: 'save-tier'; targetId: string; version: number; value: Omit<CmsTier, 'membershipTierId' | 'version'>; reason: string; idempotencyKey: string }
  | { action: 'save-course'; targetId: string; version: number; value: CmsCourseDraft; reason: string; idempotencyKey: string }
  | { action: 'publish' | 'offline'; targetId: string; version: number; reason: string; idempotencyKey: string }
export interface CmsAsset { assetId: string; url: string; previewUrl: string; kind: 'image' | 'video'; mockOnly: boolean }
export class CmsError extends Error {
  constructor(public code: 'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_STATE', message: string) { super(message); this.name = 'CmsError' }
}
