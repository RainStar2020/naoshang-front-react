import { expect, it } from "vitest"
import { mapWithdrawalCatalog, mapWithdrawalDetail } from "./withdrawals"

it("mapWithdrawalCatalog fills pendingPolicy and arrays when API omits them", () => {
  const catalog = mapWithdrawalCatalog({})
  expect(catalog.pendingPolicy.note.length).toBeGreaterThan(0)
  expect(catalog.pendingPolicy.minAmountPending).toBe(true)
  expect(catalog.pendingPolicy.feePolicyPending).toBe(true)
  expect(catalog.pendingPolicy.autoPayoutPending).toBe(true)
  expect(catalog.modules.length).toBeGreaterThan(0)
  expect(catalog.statuses.length).toBeGreaterThan(0)
  expect(Array.isArray(catalog.audit)).toBe(true)
  expect(catalog.payoutGapNote.length).toBeGreaterThan(0)
  expect(catalog.mockOnly).toBe(false)
})

it("mapWithdrawalDetail fills audit/notes when nested application is flat", () => {
  const detail = mapWithdrawalDetail({ id: "wd-1", amount: 100.5, status: "PENDING_REVIEW" })
  expect(detail.application.withdrawalId).toBe("wd-1")
  expect(detail.application.amount).toBe(100.5)
  expect(Array.isArray(detail.audit)).toBe(true)
  expect(detail.balanceNote.length).toBeGreaterThan(0)
  expect(detail.application.allowedActions).toEqual(["approve", "reject"])
})

it("mapWithdrawalApplication keeps API yuan amounts as-is (no /100 or *100)", async () => {
  const { mapWithdrawalApplication } = await import("./withdrawals")
  const row = mapWithdrawalApplication({
    id: "wd-api-1",
    redemptionNo: "RN-API-1",
    accountId: "p1",
    amount: 1000,
    netAmount: 1000,
    fee: 0,
    status: "PENDING_REVIEW",
    createdAt: "2024-11-05T01:45:19.129Z",
  })
  expect(row.amount).toBe(1000)
  expect(row.netAmount).toBe(1000)
  expect(row.fee).toBe(0)
  expect(row.accountId).toBe("p1")
  expect(row.redemptionNo).toBe("RN-API-1")
  expect(row.withdrawalId).toBe("wd-api-1")
})

it("mapWithdrawalApplication falls back redemptionNo to empty when API omits it", async () => {
  const { mapWithdrawalApplication } = await import("./withdrawals")
  const row = mapWithdrawalApplication({ id: "wd-2", amount: 1, status: "PENDING_REVIEW" })
  expect(row.redemptionNo).toBe("")
  expect(row.withdrawalId).toBe("wd-2")
})
