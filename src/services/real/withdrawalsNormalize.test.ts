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
  expect(detail.application.amount).toBe(10050)
  expect(Array.isArray(detail.audit)).toBe(true)
  expect(detail.balanceNote.length).toBeGreaterThan(0)
  expect(detail.application.allowedActions).toEqual(["approve", "reject"])
})
