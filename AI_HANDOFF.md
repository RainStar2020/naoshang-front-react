# naoshang-front-react 开发交接

> 2026-10-28 补充：默认真实模式已改为 `src/pages/LiveModule.tsx` + `src/services/real/registry.ts`，覆盖 25 个业务模块、账号设置及 120 个 API 绑定。旧页面仅用于显式 mock 模式。真实业务字段尚不完整，写操作提供 JSON 参数、原因/版本/幂等号及二次核对。空数据接口和后端已知问题见根 README；用户要求本阶段跳过后续真实联调。以下原 Mock 交接记录仅作为历史参考。

> 更新时间：2026-10-28  
> 当前阶段：总部 React 后台的 Mock 功能开发，已完成 HQ-01 至 HQ-26（映射文档全部条目的前端 Mock 覆盖）。下一模块需另开需求/联调（真实 API、统一审计流等）。

## 1. 项目与运行方式

- 项目目录：`E:\project\react-web\naoshang-front-react`
- 小程序源码目录：`E:\project\uni\naoshang-partner`
- 需求与小程序页面映射：`E:\project\uni\naoshang-partner\docs\总部后台功能需求与小程序页面映射.md`
- 技术栈：React 18 + TypeScript + Hooks + Ant Design + Vite + Vitest。
- 常用命令：

  ```powershell
  npm run dev
  npm test
  npm run build
  ```

- 最近验证结果：`npm test` 为 **26 个测试文件、468 项测试通过**；`npm run build`（`tsc && vite build`）通过。
- 当前目录不是 Git 仓库，无法依赖分支差异、提交记录或 PR 做追溯；继续开发前请先确认是否需要初始化版本管理。

## 2. 总体实现约定

1. 一个总部模块通常包含四层：
   - `src/types/<module>.ts`：领域接口、枚举、错误类型；
   - `src/services/<module>.ts`：组件唯一调用入口，做会话和权限校验；
   - `src/services/mock/<module>.ts`：内存 Mock、状态机、版本锁、幂等与审计；
   - `src/pages/<Module>.tsx`：Ant Design 后台页面。
2. 写操作统一要求：权限、操作原因、二次确认、版本号、幂等请求号和审计记录。组件不得绕过 `src/services` 直接改 Mock 数据。
3. 数据仍是内存 Mock，整页刷新会恢复初始状态；所有“成功”仅代表 Mock 行为，不代表真实支付、签约、权益、物流或资金结果。
4. 金额统一以整数“分”在服务/类型层存储，页面展示时再转“元”。
5. 菜单访问由 `src/auth/access.ts` 控制（`adminNavGroups` 一级分组 + 二级菜单；扁平 `adminModules` 仍用于回跳；无可见子项的分组不显示）；演示账号在 `src/services/mock/auth.ts`；路由按需加载配置在 `src/App.tsx`；登录页账号说明在 `src/pages/Login.tsx`。
6. 富文本统一使用 `src/utils/richContent.ts` 的结构化 `RichContent`，不要直接把 HTML 当作可信内容渲染。

## 3. 已完成模块清单

| 编号 | 模块 | 入口 | 主要页面/服务 |
| --- | --- | --- | --- |
| HQ-01 | 登录与总部会话 | `/#/login` | `Login.tsx`、`services/auth.ts` |
| HQ-02 | 用户账号管理 | `/#/users` | `Users.tsx`、`services/users.ts` |
| HQ-03 | 孩子会员档案 | `/#/members` | `Members.tsx`、`services/members.ts` |
| HQ-04 | 课程与会员等级 | `/#/course` | `CourseCms.tsx`、`services/cms.ts` |
| HQ-05 | 会员/专栏激活码 | `/#/activation-codes` | `ActivationCodes.tsx` |
| HQ-06 | 软件卡发码 | `/#/software-cards` | `SoftwareCards.tsx` |
| HQ-07 | 专栏与学习记录 | `/#/columns` | `Columns.tsx` |
| HQ-08 | 公告与已读统计 | `/#/announcements` | `Announcements.tsx` |
| HQ-09 | 商品分类与 SKU | `/#/products` | `Products.tsx` |
| HQ-10 | 交付配置与调整 | `/#/delivery` | `Delivery.tsx` |
| HQ-11 | 订单查询与履约 | `/#/orders` | `Orders.tsx` |
| HQ-12 | 优惠券 | `/#/coupons` | `Coupons.tsx` |
| HQ-13 | 支付渠道、查单、对账与异常补单 | `/#/payments` | `Payments.tsx` |
| HQ-14 | 合伙人等级、年度权益与晋升任务 | `/#/partners` | `Partners.tsx` |
| HQ-15 | VIP 名额批次、流水与总部充值 | `/#/quotas` | `Quotas.tsx` |
| HQ-16 | 邀请关系与团队追溯 | `/#/invitations` | `Invitations.tsx` |
| HQ-17 | 合店方案、申请监管与拒审退款 | `/#/costore` | `Costore.tsx` |
| HQ-18 | 员工、门店角色与权限配置 | `/#/staff-roles` | `StaffRoles.tsx`、`services/staff.ts` |
| HQ-19 | 门店主档与健脑官账号监管 | `/#/stores` | `Stores.tsx`、`services/stores.ts` |
| HQ-20 | 训练反馈与课时核销 | `/#/training` | `Training.tsx`、`services/training.ts` |
| HQ-21 | 转店双边审核监管 | `/#/transfers` | `Transfers.tsx`、`services/transfers.ts` |
| HQ-22 | 收益结算与冲正 | `/#/revenue` | `Revenue.tsx`、`services/income.ts` |
| HQ-23 | 提现审核与打款回执 | `/#/withdrawals` | `Withdrawals.tsx`、`services/withdrawals.ts` |
| HQ-24 | 推广素材与二维码模板 | `/#/materials` | `Materials.tsx`、`services/promo-materials.ts` |
| HQ-25 | 协议与客服预留 | `/#/support` | `Support.tsx`、`services/support.ts` |
| HQ-26 | 通用资源与操作追溯 | `/#/trace` | `Trace.tsx`、`services/trace.ts` |

