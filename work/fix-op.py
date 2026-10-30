from pathlib import Path
path = Path(r"E:\project\react-web\naoshang-front-react\src\services\real\coupons.ts")
text = path.read_text(encoding="utf-8")
for i, line in enumerate(text.splitlines(), 1):
    if "operationId" in line:
        print(i, repr(line))
