from pathlib import Path
p = Path(r"E:\project\react-web\naoshang-front-react\src\services\mock\withdrawals.ts")
t = p.read_text(encoding="utf-8")
t2 = t.replace("const STORAGE_KEY = 'ns_hq_withdrawals_v1'", "const STORAGE_KEY = 'ns_hq_withdrawals_v2_yuan'")
t2 = t2.replace("const AUDIT_KEY = 'ns_hq_withdrawals_audit_v1'", "const AUDIT_KEY = 'ns_hq_withdrawals_audit_v2_yuan'")
t2 = t2.replace("const IDEM_KEY = 'ns_hq_withdrawals_idem_v1'", "const IDEM_KEY = 'ns_hq_withdrawals_idem_v2_yuan'")
if t2 == t:
    print("storage keys already bumped or missing")
else:
    p.write_text(t2, encoding="utf-8")
    print("bumped mock storage keys for yuan seed")
