# -*- coding: utf-8 -*-
from pathlib import Path
# search API docs for assets/upload
docs = Path(r"E:\project\uni\naoshang-partner\docs")
for p in docs.rglob('*.md'):
    t = p.read_text(encoding='utf-8', errors='ignore')
    if 'upload-intent' in t or '/assets/' in t or '操作审计' in t or '统一审计' in t:
        print('FILE', p)
        for kw in ['upload-intent', '/assets/', 'assetId', '操作审计', '统一审计', 'completions']:
            i = 0
            c = 0
            while c < 3:
                j = t.find(kw, i)
                if j < 0: break
                print(f'  {kw}@{j}:', t[max(0,j-80):j+200].replace('\n',' | ')[:280])
                i = j+len(kw); c += 1
        print()
