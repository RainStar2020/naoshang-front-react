# HQ API 缺口关闭对照（相对 hq-api-doc.md）

日期：2026-11-03。依据：`docs/hq-api-doc.md`（132 端点 / 30 模块）。

## 本轮新补（types + api + registry，并接到 real 页面层）

| 模块 | 路径前缀 | 端点数 | real / 页面 |
|---|---|---|---|
| agents | `/agents` | 6（含 commission） | LiveModule；区域代理详情会尝试拉佣金快照 |
| regionAgents | `/region-agents` | 4 | `/#/agents` 页面 real 已接（原 unsupported） |
| assets | `/assets` | 2 | `real/assets.ts`；商品/课程 CMS 上传改走此口 |
| redemptions | `/redemptions` | 3 | LiveModule |
| support 缺口 | feedback / entry-config / agreements | +5 | support 页 feedback/协议/入口配置改真调用 |
| course cms | `/course/cms/*` | +2 | CourseCms real |
| delivery policies | `/delivery/policies/:productId/mutate` | +1 | Delivery save-policy |
| products 字典 | categories / types mutate | +2 | Products save-category / rename-type |
| software-cards | exports / settings | +3 | export 改真调用 |
| auth password | 已有 api，补强类型 + realAuth.changePassword | 1 | `changeHqPassword` |

Registry 现约：30 模块 / GET 94 / POST 52。

## 仍缺或仍非完整（勿承诺可联调）

- 文档未列但页面需要的动作：users reset-password / change-display-id、feedback 独立 mutate（现用 tickets mutate 兜底）。
- 部分列表页额外的 `GET /resource`（非 catalog）与文档不完全一致处，保留兼容、未删除。
- 金额单位（元 vs 分）未在本轮改契约；mapper 仍按模块既有约定。

## 联测建议

1. `VITE_HQ_AUTH_MODE=api`，硬刷新（Ctrl+Shift+R）。
2. LiveModule 页分别点 agents / region-agents / redemptions / assets / support 新操作。
3. `/#/agents`：目录、停用/恢复、辖区独占。
4. `/#/support`：协议发布、入口配置、反馈列表。
5. 商品分类/履约改名、交付策略、课程 CMS 保存、软件卡导出。
