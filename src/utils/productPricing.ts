/** 商品金额：Mock/类型层用整数分；界面层用元（两位小数）。勿把界面元直接写入真 API 契约。 */

export function yuanFromFen(fen: number): number {
  return Number((fen / 100).toFixed(2))
}

export function fenFromYuan(yuan: number): number {
  return Math.round(Number(yuan) * 100)
}

export function formatYuanFromFen(fen: number): string {
  return yuanFromFen(fen).toFixed(2)
}

/** 盈利（分）= 售价（分）- 成本价（分） */
export function profitFen(saleFen: number, costFen: number): number {
  return saleFen - costFen
}

export function formatProfitYuan(saleFen: number, costFen: number): string {
  return formatYuanFromFen(profitFen(saleFen, costFen))
}

export function isSaleBelowCost(saleFen: number, costFen: number): boolean {
  return saleFen < costFen
}