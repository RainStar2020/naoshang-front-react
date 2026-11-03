# 后台 API 文档（脑商 AI · 总部 HQ 后台）

> 本文档由总部后台工程（Spring Boot 3.3 / Java 17）的代码自动提取生成，覆盖所有对外 REST 端点。

> 生成口径：基于 `server-java` 最新代码；**已按需求移除 Java 工程，本文件即为保留的 API 契约**。


## 0. 概览

- 控制器（Controller）：**32 个**
- 业务模块：**30 个**
- 对外端点：**132 个**（GET / POST 为主，少量 PUT / DELETE）
- 统一路由前缀：**`/api/hq/<kebab-resource>`**
- 统一响应信封：**`ApiResult<T>` = `{ code, message, data }`**，`code=0` 表示成功


## 1. 标准化契约（所有端点必须遵守）

### 1.1 统一响应信封

```json
{ "code": 0, "message": "ok", "data": { } }
```
- 成功：`code=0`，业务数据放在 `data`；`@JsonInclude(NON_NULL)` 保证空字段不返回。
- 失败：由全局异常处理器统一包成同一信封，并映射 HTTP 状态码（见 1.3）。

### 1.2 统一错误码（`ResultCode`）

| 错误码 | 含义 | HTTP 状态 |
|---|---|---|
| 40000 | 参数校验失败（Jakarta `@Valid`） | 400 |
| 40100 | 未认证 / 登录失效 | 401 |
| 40300 | 无权限 | 403 |
| 40400 | 资源不存在（含路由未命中） | 404 |
| 40900~40905 | 业务冲突（40901 = 乐观锁版本冲突） | 409 |
| 50000 | 服务器内部错误（不泄露堆栈） | 500 |

### 1.3 全局异常处理（`@RestControllerAdvice`）

- `BizException` → 对应业务错误码；校验异常 → `40000`；无匹配处理器 → `40400`；兜底 → `50000`。
- 生产环境不返回异常堆栈，仅返回 `code/message`。

### 1.4 分页规范

- 入参 `Paging`：`page >= 1`，默认 `pageSize=20`，上限 `100`。
- 出参 `ListResult<T>`：`{ items, total, page, pageSize, summary }`。

### 1.5 写操作四要素（变更类接口）

1. `reason`：变更原因必填（审计留痕）。
2. `Idempotency-Key`：HTTP 头幂等键，防重复提交。
3. `version`：乐观锁版本号，冲突返回 `40901`。
4. 审计：操作人、时间、原因落库。

### 1.6 鉴权与安全

- `Security`（ThreadLocal 操作人上下文）+ `AuthInterceptor` 写入操作人。
- 入参统一 Jakarta `@Valid` 校验。

### 1.7 版本说明

- 当前**无 `/api/v1` 版本前缀**（为前端零改动有意省略）。后续若做不兼容升级，需作为治理决策补充版本策略。


## 2. 端点总目录（按模块）

### 2.1 activationCodes  （5 个端点）

> 激活码 / 卡密批次：批次创建与查询、激活码目录、发放。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/activation-codes/batches` | 批次查询 | batches |
| GET | `/api/hq/activation-codes/batches/{batchId}` | 详情查询 | batchDetail |
| GET | `/api/hq/activation-codes/catalog` | 分页 / 列表查询 | catalog |
| POST | `/api/hq/activation-codes/batches` | 批次查询 | createBatch |
| POST | `/api/hq/activation-codes/mutate` | 创建 / 更新（变更） | mutate |

### 2.2 agents  （6 个端点）

> 代理商 / 联创：资料变更、目录、佣金预览 / 结算 / 台账。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| POST | `/api/hq/agents/mutate` | 创建 / 更新（变更） | mutate |
| GET | `/api/hq/agents/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/agents/{agentId}` | 预览 | preview |
| POST | `/api/hq/agents/{agentId}/commission/preview` | 预览 | preview |
| POST | `/api/hq/agents/{agentId}/commission/settle` | 结算 | settle |
| GET | `/api/hq/agents/{agentId}/commission` | 台账查询 | ledger |

### 2.3 agreements  （2 个端点）

> 协议 / 合同（支持子域）：协议查看与变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| POST | `/api/hq/support/agreements/{agreementId}/mutate` | 分页 / 列表查询 | list |
| GET | `/api/hq/support/agreements/{agreementId}` | 单体查询 / 操作 | ? |

### 2.4 announcements  （4 个端点）

> 总部公告：发布、查询、详情与变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/announcements/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/announcements/{announcementId}` | 单体查询 / 操作 | ? |
| POST | `/api/hq/announcements/mutate` | 操作 | ? |
| POST | `/api/hq/announcements/{announcementId}/mutate` | 操作 | ? |

