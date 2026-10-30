# 总部后台（HQ）后端 API 需求文档

> 文档版本：v1.0
> 适用范围：`naoshang-front-react` 总部后台（HQ-01～HQ-26）
> 契约来源：前端 `src/types/*.ts` + `src/services/*.ts`；库表对照以本机 MySQL `naoshang`（`_db_meta.json` / `_db_schema_summary.txt`）为准
> 金额约定（用户拍板）：统一使用「元」，`number`/`decimal`，保留到分（小数点后两位）。**不要**用分整数。每个金额字段注明单位「元」。
> 鉴权约定（用户拍板）：当前仅总部后台、仅 **admin** 会话；细粒度 `hqPermissions` 列为后续扩展，**不是**当前硬门槛。
> 与 C 端文档关系：本文仅覆盖总部后台；小程序/C 端见同目录 `后端API需求文档.md`（勿覆盖）。

---

## 1. 概述

### 1.1 范围

- 覆盖导航栏全部模块：登录 → 账号与会员 → 内容与运营 → 发码与权益 → 商品与交易 → 资金结算 → 门店运营 → 合伙体系 → 系统与支撑（HQ-01～HQ-26）。
- 部分模块（商品、公告、软件卡、优惠券模板等）**当前库无对应表**，仍按前端类型写出完整 API，并在模块首注明「当前库无对应表 / 落地待定」。
- 写操作统一对齐前端 mutate 习惯：`reason`、`idempotencyKey`、乐观锁 `version`、审计回执；当前权限一律要求 admin。

### 1.2 金额约定

| 项 | 约定 |
|---|---|
| 单位 | **元** |
| 精度 | 小数点后两位（分） |
| 类型 | JSON `number`；落库建议 `DECIMAL(18,2)` |
| 禁止 | 以「分」为单位的整数传参/回传（前端 mock 中曾用分，实现时统一换算为元） |
| 标注 | 下文每个金额字段均标注「单位：元」 |

### 1.3 鉴权约定

- 登录成功后颁发 Bearer Token（opaque 或 JWT 均可，需可服务端失效）。
- 除「登录」外，本文全部接口要求：`Authorization: Bearer <token>`，且会话主体为 **admin**。
- 前端类型中的 `hqPermissions` / `hasHqPermission` 可保留响应字段以便后续扩展，**当前不按权限码拦截**（有 admin 即可）。
- 401：未登录或 token 失效；403：非 admin（或后续细粒度拒绝）。

### 1.4 写操作统一约定

对齐前端各 `*Mutation`：

| 字段 | 位置 | 说明 |
|---|---|---|
| `reason` | body | 操作原因；多数写接口必填（前端强制），审计落库 |
| `idempotencyKey` | body 或 Header `Idempotency-Key` | 有则幂等；重复提交返回同一业务结果，冲突返回 `IDEMPOTENCY_CONFLICT` |
| `version` | body | 资源乐观锁；冲突返回 `VERSION_CONFLICT` |
| 审计 | 服务端 | 记录 operatorId/Name、before/after、requestId、occurredAt；列表接口可附带 audit |

建议：Header 与 body 同时支持幂等键时，以 Header 为准；body 仍可带同值便于前端透传。

---

## 2. 通用约定

### 2.1 Base Path

建议：`/api/hq`

示例：`POST /api/hq/auth/login`、`GET /api/hq/users`

### 2.2 统一响应信封

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| code | number | `0` 成功；非 0 失败（见错误码表） |
| message | string | 可读说明 |
| data | object / array / null | 业务数据 |

列表类 `data` 建议形态：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "summary": {}
}
```

`summary` 按模块可选。

### 2.3 分页

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| page | number | 1 | 从 1 起 |
| pageSize | number | 20 | 建议上限 100 |

### 2.4 请求 Header

| Header | 必填 | 说明 |
|---|---|---|
| Authorization | 除登录外必填 | `Bearer <token>` |
| Content-Type | 写接口 | `application/json` |
| Idempotency-Key | 写接口推荐 | 与 body.idempotencyKey 二选一或同值 |
| X-Reason | 可选 | 若 body 未带 reason，可用此头（优先 body） |
| X-Request-Id | 可选 | 客户端请求追踪；服务端可回显 |

### 2.5 通用错误码

| code | HTTP 建议 | 含义 | 对应前端 Error.code |
|---|---|---|---|
| 0 | 200 | 成功 | — |
| 40100 | 401 | 未登录 / token 无效 | FORBIDDEN / 未授权 |
| 40300 | 403 | 非 admin | FORBIDDEN |
| 40400 | 404 | 资源不存在 | NOT_FOUND |
| 40000 | 400 | 参数非法 | INVALID_INPUT |
| 40900 | 409 | 状态不允许 | INVALID_STATE |
| 40901 | 409 | 乐观锁冲突 | VERSION_CONFLICT |
| 40902 | 409 | 幂等键冲突（不同载荷） | IDEMPOTENCY_CONFLICT |
| 40903 | 409 | 配额不足等 | QUOTA_EXCEEDED |
| 50000 | 500 | 服务器错误 | — |

各模块可在 `message` 中补充业务文案；模块特有码可在 41xxx 段扩展。

### 2.6 ID 与时间

- ID：字符串（雪花/UUID），与前端 `accountId`、`memberId` 等命名对齐。
- 时间：ISO-8601 字符串（建议统一 UTC 并以 `Z` 结尾，或带显式偏移）；前端展示由客户端本地化。
- **敏感字段**：密码哈希、支付密钥、完整银行卡号等只写「写入/不回显」规则，文档中不给明文样例。

### 2.7 导航模块索引（写作顺序）

| 序号 | 导航 | 模块代号 | 路径前缀 |
|---|---|---|---|
| — | 登录 | HQ-01 | `/auth` |
| 1 | 账号管理 | HQ-02 | `/users` |
| 2 | 会员档案 | HQ-03 | `/members` |
| 3 | 课程权益 | HQ-04 | `/course` |
| 4 | 专栏内容 | HQ-05 | `/columns` |
| 5 | 公告 | HQ-06 | `/announcements` |
| 6 | 资料中心 | HQ-07 | `/materials` |
| 7 | 激活码 | HQ-08 | `/activation-codes` |
| 8 | 软件卡 | HQ-09 | `/software-cards` |
| 9 | 配额 | HQ-10 | `/quotas` |
| 10 | 商品 | HQ-11 | `/products` |
| 11 | 履约发货 | HQ-12 | `/delivery` |
| 12 | 订单 | HQ-13 | `/orders` |
| 13 | 优惠券 | HQ-14 | `/coupons` |
| 14 | 支付对账 | HQ-15 | `/payments` |
| 15 | 收益 | HQ-16 | `/revenue` |
| 16 | 提现 | HQ-17 | `/withdrawals` |
| 17 | 员工与角色 | HQ-18 | `/staff` |
| 18 | 门店 | HQ-19 | `/stores` |
| 19 | 培训课时 | HQ-20 | `/training` |
| 20 | 转店 | HQ-21 | `/transfers` |
| 21 | 合伙人 | HQ-22 | `/partners` |
| 22 | 邀请关系 | HQ-23 | `/invitations` |
| 23 | 共创店 | HQ-24 | `/costore` |
| 24 | 客服工单 | HQ-25 | `/support` |
| 25 | 追踪溯源 | HQ-26 | `/trace` |
| — | （遗留）代理商 | — | `/agents` 可选遗留说明 |

---

## 3. HQ-01 登录与会话（Auth）

### 3.1 模块说明

- 对应前端：`src/types/auth.ts`、`src/services/authService.ts`（及 access/session）。
- 对应库表：`admins`（后台管理员）、可选会话表（待建）；**不**使用 C 端 `users` 登录后台。
- 当前仅 admin：登录成功即具备全部 HQ 操作权限；`hqPermissions` 可回传空数组或全量列表供后续扩展。

### 3.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/hq/auth/login` | 管理员登录 |
| POST | `/api/hq/auth/logout` | 登出（失效 token） |
| GET | `/api/hq/auth/me` | 当前会话与管理员资料 |
| POST | `/api/hq/auth/password` | 修改当前管理员密码 |

