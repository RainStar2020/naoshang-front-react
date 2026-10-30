from pathlib import Path
path = Path(r"E:\project\react-web\naoshang-front-react\src\services\real\coupons.ts")
text = path.read_text(encoding="utf-8")
old = """function productIdList(value: unknown): string[] {
  const direct = stringList(value)
  if (direct.length) return direct
  return arr(value).map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return str(item)
    const row = record(item)
    return str(row.productId || row.id || row.skuId)
  }).filter(Boolean)
}"""
new = """function productIdList(value: unknown): string[] {
  return arr(value).map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return str(item)
    const row = record(item)
    return str(row.productId || row.id || row.skuId)
  }).filter(Boolean)
}"""
if old not in text:
    raise SystemExit("old productIdList not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print("fixed productIdList")