### 2.5 assets  （2 个端点）

> 资产 / 文件上传：上传意图登记与完成回调。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| POST | `/api/hq/assets/upload-intents` | 创建 | createIntent |
| POST | `/api/hq/assets/{assetId}/completions` | 完成回调 | complete |

### 2.6 auth  （4 个端点）

> 认证授权：登录、登出、当前用户、修改密码。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| POST | `/api/hq/auth/login` | 操作 | me |
| POST | `/api/hq/auth/logout` | 操作 | me |
| GET | `/api/hq/auth/me` | 操作 | me |
| POST | `/api/hq/auth/password` | 操作 | ? |

### 2.7 columns  （5 个端点）

> 专栏 / 栏目：栏目、记录、变更与专栏素材。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/columns/catalog` | 操作 | ? |
| GET | `/api/hq/columns/{columnId}` | 单体查询 / 操作 | ? |
| GET | `/api/hq/columns/{columnId}/records` | 操作 | ? |
| POST | `/api/hq/columns/{columnId}/mutate` | 操作 | ? |
| POST | `/api/hq/columns/assets` | 操作 | ? |

### 2.8 costore  （5 个端点）

> 合店 / 联营：合店申请、目录、联营店、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/costore/applications` | 申请查询 | applications |
| GET | `/api/hq/costore/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/costore/joint-stores` | 操作 | jointStores |
| GET | `/api/hq/costore/applications/{applicationId}` | 详情查询 | applicationDetail |
| POST | `/api/hq/costore/mutate` | 创建 / 更新（变更） | mutate |

### 2.9 coupons  （3 个端点）

> 优惠券 / 卡券模板：模板列表与变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/coupons/catalog` | 分页 / 列表查询 | listTemplates |
| GET | `/api/hq/coupons/templates` | 分页 / 列表查询 | listTemplates |
| POST | `/api/hq/coupons/mutate` | 操作 | ? |

### 2.10 course  （7 个端点）

> 课程与权益：课程目录、权益发放、CMS 内容。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/course/entitlements` | 操作 | ? |
| GET | `/api/hq/course/catalog` | 操作 | ? |
| GET | `/api/hq/course/entitlements/{entitlementId}` | 单体查询 / 操作 | ? |
| POST | `/api/hq/course/entitlements` | 操作 | ? |
| POST | `/api/hq/course/entitlements/{entitlementId}/mutate` | 操作 | ? |
| GET | `/api/hq/course/cms/catalog` | 分页 / 列表查询 | catalog |
| POST | `/api/hq/course/cms/mutate` | 创建 / 更新（变更） | mutate |

### 2.11 delivery  （6 个端点）

> 交付 / 物流：交付策略与发货单。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| POST | `/api/hq/delivery/policies/{productId}/mutate` | 操作 | savePolicy |
| GET | `/api/hq/delivery/shipments` | 操作 | ? |
| GET | `/api/hq/delivery/catalog` | 操作 | ? |
| GET | `/api/hq/delivery/shipments/{shipmentId}` | 单体查询 / 操作 | ? |
| POST | `/api/hq/delivery/shipments` | 操作 | ? |
| POST | `/api/hq/delivery/shipments/{shipmentId}/mutate` | 操作 | ? |

### 2.12 invitations  （3 个端点）

