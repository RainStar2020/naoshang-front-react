import type { PartnerAudit } from '../types/partners'

/** Catalog audit actions hidden from Partners「操作记录」(HQ/mock may still write them). */
export const HIDDEN_PARTNER_CATALOG_AUDIT_ACTIONS = new Set<PartnerAudit['action']>(['save-benefits'])

export function visiblePartnerCatalogAudit<T extends { action: PartnerAudit['action'] }>(
  rows: T[] | null | undefined,
): T[] {
  return (rows ?? []).filter((row) => !HIDDEN_PARTNER_CATALOG_AUDIT_ACTIONS.has(row.action))
}