### 3.3 POST `/api/hq/auth/login`

- **用途**：账号密码登录，返回 token 与管理员资料。
- **权限**：公开（无需 Bearer）。
- **映射**：`authService.login`
- **Body**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| username | string | 是 | 管理员用户名 |
| password | string | 是 | 密码（**敏感，仅传输不落日志明文**） |

- **响应 data**：

| 字段 | 类型 | 说明 |
|---|---|---|
| token | string | Bearer token |
| admin | object | 见下 |
| admin.adminId | string | 管理员 ID（对应 `admins.id`） |
| admin.username | string | 用户名 |
| admin.displayName | string | 展示名 |
| admin.role | string | 当前固定 `"admin"` |
| admin.hqPermissions | string[] | 后续扩展；当前可为空或全量 |
| expiresAt | string | token 过期时间 ISO |

- **错误**：用户名/密码错误 → 40100（文案勿区分「用户不存在」与「密码错误」以防枚举）；非 admin 账号 → 40300。

### 3.4 POST `/api/hq/auth/logout`

- **用途**：失效当前 token。
- **权限**：admin。
- **映射**：`authService.logout`
- **Body**：无（或空对象）。
- **响应 data**：`null` 或 `{ ok: true }`

### 3.5 GET `/api/hq/auth/me`

- **用途**：拉取当前管理员与权限快照。
- **权限**：admin。
- **映射**：`authService.getSession` / `me`
- **响应 data**：同登录的 `admin` 结构 + `tokenExpiresAt`（可选）。

### 3.6 POST `/api/hq/auth/password`

- **用途**：修改当前管理员密码。
- **权限**：admin。
- **Body**：`oldPassword`（string，敏感）、`newPassword`（string，敏感）、`reason`（string，可选）、`idempotencyKey`（string，可选）。
- **响应**：`{ ok: true }`；成功后可选择强制重新登录。
- **错误**：旧密码错误 → 40000；新密码不合策略 → 40000。
- **注意**：响应与审计中**不得**回显密码。

---

## 4. HQ-02 账号管理（Users）

### 4.1 模块说明

- 对应前端：`src/types/users.ts`、`src/services/usersService.ts`。
- 对应库表：`users`（主）、关联 `user_profiles` / 手机号等（以实际 schema 为准）；`accountId` ↔ `users.id`。
- 账号是平台登录主体；与 `memberId`（孩子/学员档案）分离。

### 4.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/users` | 账号分页列表 |
| GET | `/api/hq/users/{accountId}` | 账号详情 |
| POST | `/api/hq/users/{accountId}/mutate` | 账号写操作（冻结/解冻/备注等） |
| GET | `/api/hq/users/catalog` | 筛选项与汇总目录（可选） |

### 4.3 GET `/api/hq/users`

- **用途**：分页查询账号。
- **权限**：admin。
- **映射**：`usersService.list`
- **Query**：

| 字段 | 类型 | 说明 |
|---|---|---|
| page / pageSize | number | 分页 |
| keyword | string | 昵称/手机/displayId 模糊 |
| frozen | boolean | 是否冻结 |
| status | string | 若前端有状态枚举则透传 |

- **响应 data**：`UserList` 形态：`items: UserProfile[]`、`total`、`page`、`pageSize`、`summary`（如 total/frozen 计数）。
- **UserProfile 主要字段**（以前端类型为准，名称对齐）：

| 字段 | 类型 | 说明 |
|---|---|---|
| accountId | string | 账号 ID |
| displayId | string | 对外展示号 |
| nickname | string | 昵称 |
| phone | string | 手机（可脱敏中间四位，详情可完整） |
| frozen | boolean | 是否冻结 |
| createdAt | string | 注册时间 |
| lastLoginAt | string \| null | 最近登录 |
| version | number | 乐观锁 |
| allowedActions | string[] | 如 `freeze` / `unfreeze` / `update-note` |

### 4.4 GET `/api/hq/users/{accountId}`

- **用途**：账号详情（含审计摘要、关联会员数等）。
- **权限**：admin。
- **映射**：`usersService.getDetail`
- **响应**：`UserDetail`：`profile` + `members` 摘要 + `audit[]`。

### 4.5 POST `/api/hq/users/{accountId}/mutate`

- **用途**：统一写入口（对齐前端 Mutation 联合类型）。
- **权限**：admin。
- **映射**：`usersService.mutate`
- **Body 公共字段**：`action`、`version`、`reason`（必填）、`idempotencyKey`（必填）。
- **action 枚举（以前端为准，典型）**：

| action | 额外字段 | 说明 |
|---|---|---|
| freeze | — | 冻结账号 |
| unfreeze | — | 解冻 |
| update-note | note: string | 更新内部备注 |

- **响应**：更新后的 `UserProfile` 或 `{ profile, operationId }`。
- **错误**：`VERSION_CONFLICT` / `INVALID_STATE`（已冻结再冻）/ `NOT_FOUND`。

---

## 5. HQ-03 会员档案（Members）

### 5.1 模块说明

- 对应前端：`src/types/members.ts`、`src/services/membersService.ts`。
- 对应库表：`members`（或等价学员表）；`memberId` ↔ 表主键；归属 `accountId`、可选 `storeId`。
- 会员是「孩子/学员」维度，不等于登录账号。

### 5.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/members` | 会员分页列表 |
| GET | `/api/hq/members/{memberId}` | 会员详情 |
| POST | `/api/hq/members/{memberId}/mutate` | 会员写操作 |
| GET | `/api/hq/members/catalog` | 门店等筛选项 |

### 5.3 GET `/api/hq/members`

- **映射**：`membersService.list`
- **Query**：`page`、`pageSize`、`keyword`、`accountId`、`storeId`、`status`（若有）。
- **响应 items 主要字段**：`memberId`、`accountId`、`displayName`、`gender`、`birthday`、`storeId`/`storeName`、`status`、`version`、`allowedActions`。

### 5.4 GET `/api/hq/members/{memberId}`

- **映射**：`membersService.getDetail`
- **响应**：档案 + 课程权益摘要 + 培训余额摘要 + audit。

### 5.5 POST `/api/hq/members/{memberId}/mutate`

- **映射**：`membersService.mutate`
- **Body**：`action` + `version` + `reason` + `idempotencyKey` + action 载荷。
- 典型 action：`update-profile`（姓名/生日等）、`bind-store` / `unbind-store`、`set-status`（以前端 `MembersMutation` 为准）。
- **错误**：通用冲突码；跨店绑定需校验门店存在。

---

## 6. HQ-04 课程权益（Course）

### 6.1 模块说明

- 对应前端：`src/types/course.ts`、`src/services/courseService.ts`。
- 对应库表：课程/权益相关表（如 `course_entitlements`、订单履约产生的权益）；若命名不同以 schema 为准。
- 管理账号或会员维度的课程开通、延期、冻结等。

### 6.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/course/entitlements` | 权益分页列表 |
| GET | `/api/hq/course/entitlements/{entitlementId}` | 权益详情 |
| POST | `/api/hq/course/entitlements/{entitlementId}/mutate` | 权益写操作 |
| GET | `/api/hq/course/catalog` | 课程产品目录/筛选项 |

### 6.3 GET `/api/hq/course/entitlements`

