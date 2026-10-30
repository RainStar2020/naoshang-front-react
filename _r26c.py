# -*- coding: utf-8 -*-
from pathlib import Path
map_path = Path(r"E:\project\uni\naoshang-partner\docs\总部后台功能需求与小程序页面映射.md")
text = map_path.read_text(encoding='utf-8')
# find section about 通用上传
for kw in ['通用上传资源与操作追溯', '操作追溯支撑', '统一审计', '上传契约', 'HQ-26']:
    i = text.find(kw)
    if i>=0:
        print(f'\n==== {kw} @{i} ====')
        print(text[max(0,i-300):i+1200])
        print('----')

uni = Path(r"E:\project\uni\naoshang-partner\src")
for rel in ['services/upload-contract.js','services/contracts/index.js','services/contracts/endpoints.js','services/contracts/types.d.ts','services/training-assets.js']:
    p = uni/rel
    if p.exists():
        print(f'\n##### {rel} #####')
        print(p.read_text(encoding='utf-8')[:3500])
