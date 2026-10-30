# -*- coding: utf-8 -*-
from pathlib import Path
uni = Path(r"E:\project\uni\naoshang-partner")
# find upload / audit related in mini program
hits = []
for p in uni.rglob('*'):
    if p.suffix.lower() not in {'.js','.ts','.vue','.md'} : continue
    if 'node_modules' in p.parts or 'unpackage' in p.parts or 'dist' in p.parts: continue
    try:
        t = p.read_text(encoding='utf-8', errors='ignore')
    except: continue
    low = t.lower()
    if any(k in t for k in ['upload', '上传', 'audit', '审计', '操作日志', 'trace', 'resource']) or 'getUpload' in t:
        # score
        score = sum(t.count(k) for k in ['uploadContract','upload','审计','操作追溯','通用资源'])
        if score or 'upload' in p.name.lower() or 'audit' in p.name.lower():
            hits.append((score, str(p.relative_to(uni)), p.name))
hits.sort(reverse=True)
print('top files:')
for s,p,n in hits[:40]:
    print(s, p)
