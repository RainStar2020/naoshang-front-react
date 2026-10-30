from pathlib import Path
path = Path(r"E:\project\react-web\naoshang-front-react\src\services\real\coupons.ts")
text = path.read_text(encoding="utf-8")
old = "    operationId: str(r.operationId || r.id || r.requestId || op-),"
new = "    operationId: str(r.operationId || r.id || r.requestId || ('op-' + String(Date.now()))),"
if old not in text:
    raise SystemExit("old line not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print("fixed")
for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
    if "operationId" in line and "op-" in line:
        print(i, line)