> 邀请 / 团队：邀请详情、团队关系、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/invitations/{accountId}` | 详情查询 | detail |
| GET | `/api/hq/invitations/{accountId}/team` | 团队关系查询 | team |
| POST | `/api/hq/invitations/mutate` | 创建 / 更新（变更） | mutate |

### 2.13 materials  （4 个端点）

> 素材管理：素材目录、详情、变更与素材资源。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/materials/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/materials/{materialId}` | 创建 / 更新（变更） | mutate |
| POST | `/api/hq/materials/mutate` | 创建 / 更新（变更） | mutate |
| POST | `/api/hq/materials/assets` | 创建 | createAsset |

### 2.14 members  （3 个端点）

> 会员管理：会员目录、详情、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/members/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/members/{memberId}` | 详情查询 | detail |
| POST | `/api/hq/members/{memberId}/mutate` | 创建 / 更新（变更） | mutate |

### 2.15 orders  （3 个端点）

> 订单管理：订单目录、详情、状态变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/orders/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/orders/{orderId}` | 详情查询 | detail |
| POST | `/api/hq/orders/{orderId}/mutate` | 创建 / 更新（变更） | mutate |

### 2.16 partners  （3 个端点）

> 合伙人：合伙人目录、上下文详情、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/partners/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/partners/{contextId}` | 详情查询 | detail |
| POST | `/api/hq/partners/mutate` | 创建 / 更新（变更） | mutate |

### 2.17 payments  （6 个端点）

> 支付：支付单、支付任务、导出、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/payments/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/payments/{paymentId}` | 详情查询 | detail |
| GET | `/api/hq/payments/jobs/{jobId}` | 详情查询 | jobDetail |
| GET | `/api/hq/payments/jobs/{jobId}/files/{kind}` | 任务查询 | jobFile |
| GET | `/api/hq/payments/export` | 导出 | export |
| POST | `/api/hq/payments/mutate` | 创建 / 更新（变更） | mutate |

### 2.18 products  （6 个端点）

> 产品 / 软件卡：产品目录、分类、类型维护。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/products/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/products/{productId}` | 创建 / 更新（变更） | mutate |
| POST | `/api/hq/products/mutate` | 创建 / 更新（变更） | mutate |
| POST | `/api/hq/products/{productId}/mutate` | 创建 / 更新（变更） | itemMutate |
| POST | `/api/hq/products/categories/mutate` | 操作 | saveCategory |
| POST | `/api/hq/products/types/{code}/mutate` | 操作 | renameType |

### 2.19 quotas  （3 个端点）

> 配额管理：配额目录、详情、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/quotas/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/quotas/{quotaId}` | 详情查询 | detail |
| POST | `/api/hq/quotas/{quotaId}/mutate` | 创建 / 更新（变更） | mutate |

### 2.20 redemptions  （3 个端点）

> 兑换 / 核销：兑换目录、详情、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/redemptions/catalog` | 操作 | ? |
| GET | `/api/hq/redemptions/{redemptionId}` | 单体查询 / 操作 | ? |
| POST | `/api/hq/redemptions/{redemptionId}/mutate` | 操作 | ? |

### 2.21 regionAgents  （4 个端点）

> 区域代理：区县代 / 门店老板，区域与辖区维护。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/region-agents/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/region-agents/{agentId}` | 详情查询 | detail |
| POST | `/api/hq/region-agents/{agentId}/mutate` | 创建 / 更新（变更） | mutateAgent |
| POST | `/api/hq/region-agents/territories/{territoryId}/mutate` | 创建 / 更新（变更） | mutateTerritory |

### 2.22 revenue  （8 个端点）