- **映射**：`courseService.list`
- **Query**：`page`、`pageSize`、`keyword`、`accountId`、`memberId`、`status`、`productId`。
- **响应字段（典型）**：`entitlementId`、`accountId`、`memberId`、`productId`/`title`、`status`、`validFrom`、`validUntil`、`version`、`allowedActions`。

### 6.4 POST `/api/hq/course/entitlements/{entitlementId}/mutate`

- **映射**：`courseService.mutate`
- **Body 公共**：`action`、`version`、`reason`、`idempotencyKey`。
- 典型 action：`extend`（`validUntil`）、`freeze`/`unfreeze`、`revoke`（以前端为准）。
- **错误**：`INVALID_STATE`（已撤销不可延期等）。

## 7. HQ-05 专栏内容（Columns）

### 7.1 模块说明

- 对应前端：`src/types/columns.ts`、`src/types/cms.ts`、`src/services/columnsService.ts`。
- **当前库无对应表 / 落地待定**（CMS 草稿与发布表需新建）。
- 专栏归属账号维度（不使用 memberId）；章节 `accessibility` 固定语义 `column-required`。

### 7.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/columns/catalog` | 专栏目录、可绑商品、审计 |
| GET | `/api/hq/columns/{columnId}` | 单专栏草稿+发布态 |
| GET | `/api/hq/columns/{columnId}/records` | 购买/授权/学习进度 |
| POST | `/api/hq/columns/{columnId}/mutate` | save / publish / offline |
| POST | `/api/hq/columns/assets` | 上传素材（返回 CmsAsset） |
| POST | `/api/hq/columns/progress` | （可选）代写学习进度，对齐 ColumnProgressWrite |

### 7.3 GET `/api/hq/columns/catalog`

- **映射**：`columnsService.getCatalog`
- **响应 data (`ColumnCatalog`)**：
  - `columns: ManagedColumn[]`：`draft`（ColumnDraft）、`version`、`status`=`draft|published|offline`、`publication`
  - `products: { productId, title, fulfillmentType: "COLUMN_ACCESS" }[]`
  - `audit: ColumnAudit[]`
  - `accounts` 摘要可选
- **ColumnDraft**：`columnId`、`productId`、`title`、`summary`、`coverUrl`、`content: RichContent`、`chapters: ColumnChapter[]`

### 7.4 POST `/api/hq/columns/{columnId}/mutate`

- **映射**：`columnsService.mutate`
- **权限**：admin
- **Body**：`reason`、`idempotencyKey`、`columnId`、`version`，以及：
  - `action=save` + `value: ColumnDraft`
  - `action=publish` | `offline`
- **响应**：更新后的 `ManagedColumn` + `operationId`
- **错误**：`VERSION_CONFLICT`、`INVALID_STATE`（未发布不可下架等，按产品规则）

### 7.5 POST `/api/hq/columns/assets`

- **映射**：`columnsService.uploadAsset`
- **Content-Type**：`multipart/form-data`
- **响应**：`CmsAsset`（`assetId`、`url`、`mimeType`、`size` 等，以前端 cms 类型为准）

---

## 8. HQ-06 公告（Announcements）

### 8.1 模块说明

- 对应前端：`src/types/announcements.ts`、`src/services/announcementsService.ts`。
- **当前库无对应表 / 落地待定**。

### 8.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/announcements` | 公告分页列表 |
| GET | `/api/hq/announcements/{announcementId}` | 公告详情 |
| GET | `/api/hq/announcements/catalog` | 目录/审计 |
| POST | `/api/hq/announcements/mutate` | 创建/保存/发布/下线（新建时无 id 用 action=create） |
| POST | `/api/hq/announcements/{announcementId}/mutate` | 对已有公告 mutate |

### 8.3 数据字段（对齐前端）

| 字段 | 类型 | 说明 |
|---|---|---|
| announcementId | string | 主键 |
| title | string | 标题 |
| summary | string | 摘要 |
| content | RichContent | 正文 |
| status | string | draft / published / offline（以前端枚举为准） |
| publishedAt | string \| null | 发布时间 |
| version | number | 乐观锁 |
| audience | object | 投放范围（若类型有则原样） |

### 8.4 POST mutate

- **映射**：`announcementsService.mutate`
- **Body**：`action`（`save`/`publish`/`offline`/`create`）、`version`（更新必填）、`reason`、`idempotencyKey`、载荷字段。
- **权限**：admin

---

## 9. HQ-07 资料中心（Materials）

### 9.1 模块说明

- 对应前端：`src/types/materials.ts`、`src/services/materialsService.ts`。
- 库表：若有 `materials` / 文件元数据表则对接；**否则落地待定**，API 仍按前端契约实现。

### 9.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/materials` | 资料分页 |
| GET | `/api/hq/materials/{materialId}` | 详情 |
| GET | `/api/hq/materials/catalog` | 分类/审计 |
| POST | `/api/hq/materials/mutate` | 保存/上下架/删除 |
| POST | `/api/hq/materials/assets` | 上传文件 |

### 9.3 主要字段

| 字段 | 类型 | 说明 |
|---|---|---|
| materialId | string | ID |
| title | string | 标题 |
| category | string | 分类 |
| fileUrl / assetId | string | 文件 |
| status | string | 上架状态 |
| version | number | 乐观锁 |

- **映射**：`materialsService.list` / `getCatalog` / `mutate` / `upload`
- **mutate Body**：`action` + `reason` + `idempotencyKey` + `version`（更新时）

---

## 10. HQ-08 激活码（Activation Codes）

### 10.1 模块说明

- 对应前端：`src/types/activationCodes.ts`、`src/services/activationCodesService.ts`。
- 对应库表：激活码批次/码表（如 `activation_codes`、`activation_batches`）；以 schema 实际名为准。

### 10.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/activation-codes/batches` | 批次列表 |
| GET | `/api/hq/activation-codes/batches/{batchId}` | 批次详情（含码统计） |
| GET | `/api/hq/activation-codes` | 码分页（按批次/状态筛） |
| POST | `/api/hq/activation-codes/batches` | 创建批次并生成码 |
| POST | `/api/hq/activation-codes/mutate` | 作废/导出回执等 |
| GET | `/api/hq/activation-codes/catalog` | 可绑权益产品目录 |

### 10.3 创建批次 Body

| 字段 | 类型 | 说明 |
|---|---|---|
| productId / entitlementType | string | 绑定权益 |
| quantity | number | 生成数量 |
| expiresAt | string \| null | 过期 |
| reason | string | 必填 |
| idempotencyKey | string | 必填 |

- **映射**：`activationCodesService.createBatch` / `list` / `mutate`
- **码状态枚举（典型）**：`UNUSED` / `USED` / `VOID` / `EXPIRED`（以前端为准）
- **安全**：列表默认脱敏码面；导出需 reason + 审计。

---

## 11. HQ-09 软件卡（Software Cards）

### 11.1 模块说明

- 对应前端：`src/types/softwareCards.ts`、`src/services/softwareCardsService.ts`。
- **当前库无对应表 / 落地待定**。

### 11.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/software-cards` | 卡密分页 |
| GET | `/api/hq/software-cards/batches` | 批次 |
| GET | `/api/hq/software-cards/catalog` | 目录 |
| POST | `/api/hq/software-cards/batches` | 生成批次 |
| POST | `/api/hq/software-cards/mutate` | 作废/备注等 |

### 11.3 字段要点

| 字段 | 类型 | 说明 |
|---|---|---|
| cardId / batchId | string | ID |
| code | string | 卡密（**敏感**：列表脱敏，详情按需） |
| status | string | 未用/已用/作废等 |
| boundAccountId | string \| null | 绑定账号 |
| version | number | 乐观锁 |

