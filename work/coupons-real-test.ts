import { describe, expect, it } from 'vitest'
import { mapCouponAudit, mapCouponCatalog, mapCouponDetail, mapCouponScope, mapCouponTemplate, mapUserCoupon } from './coupons'

describe('real coupons mapCouponScope', () => {
  it('defaults missing productIds to empty array for all/products', () => {
    expect(mapCouponScope({})).toEqual({ kind: 'all', productIds: [] })
    expect(mapCouponScope({ kind: 'products' })).toEqual({ kind: 'products', productIds: [] })
    expect(() => mapCouponScope({ kind: 'products' }).productIds.map((id) => id)).not.toThrow()
  })

  it('reads product object lists', () => {
    expect(mapCouponScope({ kind: 'products', products: [{ productId: 'p1' }, 'p2'] }).productIds).toEqual(['p1', 'p2'])
  })
})

describe('real coupons catalog/list/detail mappers', () => {
  it('fills catalog arrays so Coupons page never crashes on .map', () => {
    const catalog = mapCouponCatalog({})
    expect(catalog.templates).toEqual([])
    expect(catalog.audit).toEqual([])
    expect(catalog.accounts).toEqual([])
    expect(catalog.products).toEqual([])
    expect(catalog.limits.maxBatchSize).toBe(50)
    expect(() => catalog.templates.map((row) => row.templateId)).not.toThrow()
    expect(() => catalog.accounts.map((row) => row.accountId)).not.toThrow()
  })

  it('normalizes sparse template scope and aliases', () => {
    const template = mapCouponTemplate({
      id: 't-1',
      name: '满减券',
      faceAmount: 500,
      thresholdAmount: 10000,
      scopeKind: 'products',
      productIds: undefined,
      startAt: '2026-01-01T00:00:00+08:00',
      endAt: '2027-01-01T00:00:00+08:00',
      issued: 3,
      quota: 100,
    })
    expect(template.templateId).toBe('t-1')
    expect(template.title).toBe('满减券')
    expect(template.scope).toEqual({ kind: 'products', productIds: [] })
    expect(template.issuedQuantity).toBe(3)
    expect(template.totalQuantity).toBe(100)
    expect(() => template.scope.productIds.map((id) => id)).not.toThrow()
  })

  it('maps user coupon snapshot scope and detail audit defaults', () => {
    const coupon = mapUserCoupon({ id: 'c-1', title: '演示券', status: 'AVAILABLE' })
    expect(coupon.couponId).toBe('c-1')
    expect(coupon.snapshot.scope.productIds).toEqual([])
    expect(() => coupon.snapshot.scope.productIds.map((id) => id)).not.toThrow()

    const detail = mapCouponDetail({ id: 'c-2', title: '券' })
    expect(detail.coupon.couponId).toBe('c-2')
    expect(detail.audit).toEqual([])
    expect(() => detail.audit.map((row) => row.operationId)).not.toThrow()

    const audit = mapCouponAudit({ id: 'op-1', codes: [{ couponId: 'c-1' }, 'c-2'], action: 'ISSUE' })
    expect(audit.couponIds).toEqual(['c-1', 'c-2'])
    expect(audit.action).toBe('issue')
  })

  it('aliases users/products into catalog options', () => {
    const catalog = mapCouponCatalog({
      templates: [{ templateId: 't-9', title: 'A', scope: { kind: 'all' } }],
      users: [{ id: 'a-1', nickname: '家长', mobile: '13900001001' }],
      productOptions: [{ id: 'p-1', name: '记忆卡' }],
      operations: [{ id: 'op-9', action: 'save-template', templateId: 't-9' }],
    })
    expect(catalog.templates[0].scope.productIds).toEqual([])
    expect(catalog.accounts[0]).toMatchObject({ accountId: 'a-1', nickname: '家长', phone: '13900001001' })
    expect(catalog.products[0]).toMatchObject({ productId: 'p-1', title: '记忆卡' })
    expect(catalog.audit[0]).toMatchObject({ operationId: 'op-9', action: 'save-template', templateId: 't-9' })
  })
})
