from pathlib import Path
path = Path(r"E:\project\react-web\naoshang-front-react\src\pages\Coupons.tsx")
text = path.read_text(encoding="utf-8")
replacements = [
  ("value.productIds.map(id => catalog?.products.find", "(value.productIds ?? []).map(id => (catalog?.products ?? []).find"),
  ("options={catalog.products.map(row =>", "options={(catalog.products ?? []).map(row =>"),
  ("dataSource={catalog?.templates}", "dataSource={catalog?.templates ?? []}"),
  ("options={catalog?.templates.map(row =>", "options={(catalog?.templates ?? []).map(row =>"),
  ("options={catalog?.accounts.map(row =>", "options={(catalog?.accounts ?? []).map(row =>"),
  ("dataSource={catalog?.audit}", "dataSource={catalog?.audit ?? []}"),
  ("options={catalog.accounts.map(row =>", "options={(catalog.accounts ?? []).map(row =>"),
  ("detail.coupon.snapshot.scope.productIds.join", "(detail.coupon.snapshot.scope.productIds ?? []).join"),
  ("{detail.audit.map(row =>", "{(detail.audit ?? []).map(row =>"),
  ("catalog?.accounts.find(account =>", "(catalog?.accounts ?? []).find(account =>"),
  ("catalog?.templates.find(row =>", "(catalog?.templates ?? []).find(row =>"),
  ("catalog?.accounts.find(row =>", "(catalog?.accounts ?? []).find(row =>"),
]
for old, new in replacements:
    count = text.count(old)
    print(f"{count}: {old[:70]}")
    if count:
        text = text.replace(old, new)
path.write_text(text, encoding="utf-8", newline="\n")
print("patched", path.stat().st_size)