- **映射**：`softwareCardsService.*`
- **mutate**：`reason` + `idempotencyKey` + `version`

---

## 12. HQ-10 配额（Quotas）

### 12.1 模块说明

- 对应前端：`src/types/quotas.ts`、`src/services/quotasService.ts`。
- 对应库表：配额账户/流水（如 partner/store quota）；无表则待建。

### 12.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/quotas` | 配额账户列表 |
| GET | `/api/hq/quotas/{quotaId}` | 详情+流水 |
| GET | `/api/hq/quotas/catalog` | 目录 |
| POST | `/api/hq/quotas/{quotaId}/mutate` | 调增/调减/冻结 |

### 12.3 mutate

- **映射**：`quotasService.mutate`
- **Body**：`action`（`adjust`/`freeze`/`unfreeze` 等）、`delta`（number，按前端单位）、`version`、`reason`、`idempotencyKey`
- **错误**：`QUOTA_EXCEEDED`（40903）、`VERSION_CONFLICT`

## 13. HQ-11 商品（Products）

### 13.1 模块说明

- 对应前端：`src/types/products.ts`、`src/services/productsService.ts`。
- **当前库无对应表 / 落地待定**（需 `products` / `product_skus` 等）。
- 金额字段一律 **单位：元**。

### 13.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/products` | 商品分页 |
| GET | `/api/hq/products/{productId}` | 商品详情（含 SKU） |
| GET | `/api/hq/products/catalog` | 类目/履约类型目录 |
| POST | `/api/hq/products/mutate` | 创建/保存 |
| POST | `/api/hq/products/{productId}/mutate` | 上架/下架/改价/改 SKU |

### 13.3 主要字段

| 字段 | 类型 | 说明 |
|---|---|---|
| productId | string | 商品 ID |
| title | string | 标题 |
| subtitle | string \| null | 副标题 |
| coverUrl | string | 封面 |
| fulfillmentType | string | 如 `PHYSICAL` / `COLUMN_ACCESS` / `VIRTUAL` / `MEMBERSHIP` 等（以前端枚举为准） |
| status | string | draft / on_sale / offline |
| skus | ProductSku[] | SKU 列表 |
| sku.skuId | string | SKU ID |
| sku.title | string | 规格名 |
| sku.price | number | **售价，单位：元** |
| sku.listPrice | number \| null | **划线价，单位：元** |
| sku.stock | number \| null | 库存；null 表示不限 |
| version | number | 乐观锁 |

### 13.4 mutate

- **映射**：`productsService.mutate` / `save`
- **Body**：`action`（`save`/`publish`/`offline`/`create`）、`value`（商品草稿）、`version`、`reason`、`idempotencyKey`
- **校验**：价格 ≥ 0 且最多两位小数；上架至少一 SKU。

---

## 14. HQ-12 履约发货（Delivery）

### 14.1 模块说明

- 对应前端：`src/types/delivery.ts`、`src/services/deliveryService.ts`。
- 对应库表：物流/发货单（若有 `shipments`）；**与分销升档无关**——本模块是实物履约物流。
- **与现库差异**：若库中仅有分销/升档相关字段而无物流单，需新建发货表；API 以 HQ 前端 DTO 为准。

### 14.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/delivery/shipments` | 待发/已发分页 |
| GET | `/api/hq/delivery/shipments/{shipmentId}` | 发货单详情 |
| GET | `/api/hq/delivery/catalog` | 快递公司等目录 |
| POST | `/api/hq/delivery/shipments/{shipmentId}/mutate` | 填写运单/发货/异常 |

### 14.3 主要字段

| 字段 | 类型 | 说明 |
|---|---|---|
| shipmentId | string | 发货单 ID |
| orderId / orderNo | string | 关联订单 |
| status | string | PENDING / SHIPPED / DELIVERED / EXCEPTION 等 |
| carrier | string | 承运商 |
| trackingNo | string \| null | 运单号 |
| receiverName / receiverPhone / address | string | 收件信息（手机可脱敏） |
| shippedAt | string \| null | 发货时间 |
| version | number | 乐观锁 |

- **映射**：`deliveryService.list` / `mutate`
- **mutate action**：`ship`（carrier+trackingNo）、`mark-delivered`、`flag-exception` + `reason` + `idempotencyKey` + `version`

---

## 15. HQ-13 订单（Orders）

### 15.1 模块说明

- 对应前端：`src/types/orders.ts`、`src/services/ordersService.ts`。
- 对应库表：`orders`、`order_items`（及支付关联）。
- **DTO 以 HQ 前端类型为主**；与现库差异需在实现时映射，例如：
  - 前端重视 `paymentStatus` + `fulfillmentStatus` 双状态；库若只有单一 status，需拆分或映射。
  - 履约物流信息走 Delivery 模块，不在订单上伪造「已迁移/已升档」。
  - 金额字段库多为 `DECIMAL` 元；与本文「元」一致。

### 15.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/orders` | 订单分页 |
| GET | `/api/hq/orders/{orderId}` | 订单详情 |
| GET | `/api/hq/orders/catalog` | 状态/业务类型目录 |
| POST | `/api/hq/orders/{orderId}/mutate` | 取消/备注/关闭/退款发起等 |

### 15.3 GET `/api/hq/orders`

- **映射**：`ordersService.list`
- **Query**：`page`、`pageSize`、`keyword`（订单号/手机）、`paymentStatus`、`fulfillmentStatus`、`business`、`accountId`、`from`/`to`（下单时间）
- **列表项主要字段**：

| 字段 | 类型 | 说明 |
|---|---|---|
| orderId | string | 订单 ID |
| orderNo | string | 订单号 |
| accountId | string | 下单账号 |
| business | string | MALL / MEMBERSHIP / BUSINESS 等 |
| paymentStatus | string | PENDING_PAYMENT / PAID / CANCELLED / REFUNDING / REFUNDED 等 |
| fulfillmentStatus | string | PENDING_DELIVERY / DELIVERED / NOT_REQUIRED 等 |
| goodsAmount | number | **商品金额，单位：元** |
| discountAmount | number | **优惠金额，单位：元** |
| payableAmount | number | **应付，单位：元** |
| paidAmount | number \| null | **实付，单位：元** |
| createdAt | string | 下单时间 |
| paidAt | string \| null | 支付时间 |
| version | number | 乐观锁 |
| allowedActions | string[] | 如 cancel / add-note / close |

### 15.4 GET `/api/hq/orders/{orderId}`

- **映射**：`ordersService.getDetail`
- **响应**：订单头 + `items[]`（productId/skuId/title/quantity/price **元**）+ 支付摘要 + 发货摘要 + 优惠券占用 + audit

### 15.5 POST `/api/hq/orders/{orderId}/mutate`

- **映射**：`ordersService.mutate`
- **Body**：`action`、`version`、`reason`、`idempotencyKey` + 载荷
- 典型 action：`cancel`、`add-note`、`close`、`mark-fulfilled`（虚拟履约）；退款若独立则转 payments/refunds
- **错误**：已支付不可直接 cancel → `INVALID_STATE`

---

## 16. HQ-14 优惠券（Coupons）

### 16.1 模块说明

- 对应前端：`src/types/coupons.ts`、`src/services/couponsService.ts`。
- **当前库无优惠券模板/用户券表 / 落地待定**。
- 金额：**单位：元**（前端 mock 注释曾写「分」，实现按用户拍板改为元）。

### 16.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/coupons/catalog` | 模板、账号摘要、限额、审计 |
| GET | `/api/hq/coupons/templates` | 模板列表（可并入 catalog） |
| GET | `/api/hq/coupons` | 用户券分页 |
| POST | `/api/hq/coupons/mutate` | save-template / issue |