> 营收 / 分账：账户、台账、重算、收益。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/revenue/accounts` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/revenue/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/revenue/ledgers` | 台账查询 | ledgers |
| GET | `/api/hq/revenue/accounts/{accountId}` | 详情查询 | accountDetail |
| POST | `/api/hq/revenue/mutate` | 创建 / 更新（变更） | mutate |
| POST | `/api/hq/revenue/ledgers/{ledgerId}/mutate` | 台账查询 | ledgerMutate |
| POST | `/api/hq/revenue/ledgers/recompute` | 批次查询 | batchRecompute |
| POST | `/api/hq/revenue/income/mutate` | 创建 / 更新（变更） | incomeMutate |

### 2.23 softwareCards  （7 个端点）

> 软件卡：批次、目录、设置、导出。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/software-cards/batches` | 批次查询 | batches |
| GET | `/api/hq/software-cards/catalog` | 分页 / 列表查询 | catalog |
| POST | `/api/hq/software-cards/batches` | 批次查询 | createBatch |
| POST | `/api/hq/software-cards/mutate` | 创建 / 更新（变更） | mutate |
| POST | `/api/hq/software-cards/exports` | 导出 | export |
| GET | `/api/hq/software-cards/settings` | 设置 | settings |
| POST | `/api/hq/software-cards/settings/mutate` | 设置 | saveSettings |

### 2.24 staff  （4 个端点）

> 员工 / 门店员工：员工目录、详情、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/staff/catalog` | 操作 | ? |
| GET | `/api/hq/staff/{staffId}` | 单体查询 / 操作 | ? |
| POST | `/api/hq/staff/mutate` | 操作 | ? |
| POST | `/api/hq/staff/{staffId}/mutate` | 操作 | ? |

### 2.25 stores  （4 个端点）

> 门店管理：门店目录、详情、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/stores/catalog` | 操作 | ? |
| GET | `/api/hq/stores/{storeId}` | 单体查询 / 操作 | ? |
| POST | `/api/hq/stores/mutate` | 操作 | ? |
| POST | `/api/hq/stores/{storeId}/mutate` | 操作 | ? |

### 2.26 support  （8 个端点）

> 客服 / 工单：工单、反馈、入口配置。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/support/tickets` | 操作 | ? |
| GET | `/api/hq/support/catalog` | 操作 | ? |
| GET | `/api/hq/support/tickets/{ticketId}` | 单体查询 / 操作 | ? |
| POST | `/api/hq/support/tickets` | 操作 | ? |
| POST | `/api/hq/support/tickets/{ticketId}/mutate` | 操作 | ? |
| GET | `/api/hq/support/feedback` | 操作 | ? |
| GET | `/api/hq/support/entry-config` | 操作 | ? |
| POST | `/api/hq/support/entry-config/mutate` | 操作 | ? |

### 2.27 trace  （3 个端点）

> 链路追踪 / 审计：调用链查询与审计。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/trace/catalog` | 操作 | ? |
| GET | `/api/hq/trace/by-request/{requestId}` | 单体查询 / 操作 | ? |
| GET | `/api/hq/trace/{traceId}` | 单体查询 / 操作 | ? |

### 2.28 training  （5 个端点）

> 培训：培训余额、反馈、目录、成员、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/training/balances` | 操作 | ? |
| GET | `/api/hq/training/feedback` | 操作 | ? |
| GET | `/api/hq/training/catalog` | 操作 | ? |
| GET | `/api/hq/training/members/{memberId}` | 单体查询 / 操作 | ? |
| POST | `/api/hq/training/mutate` | 操作 | ? |

### 2.29 transfers  （3 个端点）

> 转让 / 过户：转让申请目录、详情、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/transfers/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/transfers/{applicationId}` | 详情查询 | detail |
| POST | `/api/hq/transfers/{applicationId}/mutate` | 创建 / 更新（变更） | mutate |

### 2.30 users  （3 个端点）

> 总部用户 / 账号：用户目录、详情、变更。

| 方法 | 路径 | 说明 | 处理器 |
|---|---|---|---|
| GET | `/api/hq/users/catalog` | 分页 / 列表查询 | catalog |
| GET | `/api/hq/users/{accountId}` | 详情查询 | detail |
| POST | `/api/hq/users/{accountId}/mutate` | 创建 / 更新（变更） | mutate |
