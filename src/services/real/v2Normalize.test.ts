import { describe, expect, it } from 'vitest'
import { mapManagedAnnouncement, mapAnnouncementCatalog, mapAnnouncementStats } from './announcements'
import { mapStoreProfile, mapStoreCatalog, mapStoreDetail } from './stores'
import { mapSoftwareCard, mapSoftwareCatalog } from './softwareCards'
import { mapPromoTemplate, mapPromoCatalog, mapPromoDetail } from './promo-materials'
import { asPage, stringList } from './bridge'

describe('v2 real adapters defensive defaults', () => {
  it('stores: regionNames/regionCodes always arrays', () => {
    const store = mapStoreProfile({ id: 's1', name: '梧桐街店', status: 'OPEN' })
    expect(store.regionNames).toEqual(['', '', ''])
    expect(store.regionCodes).toEqual(['', '', ''])
    expect(() => store.regionNames.join(' / ')).not.toThrow()
    const catalog = mapStoreCatalog({})
    expect(Array.isArray(catalog.regionOptions)).toBe(true)
    expect(Array.isArray(catalog.audit)).toBe(true)
    const detail = mapStoreDetail({ id: 's1' })
    expect(detail.store.regionNames).toEqual(['', '', ''])
    expect(Array.isArray(detail.coaches)).toBe(true)
    expect(Array.isArray(detail.staff)).toBe(true)
    expect(Array.isArray(detail.audit)).toBe(true)
  })

  it('announcements: audience/roles always arrays', () => {
    const row = mapManagedAnnouncement({ id: 'a1', title: '公告' })
    expect(Array.isArray(row.draft.audience)).toBe(true)
    expect(() => row.draft.audience.map((x) => x).join('、')).not.toThrow()
    const catalog = mapAnnouncementCatalog({}, [{ id: 'a1' }])
    expect(Array.isArray(catalog.items)).toBe(true)
    expect(Array.isArray(catalog.audit)).toBe(true)
    const stats = mapAnnouncementStats({ recipients: [{ accountId: 'u1', nickname: 'n', phone: '1' }] })
    expect(Array.isArray(stats.recipients)).toBe(true)
    expect(Array.isArray(stats.recipients[0].roles)).toBe(true)
  })

  it('software cards: options.stores/accounts always arrays', () => {
    const card = mapSoftwareCard({ id: 'c1' })
    expect(typeof card.cardId).toBe('string')
    expect(card.cardId).toBe('c1')
    const catalog = mapSoftwareCatalog({})
    expect(Array.isArray(catalog.types)).toBe(true)
    expect(Array.isArray(catalog.batches)).toBe(true)
    expect(Array.isArray(catalog.options.stores)).toBe(true)
    expect(Array.isArray(catalog.options.accounts)).toBe(true)
    expect(Array.isArray(catalog.options.orders)).toBe(true)
    expect(() => catalog.options.stores.map((s) => s.storeId)).not.toThrow()
  })

  it('promo materials: partnerOperations always array', () => {
    const tpl = mapPromoTemplate({ id: 't1', title: '物料' })
    expect(Array.isArray(tpl.partnerOperations)).toBe(true)
    expect(Array.isArray(tpl.allowedActions)).toBe(true)
    expect(() => tpl.partnerOperations.join(', ')).not.toThrow()
    const catalog = mapPromoCatalog({})
    expect(Array.isArray(catalog.categories)).toBe(true)
    expect(Array.isArray(catalog.types)).toBe(true)
    expect(catalog.pendingPolicy.clientSideComposeForbidden).toBe(true)
    const detail = mapPromoDetail({ id: 't1' })
    expect(Array.isArray(detail.template.partnerOperations)).toBe(true)
    expect(Array.isArray(detail.audit)).toBe(true)
  })

  it('asPage/stringList tolerate missing list fields', () => {
    expect(asPage({ list: [{ id: 1 }], pageNum: 2, pageSize: 10, total: 1 }).items).toHaveLength(1)
    expect(asPage({ items: null }).items).toEqual([])
    expect(asPage(null).items).toEqual([])
    expect(stringList(undefined)).toEqual([])
    expect(stringList(['a', null, 2])).toEqual(['a', '2'])
  })
})