### 16.3 模板与用户券字段

**CouponTemplateValue / Template**

| 字段 | 类型 | 说明 |
|---|---|---|
| templateId | string | 模板 ID（save 更新时） |
| title | string | 名称 |
| amount | number | **面额，单位：元** |
| minAmount | number | **门槛，单位：元** |
| scope | object | `{ kind:"all", productIds:[] }` 或 `{ kind:"products", productIds:string[] }` |
| validFrom / expiresAt | string | 有效期 |
| enabled | boolean | 是否启用 |
| totalQuantity | number | 总发放上限 |
| perAccountLimit | number | 每账号限领 |
| issuedQuantity | number | 已发放（只读） |
| version | number | 乐观锁 |

**UserCoupon**

| 字段 | 类型 | 说明 |
|---|---|---|
| couponId | string | 用户券 ID |
| templateId / templateVersion | string / number | 模板快照版本 |
| accountId | string | 归属账号 |
| snapshot | object | title/amount/minAmount/scope/validFrom/expiresAt |
| status | string | `available` / `not-started` / `reserved` / `used` / `expired` |
| reservedOrderId / usedOrderId | string \| null | 占用/核销订单 |
| version | number | 乐观锁 |

### 16.4 POST `/api/hq/coupons/mutate`

- **映射**：`couponsService.mutate`
- **Body**：
  - 公共：`reason`、`idempotencyKey`
  - `action=save-template`：`templateId`、`version`、`value: CouponTemplateValue`
  - `action=issue`：`templateId`、`version`、`accountIds: string[]`
- **响应**：`{ templateId, couponIds[], operationId }`
- **错误**：`QUOTA_EXCEEDED`（超发）、`VERSION_CONFLICT`
- **说明**：C 端 checkout 的 reserve/use/release 可另开内部接口；HQ 以模板与发放为主。

---

## 17. HQ-15 支付对账（Payments）

### 17.1 模块说明

- 对应前端：`src/types/payments.ts`、`src/services/paymentsService.ts`。
- 对应库表：`payments` / 支付尝试 / 对账任务；渠道配置表可能待建。
- **与现库差异**：前端 DTO 含渠道配置、查单补偿、对账差异；库表若仅有支付主单，需扩展 job/difference/config。金额 **单位：元**。

### 17.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/payments/catalog` | 渠道配置、最近任务、审计 |
| GET | `/api/hq/payments` | 支付单分页 |
| GET | `/api/hq/payments/{paymentId}` | 支付详情+attempts |
| POST | `/api/hq/payments/mutate` | save-channel / query / compensate / reconcile |
| GET | `/api/hq/payments/jobs/{jobId}` | 异步任务结果 |
| GET | `/api/hq/payments/export` | 下载对账/流水 CSV 元数据 |

### 17.3 核心类型字段

**PaymentChannelConfig**：`configId`、`platform`=`MINI_PROGRAM|H5`、`business`=`MALL|MEMBERSHIP|BUSINESS`、`channel`=`WECHAT|ALIPAY`、`enabled`、`version`

**PaymentRecord**

| 字段 | 类型 | 说明 |
|---|---|---|
| paymentId | string | 支付单 ID |
| orderId / orderNo | string | 订单 |
| accountId | string | 账号 |
| channel / platform / business | enum | 见上 |
| status | string | WAITING / SUCCESS / CLOSED |
| amount | number | **金额，单位：元** |
| paidAt | string \| null | 支付时间 |
| channelTradeNo | string \| null | 渠道流水号 |
| statementDate | string | 对账日 |
| verification | object \| null | 渠道核验：status/amount(**元**)/channelTradeNo/checkedAt/detail |

### 17.4 POST `/api/hq/payments/mutate`

- **映射**：`paymentsService.mutate`
- **Body**：`reason` + `idempotencyKey`，以及：
  - `action=save-channel`：`configId`、`version`、`enabled`
  - `action=query` | `compensate`：`paymentId`
  - `action=reconcile`：`channel`、`statementDate`、`fileName`、`csv`（对账文件内容）
- **响应**：`{ jobId, configId }`；query/compensate/reconcile 多为异步 job
- **ReconciliationDifference.reason**：`CHANNEL_ONLY` / `LOCAL_ONLY` / `AMOUNT_MISMATCH` / `STATUS_MISMATCH` / `TRADE_NO_MISMATCH`；金额字段 **单位：元**
- **敏感**：渠道商户密钥不在此 API 回传；配置仅开关与元数据。

## 18. HQ-16 收益（Revenue）

### 18.1 模块说明

- 对应前端：`src/types/revenue.ts`、`src/services/revenueService.ts`。
- 对应库表：收益账户/流水（如 `revenue_ledgers`、`revenue_accounts`）；以 schema 为准。
- 金额 **单位：元**。

### 18.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/revenue/accounts` | 收益账户分页 |
| GET | `/api/hq/revenue/accounts/{accountId}` | 账户详情+流水 |
| GET | `/api/hq/revenue/ledgers` | 全量流水分页 |
| GET | `/api/hq/revenue/catalog` | 目录/汇总 |
| POST | `/api/hq/revenue/mutate` | 调账/冻结（若前端有） |

### 18.3 主要字段

| 字段 | 类型 | 说明 |
|---|---|---|
| revenueAccountId | string | 收益账户 ID |
| ownerAccountId | string | 归属用户 accountId |
| availableBalance | number | **可提现余额，单位：元** |
| frozenBalance | number | **冻结，单位：元** |
| totalEarned | number | **累计入账，单位：元** |
| version | number | 乐观锁 |
| ledgerId | string | 流水 ID |
| ledger.amount | number | **变动额，单位：元**（可正可负） |
| ledger.bizType | string | 业务类型 |
| ledger.orderId | string \| null | 关联订单 |

- **映射**：`revenueService.list` / `getDetail` / `mutate`
- **mutate**：`reason` + `idempotencyKey` + `version`；调账需强审计。

---

## 19. HQ-17 提现（Withdrawals）

### 19.1 模块说明

- 对应前端：`src/types/withdrawals.ts`、`src/services/withdrawalsService.ts`。
- 对应库表：`withdrawals` / 提现申请。
- 金额 **单位：元**；银行卡号等 **敏感**（列表脱敏）。

### 19.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/withdrawals` | 提现单分页 |
| GET | `/api/hq/withdrawals/{withdrawalId}` | 详情 |
| GET | `/api/hq/withdrawals/catalog` | 状态目录与汇总 |
| POST | `/api/hq/withdrawals/{withdrawalId}/mutate` | 审核通过/拒绝/打款回执 |

### 19.3 主要字段

| 字段 | 类型 | 说明 |
|---|---|---|
| withdrawalId | string | 提现单 ID |
| accountId | string | 申请人账号 |
| amount | number | **提现金额，单位：元** |
| fee | number | **手续费，单位：元** |
| actualAmount | number | **实际到账，单位：元** |
| status | string | PENDING / APPROVED / REJECTED / PAID / FAILED 等 |
| channel | string | 打款渠道 |
| bankAccountMask | string | 脱敏账号 |
| version | number | 乐观锁 |
| allowedActions | string[] | approve / reject / mark-paid / mark-failed |

### 19.4 mutate

- **映射**：`withdrawalsService.mutate`
- **Body**：`action`、`version`、`reason`、`idempotencyKey`；拒绝时 `rejectionReason`
- **错误**：余额不足已由申请侧保证；重复审核 → `INVALID_STATE`

---

## 20. HQ-18 员工与角色（Staff）

### 20.1 模块说明

- 对应前端：`src/types/staff.ts`、`src/services/staffService.ts`。
- 对应库表：门店员工/角色绑定（如 `store_staff`）；HQ 管理员仍用 `admins`，本模块管门店侧员工。

