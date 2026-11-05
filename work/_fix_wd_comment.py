from pathlib import Path
p = Path(r"E:\project\react-web\naoshang-front-react\src\services\real\withdrawals.ts")
t = p.read_text(encoding="utf-8")
# fix possible mojibake / special char in comment
import re
t2 = re.sub(
    r"/\*\* HQ 提现接口金额单位为元（非分）；原样解析，不做分.*?元换算。 \*/",
    "/** HQ 提现接口金额单位为元（非分）；原样解析，不做分到元换算。 */",
    t,
    count=1,
)
if t2 == t:
    # try exact broken forms
    for old in [
        "/** HQ 提现接口金额单位为元（非分）；原样解析，不做分↔元换算。 */",
        "/** HQ 提现接口金额单位为元（非分）；原样解析，不做分?元换算。 */",
    ]:
        if old in t:
            t2 = t.replace(old, "/** HQ 提现接口金额单位为元（非分）；原样解析，不做分到元换算。 */", 1)
            break
p.write_text(t2, encoding="utf-8")
print("comment fixed" if t2 != t else "no comment change needed / check manually")
line = [ln for ln in t2.splitlines() if "moneyAmount" in ln or "提现接口金额" in ln][:3]
print("\n".join(line))
