from pathlib import Path
text = Path(r"E:\project\react-web\naoshang-front-react\src\services\real\coupons.ts").read_text(encoding="utf-8")
# show any suspicious bare identifiers after ||
import re
for i, line in enumerate(text.splitlines(), 1):
    if "|| op" in line or "`" in line or "op-)," in line:
        print(i, repr(line))
print("--- auth mode ---")
print(Path(r"E:\project\react-web\naoshang-front-react\.env.development").read_text(encoding="utf-8"))
print("--- vitest config ---")
for name in ["vitest.config.ts", "vite.config.ts"]:
    p = Path(r"E:\project\react-web\naoshang-front-react") / name
    if p.exists():
        t = p.read_text(encoding="utf-8")
        if "VITE_HQ" in t or "env" in t.lower() or "test" in t[:200].lower():
            print(name, "exists", len(t))