### 20.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/staff` | 员工分页 |
| GET | `/api/hq/staff/{staffId}` | 详情 |
| GET | `/api/hq/staff/catalog` | 角色/门店目录 |
| POST | `/api/hq/staff/mutate` | 创建/改角色/停用 |
| POST | `/api/hq/staff/{staffId}/mutate` | 针对单人 mutate |

### 20.3 主要字段

| 字段 | 类型 | 说明 |
|---|---|---|
| staffId | string | 员工 ID |
| accountId | string \| null | 绑定账号 |
| name / phone | string | 姓名/手机 |
| storeId | string | 所属门店 |
| roles | string[] | 角色码 |
| status | string | ACTIVE / DISABLED |
| version | number | 乐观锁 |

- **映射**：`staffService.list` / `mutate`
- **mutate**：`reason` + `idempotencyKey` + `version`
- **说明**：当前 HQ 鉴权仍只校验 admin；门店角色不影响 HQ 登录。

---

## 21. HQ-19 门店（Stores）

### 21.1 模块说明

- 对应前端：`src/types/stores.ts`、`src/services/storesService.ts`。
- 对应库表：`stores`。

### 21.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/stores` | 门店分页 |
| GET | `/api/hq/stores/{storeId}` | 详情 |
| GET | `/api/hq/stores/catalog` | 筛选项 |
| POST | `/api/hq/stores/mutate` | 创建 |
| POST | `/api/hq/stores/{storeId}/mutate` | 更新/停用/改负责人 |

### 21.3 主要字段

| 字段 | 类型 | 说明 |
|---|---|---|
| storeId | string | 门店 ID |
| name | string | 名称 |
| code | string \| null | 门店编码 |
| address | string | 地址 |
| managerName / managerPhone | string | 负责人 |
| ownerAccountId | string \| null | 店主账号 |
| active | boolean | 是否营业 |
| version | number | 乐观锁 |

- **映射**：`storesService.list` / `mutate`

---

## 22. HQ-20 培训课时（Training）

### 22.1 模块说明

- 对应前端：`src/types/training.ts`、`src/services/trainingService.ts`。
- 对应库表：课时余额/消耗/反馈（若有）；无则待建。
- 课时为**整数课时**（非金额）。

### 22.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/training/balances` | 会员课时余额分页 |
| GET | `/api/hq/training/members/{memberId}` | 余额+消耗+反馈详情 |
| GET | `/api/hq/training/feedback` | 反馈分页 |
| GET | `/api/hq/training/catalog` | 门店/课包/反馈类型 |
| POST | `/api/hq/training/mutate` | proxy-feedback / withdraw-feedback / consume-lessons |

### 22.3 核心字段

| 字段 | 类型 | 说明 |
|---|---|---|
| memberId | string | 会员 |
| storeId / storeName | string | 门店 |
| trainingRemaining | number | 常规课时剩余 |
| specialRemaining | number | 专项课时剩余 |
| version | number | 余额版本 |
| LessonBucket | enum | 以前端为准（如 TRAINING / SPECIAL） |
| FeedbackKind / FeedbackStatus | enum | 以前端为准 |

### 22.4 POST `/api/hq/training/mutate`

- **映射**：`trainingService.mutate`
- **Body**：
  - `action=proxy-feedback`：`memberId`、`kind`、`title`、`body`、`reason`、`idempotencyKey`
  - `action=withdraw-feedback`：`feedbackId`、`version`、`reason`、`idempotencyKey`
  - `action=consume-lessons`：`memberId`、`bucket`、`quantity`、`version`、`reason`、`idempotencyKey`
- **响应**：对应 `TrainingMutationResult`（feedback 或 balance+record）

---

## 23. HQ-21 转店（Transfers）

### 23.1 模块说明

- 对应前端：`src/types/transfers.ts`、`src/services/transfersService.ts`。
- 对齐小程序转店申请与双边门店审核；**双方同意 ≠ 已迁移**，须服务端迁移回执。
- 库表：转店申请表（若无则待建）。

### 23.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/transfers` | 申请分页 |
| GET | `/api/hq/transfers/{applicationId}` | 详情 |
| GET | `/api/hq/transfers/catalog` | 门店/状态/pendingPolicy |
| POST | `/api/hq/transfers/{applicationId}/mutate` | HQ 监管写操作 |

### 23.3 TransferApplication 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| applicationId | string | 申请 ID |
| type | string | 固定 `TRANSFER` |
| memberId / memberName / displayId | string | 会员 |
| applicantName / reason | string | 申请人与原因 |
| sourceStoreId / Name | string | 转出门店 |
| targetStoreId / Name | string | 转入门店 |
| sourceApprovalStatus | SideApprovalStatus | PENDING/APPROVED/REJECTED |
| targetApprovalStatus | SideApprovalStatus | 同上 |
| status | TransferOverallStatus | 综合：任拒=REJECTED；双同=APPROVED；否则 PENDING |
| migrationStatus | MigrationStatus | NOT_STARTED / AWAITING_SERVER / RECEIPTED_SUCCESS / RECEIPTED_FAILED |
| exceptionFlag | NONE / FLAGGED | 异常标记 |
| hqNote | string \| null | HQ 备注 |
| unusedTrainingLessons / unusedSpecialLessons | number | 申请时课时快照（口径待定，仅展示） |
| version | number | 乐观锁 |
| allowedActions | string[] | force-reject / flag-exception / clear-exception / add-note / record-migration-receipt |

### 23.4 mutate actions

- **映射**：`transfersService.mutate`
- 均需：`applicationId`、`version`、`reason`、`idempotencyKey`
  - `force-reject`
  - `flag-exception` / `clear-exception`
  - `add-note` + `note`
  - `record-migration-receipt` + `receipt`=`SUCCESS|FAILED` + `receiptNote`（**仅登记回执，不在 HQ 前端执行迁移**）
- **catalog.pendingPolicy**：未用课时/后续订单/历史反馈/未结算收益等口径说明（文案字段，映射文档待定）

## 24. HQ-22 合伙人（Partners）

### 24.1 模块说明

- 对应前端：`src/types/partners.ts`、`src/services/partnersService.ts`。
- 对应库表：合伙人档案/升档任务（若有 `partner_*`）；等级权益内容可能走 CMS。
- `annualFeeAmount` 前端类型字面量曾为分；**实现按元**：文档约定年费展示/配置字段 **单位：元**（示例值若原 20000 分则改为 `200.00` 元，以后端配置为准）。

### 24.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/partners` | 合伙人分页 |
| GET | `/api/hq/partners/{contextId}` | 详情（档案+任务+回执+审计） |
| GET | `/api/hq/partners/catalog` | 等级权益、回执、审计 |
| POST | `/api/hq/partners/mutate` | upgrade / save-benefits |

### 24.3 枚举与字段

- **PartnerLevel**：`DEMO-VIP` / `DEMO-ANGEL` / `DEMO-BOARD` / `DEMO-FOUNDER`（演示枚举，上线可配置化）
- **partnerStatus**：`ACTIVE` / `FROZEN` / `EXPIRED` / `PENDING_ANNUAL`
- **annualStatus**：`ACTIVE` / `EXPIRED` / `NOT_OPEN`

| 字段 | 类型 | 说明 |
|---|---|---|
| contextId | string | 合伙上下文 ID |
| accountId / displayId / name / phone | string | 账号信息 |
| partnerLevel | PartnerLevel | 当前等级 |
| frozen | boolean | 冻结 |
| annualValidUntil | string \| null | 年费有效期 |
| annualFeeAmount | number | **年费金额，单位：元** |
| superior | object \| null | 上级 accountId/contextId/name |
| task | PartnerPromotionTask \| null | 升档任务 |
| version | number | 乐观锁 |
| allowedActions | string[] | manual-upgrade / claim-promotion |

