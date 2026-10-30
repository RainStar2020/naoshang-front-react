import type { RichContent } from './cms'
export const announcementRoles = ['parent', 'coach', 'partner', 'agency', 'costore'] as const
export type AnnouncementRole = typeof announcementRoles[number]
export interface AnnouncementDraft { id: string; title: string; summary: string; content: RichContent; coverUrl: string; pinned: boolean; audience: AnnouncementRole[]; publishAt: string | null }
export interface AnnouncementPublication { revision: number; publishedAt: string; value: AnnouncementDraft }
export interface ManagedAnnouncement { draft: AnnouncementDraft; version: number; status: 'draft' | 'scheduled' | 'published' | 'offline'; publication: AnnouncementPublication | null }
export interface AnnouncementRead { accountId: string; announcementId: string; firstReadAt: string }
export interface AnnouncementRecipient { accountId: string; nickname: string; phone: string; roles: AnnouncementRole[]; firstReadAt: string | null }
export interface AnnouncementStats { targetCount: number; readCount: number; unreadCount: number; available: boolean; recipients: AnnouncementRecipient[] }
export interface AnnouncementAudit { id: string; announcementId: string; action: 'save' | 'publish' | 'offline'; reason: string; operatorName: string; requestId: string; occurredAt: string; beforeVersion: number; afterVersion: number }
export interface AnnouncementCatalog { items: ManagedAnnouncement[]; audit: AnnouncementAudit[] }
export type AnnouncementMutation = { id: string; version: number; reason: string; idempotencyKey: string } & ({ action: 'save'; value: AnnouncementDraft } | { action: 'publish' | 'offline' })
export class AnnouncementError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) { super(message); this.name = 'AnnouncementError' } }