旧版 demo 页面如 `Agents.tsx` 等仍保留在菜单中；`Materials.tsx` 已由 HQ-24 替换为推广素材模板。后续改造必须先对照映射文档和小程序实际业务，不应将演示字段直接当作生产接口契约。

## 4. 最近完成：HQ-26 通用资源、任务与操作追溯

### 已实现
- 四层 Mock：`types/trace` → `services/trace` → `mock/trace` → `pages/Trace`。
- 上传资源：`assetId === fileId`；状态 PENDING/READY/FAILED/QUARANTINED；仅 READY 可隔离，QUARANTINED 可恢复。
- 异步任务：对齐 `/jobs/{id}` 概念；仅 FAILED 可重试（Mock 置 PROCESSING）。
- 统一审计：`AGGREGATED_MOCK` 独立种子，不改写其他模块存储；本模块写操作也会追加审计。
- 权限：`trace:access` / `trace:manage`；演示账号 `hq-trace-viewer`、`hq-trace-manager`。
- 写操作：原因、二次确认、版本、幂等、审计。

### 关键文件
- `src/types/trace.ts`
- `src/services/trace.ts`、`src/services/mock/trace.ts`、`src/services/trace.test.ts`
- `src/pages/Trace.tsx`
- 接线：`types/auth.ts`、`auth/access.ts`、`services/mock/auth.ts`、`App.tsx`、`Login.tsx`

### 明确未实现
- 真实 CDN 签名与私有读、真实上传字节、真实任务执行器、跨模块审计实时汇聚、工单系统。

### 验证
- 新增 6 项 `trace.test.ts`；全项目 **26 文件 / 468 项通过**；`npm run build`（tsc && vite build）通过。

### 上一模块摘要（HQ-25）
- 协议版本 + 客服配置 + 反馈标记；完整客服工单为缺口。

## 5. 跨模块注意事项


- HQ-10/HQ-11/HQ-13 中的交付、订单和支付均是独立 Mock 或有限共享契约；不要因“页面已有订单”而直接假设它与其他模块真实同步。
- HQ-14 合伙人档案、HQ-15 名额、HQ-16 邀请关系已有少量 Mock 共享；改动共享字段前必须运行全量测试，特别注意关系版本与名额资格。
- 对于支付、退款、合同、权益、优惠核销、订单履约、**转店归属迁移**等强一致业务，后台只能展示服务端回执和提交受控操作，不能由前端推导或篡改最终状态。
- 文档 `README.md` 已按 HQ-01～HQ-26 记录了逐模块设计边界和验证结果；映射条目前端 Mock 已覆盖完毕。
- HQ-19 健脑官监管与 HQ-18 staff Mock 共用；HQ-20 课时与 HQ-03 学员种子对齐；HQ-21 转店种子对齐门店/学员；HQ-22 收益为独立 Mock（不写可提现）；HQ-23 提现不改余额、只读关联收益流水 id；改共享账户 ID 时须回归。

## 6. 映射覆盖状态与建议下一步

- **映射文档 HQ-01～HQ-26：前端 Mock 已全部落地**（含 HQ-26 统一审计聚合台说明）。
- 建议下一步（需另开需求，非本映射遗留条目）：
  1. 真实总部 API / 会话接入与 401/403 统一处理；
  2. 统一审计流由后端供数（替换 AGGREGATED_MOCK）；
  3. 真实上传（CDN 签名、completions）与任务执行器联调；
  4. 初始化 Git 版本管理（当前目录非仓库）。

## 7. 交接给新 AI 的工作提示

可以直接使用以下任务描述作为新会话的首条请求：

```text
请先阅读 E:\project\react-web\naoshang-front-react\AI_HANDOFF.md、README.md，
以及 E:\project\uni\naoshang-partner\docs\总部后台功能需求与小程序页面映射.md。
当前 React 后台已完成 HQ-01 至 HQ-26（映射文档条目的前端 Mock 覆盖完毕）；请先跑 npm test 确认当前基数。
请不要重构已完成模块。下一工作需另开需求（真实 API / 统一审计流 / CDN 上传联调等），勿把演示字段当作生产契约。
所有写操作都必须有权限校验、原因、二次确认、版本/幂等控制与审计；不可伪造真实支付、合同、权益或资金状态。
```