**PartnerPromotionTask.status**：`IN_PROGRESS` / `READY` / `PROCESSING` / `COMPLETED` / `EXPIRED` / `SUPERSEDED`

### 24.4 POST `/api/hq/partners/mutate`

- **映射**：`partnersService.mutate`
- **Body 公共**：`reason`、`idempotencyKey`、`version`
  - `action=upgrade`：`contextId`、`targetLevel`
  - `action=save-benefits`：`partnerLevel`、`summary`、`content: RichContent`
- **响应**：`{ receiptId, operationId }`

---

## 25. HQ-23 邀请关系（Invitations）

### 25.1 模块说明

- 对应前端：`src/types/invitations.ts`、`src/services/invitationsService.ts`。
- 对应库表：邀请码/上下级关系；改绑需 `version` + `graphVersion` 双版本。

### 25.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/invitations` | 关系分页 |
| GET | `/api/hq/invitations/{accountId}` | 详情（祖先链+历史） |
| GET | `/api/hq/invitations/{accountId}/team` | 直推/团队列表 |
| POST | `/api/hq/invitations/mutate` | rebind / unbind |

### 25.3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| account | InvitationAccount | accountId/displayId/name/phone/frozen |
| superior | InvitationAccount \| null | 当前上级 |
| inviteCode | string | 邀请码 |
| initialBinding.source | enum | REGISTRATION_INVITE / NO_INVITE |
| version / graphVersion | number | 关系版本 / 图谱版本 |
| directCount / teamCount | number | 直推/团队人数 |
| allowedActions | string[] | rebind / unbind |

### 25.4 Query / Team / mutate

- **list Query**：`page`、`pageSize`、`keyword`、`binding`=`BOUND|UNBOUND`
- **team Query**：`accountId`、`scope`=`DIRECT|ALL`、`page`、`pageSize`、`keyword`
- **映射**：`invitationsService.list` / `getDetail` / `listTeam` / `mutate`
- **mutate Body**：`action`=`rebind|unbind`、`accountId`、`targetAccountId`（unbind 时 null）、`version`、`graphVersion`、`reason`、`idempotencyKey`
- **错误**：成环、自己绑自己 → `INVALID_INPUT`；版本冲突 → `VERSION_CONFLICT`

---

## 26. HQ-24 共创店（Costore）

### 26.1 模块说明

- 对应前端：`src/types/costore.ts`、`src/services/costoreService.ts`。
- 对应库表：共创申请/方案（若无则待建）。
- 金额字段 **单位：元**：`monthlyFee`、`payableAmount`、`refund.amount`、`priceBoundary.referenceMonthlyFee`。

### 26.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/costore/applications` | 申请分页 |
| GET | `/api/hq/costore/applications/{applicationId}` | 详情+退款+审计 |
| GET | `/api/hq/costore/catalog` | 方案 plans、门店、是否允许退款重试 |
| POST | `/api/hq/costore/mutate` | save-plan / retry-refund |

### 26.3 枚举

- **applicationStatus**：`PENDING_PAYMENT` / `PENDING_REVIEW` / `APPROVED` / `REJECTED` / `CANCELLED`
- **paymentStatus**：`NOT_STARTED` / `PENDING` / `PAID` / `CANCELLED`
- **refundStatus**：`PENDING` / `SUCCEEDED` / `FAILED` / null
- **contractStatus**：`NOT_SIGNED` / `PENDING_CONFIRMATION` / `SIGNED`
- **entitlementStatus**：`NOT_OPEN` / `PENDING_CONFIRMATION` / `OPEN`

### 26.4 字段摘要

**CostorePlan**：`planId`、`title`、`durationId`、`months`、`priceBoundary.referenceMonthlyFee`（**元**）、`benefits`/`agreement`（RichContent）、`agreementVersion`、`version`

**CostoreApplication**：`applicationId`、`accountId`、申请人、门店、`monthlyFee`/`payableAmount`（**元**）、`orderId`、各状态字段、`version`、`allowedActions`（如 `retry-refund`）

### 26.5 mutate

- **映射**：`costoreService.mutate`
- **Body**：`reason`、`idempotencyKey`、`version` +
  - `action=save-plan`：`planId`、`title`、`benefits`、`agreement`
  - `action=retry-refund`：`applicationId`

---

## 27. HQ-25 客服工单（Support）

### 27.1 模块说明

- 对应前端：`src/types/support.ts`、`src/services/supportService.ts`。
- 对应库表：工单/消息（若无则待建）。

### 27.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/support/tickets` | 工单分页 |
| GET | `/api/hq/support/tickets/{ticketId}` | 详情+消息流 |
| GET | `/api/hq/support/catalog` | 状态/分类目录 |
| POST | `/api/hq/support/tickets/{ticketId}/mutate` | 回复/改状态/转派/关闭 |

### 27.3 主要字段

| 字段 | 类型 | 说明 |
|---|---|---|
| ticketId | string | 工单 ID |
| accountId | string | 用户账号 |
| category | string | 分类 |
| status | string | OPEN / PENDING / RESOLVED / CLOSED 等 |
| subject | string | 主题 |
| messages | array | 消息：senderRole/content/createdAt |
| version | number | 乐观锁 |

- **映射**：`supportService.list` / `getDetail` / `mutate`
- **mutate**：`action`（reply/change-status/assign/close）+ `reason` + `idempotencyKey` + `version`

---

## 28. HQ-26 追踪溯源（Trace）

### 28.1 模块说明

- 对应前端：`src/types/trace.ts`、`src/services/traceService.ts`。
- 用途：按 requestId / 业务 ID 查询操作审计与链路，只读为主。
- 库表：统一审计表或各模块 audit 聚合（**统一审计表可待建**）。

