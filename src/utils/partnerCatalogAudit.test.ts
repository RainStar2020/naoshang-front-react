import { describe, expect, it } from 'vitest'
import { visiblePartnerCatalogAudit } from './partnerCatalogAudit'

describe('visiblePartnerCatalogAudit', () => {
  it('hides save-benefits (保存等级说明) and keeps other partner audit actions', () => {
    const rows = [
      { operationId: '1', action: 'save-benefits' as const },
      { operationId: '2', action: 'upgrade' as const },
      { operationId: '3', action: 'save-level-names' as const },
      { operationId: '4', action: 'task-promotion' as const },
      { operationId: '5', action: 'save-benefits' as const },
    ]
    expect(visiblePartnerCatalogAudit(rows).map((row) => row.operationId)).toEqual(['2', '3', '4'])
  })

  it('returns empty array for nullish input', () => {
    expect(visiblePartnerCatalogAudit(null)).toEqual([])
    expect(visiblePartnerCatalogAudit(undefined)).toEqual([])
  })
})
