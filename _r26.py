# -*- coding: utf-8 -*-
from pathlib import Path
root = Path(r"E:\project\react-web\naoshang-front-react")
map_path = Path(r"E:\project\uni\naoshang-partner\docs\总部后台功能需求与小程序页面映射.md")
text = map_path.read_text(encoding='utf-8')
# find HQ-26 and nearby audit/upload sections
idx = text.find('HQ-26')
print('=== HQ-26 context ===')
print(text[max(0,idx-200):idx+800])
print('\n=== 审计/上传/资源 keywords ===')
for kw in ['统一审计', '操作追溯', '通用资源', '上传', 'audit', '任务', 'HQ-26']:
    pos = 0
    c = 0
    while c < 5:
        i = text.find(kw, pos)
        if i < 0: break
        line_start = text.rfind('\n', 0, i) + 1
        line_end = text.find('\n', i)
        print(f'[{kw}@{i}] {text[line_start:line_end][:200]}')
        pos = i + len(kw)
        c += 1
print('\n=== handoff s6 ===')
h = (root/'AI_HANDOFF.md').read_text(encoding='utf-8')
i6 = h.find('## 6.')
print(h[i6:i6+900])