### 28.2 接口列表

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/hq/trace` | 按条件搜索追踪事件 |
| GET | `/api/hq/trace/{traceId}` | 单条详情 |
| GET | `/api/hq/trace/by-request/{requestId}` | 按 requestId 聚合 |
| GET | `/api/hq/trace/catalog` | 模块/动作目录 |

### 28.3 Query

| 字段 | 类型 | 说明 |
|---|---|---|
| page / pageSize | number | 分页 |
| module | string | users/orders/... |
| action | string | 动作名 |
| targetId | string | 业务主键 |
| requestId | string | 请求 ID |
| operatorId | string | 操作者 |
| from / to | string | 时间范围 |

- **映射**：`traceService.search` / `getByRequest`
- **权限**：admin；**无写接口**（审计由各业务写操作产生）。

---

## 29. （遗留）代理商 Agents

- 导航中若仍保留入口，对应旧版 `agents` mock；**非 HQ-01～26 主路径**。
- 建议：新后台以 Partners + Invitations + Stores 替代；若需兼容可提供只读 `GET /api/hq/agents` 并标注 deprecated。
- 本文不展开写操作，避免与合伙体系重复建设。

## 附录 A. 枚举汇总

| 模块 | 枚举名 | 取值 |
|---|---|---|
| 通用写错误 | Error.code | FORBIDDEN / NOT_FOUND / INVALID_INPUT / INVALID_STATE / VERSION_CONFLICT / IDEMPOTENCY_CONFLICT / QUOTA_EXCEEDED |
| 专栏 | ManagedColumn.status | draft / published / offline |
| 优惠券 | CouponStatus | available / not-started / reserved / used / expired |
| 支付 | PaymentChannel | WECHAT / ALIPAY |
| 支付 | PaymentPlatform | MINI_PROGRAM / H5 |
| 支付 | PaymentBusiness | MALL / MEMBERSHIP / BUSINESS |
| 支付单 | PaymentRecord.status | WAITING / SUCCESS / CLOSED |
| 对账差异 | ReconciliationDifference.reason | CHANNEL_ONLY / LOCAL_ONLY / AMOUNT_MISMATCH / STATUS_MISMATCH / TRADE_NO_MISMATCH |
| 转店侧审 | SideApprovalStatus | PENDING / APPROVED / REJECTED |
| 转店综合 | TransferOverallStatus | PENDING / APPROVED / REJECTED |
| 迁移 | MigrationStatus | NOT_STARTED / AWAITING_SERVER / RECEIPTED_SUCCESS / RECEIPTED_FAILED |
| 转店异常 | TransferExceptionFlag | NONE / FLAGGED |
| 合伙等级 | PartnerLevel | DEMO-VIP / DEMO-ANGEL / DEMO-BOARD / DEMO-FOUNDER |
| 合伙状态 | partnerStatus | ACTIVE / FROZEN / EXPIRED / PENDING_ANNUAL |
| 年费 | annualStatus | ACTIVE / EXPIRED / NOT_OPEN |
| 升档任务 | PartnerPromotionTask.status | IN_PROGRESS / READY / PROCESSING / COMPLETED / EXPIRED / SUPERSEDED |
| 邀请初始绑 | InvitationInitialBinding.source | REGISTRATION_INVITE / NO_INVITE |
| 共创申请 | CostoreApplicationStatus | PENDING_PAYMENT / PENDING_REVIEW / APPROVED / REJECTED / CANCELLED |
| 共创支付 | CostorePaymentStatus | NOT_STARTED / PENDING / PAID / CANCELLED |
| 共创退款 | CostoreRefundStatus | PENDING / SUCCEEDED / FAILED / null |

> 其余模块枚举以对应 `src/types/*.ts` 为准；上表列出已在本文展开的关键枚举。订单支付/履约状态以实现时与前端 `orders.ts` 对齐为准。

## 附录 B. ID 命名对照

| 前端字段 | 建议库表.字段 | 说明 |
|---|---|---|
| accountId | users.id | 登录账号 |
| memberId | members.id | 学员/孩子档案 |
| adminId | admins.id | HQ 管理员 |
| storeId | stores.id | 门店 |
| orderId | orders.id | 订单 |
| orderNo | orders.order_no | 业务订单号 |
| paymentId | payments.id | 支付单 |
| productId / skuId | （待建）products / skus | 商品 |
| templateId / couponId | （待建）coupon_* | 优惠券 |
| contextId | partner 上下文表 | 合伙档案 |
| applicationId | 转店/共创申请表 | 视模块 |
| shipmentId | （待建）shipments | 发货单 |
| ticketId | （待建）support_tickets | 工单 |
| batchId / codeId | activation_* | 激活码 |

## 附录 C. 金额字段清单（单位：元）

| 模块 | 字段 | 说明 |
|---|---|---|
| Products | sku.price / sku.listPrice | 售价/划线价 |
| Orders | goodsAmount / discountAmount / payableAmount / paidAmount | 订单金额 |
| Orders.items | price / lineAmount | 行价 |
| Coupons | amount / minAmount | 面额/门槛 |
| Coupons.snapshot | amount / minAmount | 发放快照 |
| Payments | amount / verification.amount | 支付与核验 |
| Payments.diff | localAmount / channelAmount | 对账差异 |
| Revenue | availableBalance / frozenBalance / totalEarned / ledger.amount | 收益 |
| Withdrawals | amount / fee / actualAmount | 提现 |
| Partners | annualFeeAmount | 年费 |
| Costore | monthlyFee / payableAmount / refund.amount / referenceMonthlyFee | 共创 |
| Columns.orders | payableAmount | 专栏订单（若露出） |

**实现注意**：前端部分 mock/注释仍写「分」；联调与落库一律按本附录「元、两位小数」。

## 附录 D. 缺表 / 落地待定模块

| 模块 | 状态 | 说明 |
|---|---|---|
| 商品 Products | 无表 | API 已按前端契约写出 |
| 公告 Announcements | 无表 | 同上 |
| 软件卡 Software Cards | 无表 | 同上 |
| 专栏 CMS | 无表 | 草稿/发布/素材表待建 |
| 优惠券模板/用户券 | 无表 | 同上 |
| 支付渠道配置/对账 Job | 可能不全 | 在 payments 表外扩展 |
| 统一审计 Trace | 可能分散 | 建议建统一 audit 表 |
| HQ admins 会话 | 视现网 | 需支持 Bearer 失效 |

## 附录 E. 前端 Service 映射总表（摘要）

| 模块 | Service（典型） | 主要方法 |
|---|---|---|
| Auth | authService | login / logout / me / changePassword |
| Users | usersService | list / getDetail / mutate / catalog |
| Members | membersService | list / getDetail / mutate |
| Course | courseService | list / mutate / catalog |
| Columns | columnsService | getCatalog / mutate / uploadAsset |
| Announcements | announcementsService | list / mutate / catalog |
| Materials | materialsService | list / mutate / upload |
| ActivationCodes | activationCodesService | listBatches / createBatch / mutate |
| SoftwareCards | softwareCardsService | list / createBatch / mutate |
| Quotas | quotasService | list / mutate |
| Products | productsService | list / mutate |
| Delivery | deliveryService | list / mutate |
| Orders | ordersService | list / getDetail / mutate |
| Coupons | couponsService | getCatalog / list / mutate |
| Payments | paymentsService | getCatalog / list / mutate / download |
| Revenue | revenueService | list / getDetail / mutate |
| Withdrawals | withdrawalsService | list / mutate |
| Staff | staffService | list / mutate |
| Stores | storesService | list / mutate |
| Training | trainingService | listBalances / listFeedback / getMember / mutate |
| Transfers | transfersService | list / getDetail / getCatalog / mutate |
| Partners | partnersService | list / getDetail / getCatalog / mutate |
| Invitations | invitationsService | list / getDetail / listTeam / mutate |
| Costore | costoreService | list / getDetail / getCatalog / mutate |
| Support | supportService | list / getDetail / mutate |
| Trace | traceService | search / getByRequest |

## 附录 F. 接口数量统计

| 模块 | 接口数（约） |
|---|---|
| HQ-01 Auth | 4 |
| HQ-02 Users | 4 |
| HQ-03 Members | 4 |
| HQ-04 Course | 4 |
| HQ-05 Columns | 6 |
| HQ-06 Announcements | 5 |
| HQ-07 Materials | 5 |
| HQ-08 Activation Codes | 6 |
| HQ-09 Software Cards | 5 |
| HQ-10 Quotas | 4 |
| HQ-11 Products | 5 |
| HQ-12 Delivery | 4 |
| HQ-13 Orders | 4 |
| HQ-14 Coupons | 4 |
| HQ-15 Payments | 6 |
| HQ-16 Revenue | 5 |
| HQ-17 Withdrawals | 4 |
| HQ-18 Staff | 5 |
| HQ-19 Stores | 5 |
| HQ-20 Training | 5 |
| HQ-21 Transfers | 4 |
| HQ-22 Partners | 4 |
| HQ-23 Invitations | 4 |
| HQ-24 Costore | 4 |
| HQ-25 Support | 4 |
| HQ-26 Trace | 4 |
| **合计** | **约 118** |

> 统计含 catalog/detail/list/mutate/upload/export 等；实现时可合并「无 id 的 mutate」与「带 id 的 mutate」而不改变语义。

---

*文档结束。后端可按 `/api/hq` + 本章节直接拆分 Controller/路由；缺表模块先建表或先 mock 存储，不阻塞契约联调。*

