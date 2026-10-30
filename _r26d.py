# -*- coding: utf-8 -*-
from pathlib import Path
root = Path(r"E:\project\react-web\naoshang-front-react\src")
# sample existing audit shapes in mocks
for p in sorted((root/'services/mock').glob('*.ts')):
    t = p.read_text(encoding='utf-8')
    if 'Audit' in t or 'audit' in t or 'pushAudit' in t:
        # extract interface-ish lines from types
        print(f'--- mock {p.name} has audit ---')
# types with Audit
for p in sorted((root/'types').glob('*.ts')):
    t = p.read_text(encoding='utf-8')
    if 'Audit' in t:
        print(f'\n===== types/{p.name} =====')
        for line in t.splitlines():
            if 'Audit' in line or 'operationId' in line or 'requestId' in line or 'operator' in line:
                print(line)
