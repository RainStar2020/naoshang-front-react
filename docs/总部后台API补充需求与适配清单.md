# 总部后台 API 补充需求与前端适配清单

日期：2026-10-29。交付对象：后端开发、前端开发、联调测试。
依据：当前项目全量API文档、实际 HQ 模块动作枚举、前端页面与 src/types、src/services/real。本文是需求提案，新增路径与字段不是现有接口承诺。类型附录为前端现有完整字段需求；不得据此认为后端已经支持。

## 1. 共通契约

- Base path /api/hq；Bearer 管理员会话，不混用 H5 或旧管理登录。
- 新增接口建议统一 v2：成功 {status:1,response:业务对象或null}；失败 {status:0,code:字符串,message:展示文案,response:null,errors:[{field,message}]}。现有写接口仍遵守原契约，新增接口版本启用规则需双方确定。
- 列表请求 pageNum:number>=1、pageSize:number（上限建议100），响应 list:数组、pageNum、pageSize、total、totalPages。现有 page/items 由前端适配，不能仅因信封升级就修改查询字段。
- ID 均 string；时间 ISO 8601 含时区；nullable 字段明确返回 null。金额需逐字段声明单位，前端历史金额为整数分，现有 HQ 金额可能为元，不能直接透传。
- 写入必填 reason:string、idempotencyKey:string；更新必填 version:number；新增版本规则由后端明确。支持 X-Reason、Idempotency-Key 时需明确与 Body 的优先级。
- 更新响应建议 {entity,operationId,requestId,version}；异步动作返回 {jobId,status} 并提供轮询。权限和 allowedActions 以后端为准。
- 错误建议：VALIDATION_ERROR、UNAUTHORIZED、FORBIDDEN、NOT_FOUND、VERSION_CONFLICT、IDEMPOTENCY_CONFLICT、INVALID_STATE；冲突时返回 currentVersion。响应暴露 X-Trace-Id。

## 2. 后端需要补充或扩展的能力

### 2.1 用户账号

建议扩展 POST /users/:accountId/mutate，保留现有 freeze/unfreeze/update-note。
- reset-password：newPassword:string 必填；version/reason/idempotencyKey 必填。返回 account（含 passwordResetAt）、operation；响应和审计不得包含密码。
- change-display-id：prefix:VIP|TS|SD|LC、serial:string（恰好4位数字，保留前导0）。返回 displayId、version、operation；编号唯一冲突需明确业务码。
- change-store：storeId:string、version。返回更新后的 account.storeId/storeName。当前前端将其写成 update-note，不等于修改归属门店，应补真实动作或明确转店流程的替代方案。

### 2.2 课程 CMS

课程内容维护与账号课程权益必须分离。当前 /course/entitlements 的 extend/freeze/unfreeze/revoke 不能承担课程发布或下架。
建议 GET /course/cms/catalog 返回 tiers:CmsTier[]、courses:CmsCourse[]、audit:CmsAudit[]。
建议 POST /course/cms/mutate：
- save-tier：targetId、version、value:{number,name,summary,coverUrl,benefits:RichContent}。
- save-course：targetId、version、value:{levelId,membershipTierId,number,name,summary,covers:string[],content:RichContent,chapters:CmsChapter[]}。
- publish/offline：targetId、version。
所有动作必填 reason/idempotencyKey。章节需要 id,title,type:article|video,order,accessibility,content,videoUrl,posterUrl。发布需保留 revision、publishedAt、draftVersion；下架不删除历史内容。完整类型见附录。

### 2.3 区域代理

缺少独立 HQ 模块；建议：
- GET /agents/catalog：planGroups、planNotes、territories；方案金额需明确单位，不能把方案展示费用当结算金额。
- GET /agents：keyword?、status?、territoryId?、分页；返回 RegionAgent[] 与 summary:{activeCount,suspendedCount,exclusiveTerritoryCount}。
- GET /agents/:agentId：agent、territories、audit。
- POST /agents/:agentId/mutate：action:suspend|resume、version、reason、idempotencyKey。
- POST /agents/territories/:territoryId/mutate：action:set-exclusivity、exclusive:boolean、version、reason、idempotencyKey。
Agent 必需 agentId/accountId/name/phone/partnerAccountId/partnerName/levelLabel/territoryIds/storeCount/status/version/allowedActions；区域需 territoryId/level/name/exclusive/holderAgentId/version。独占冲突返回 EXCLUSIVITY_CONFLICT。收益快照 commissionSnapshotCents 只有有可信数据源时返回，否则应改为 null 并同步前端类型。

### 2.4 商品字典与履约策略

- 建议 POST /products/categories/mutate：action:save-category、value:{categoryId,categoryLabel,order,enabled,version}、公共审计字段。
- 建议 POST /products/types/:code/mutate：action:rename-type、title:string、version、公共审计字段；code 为 PHYSICAL|ACTIVATION_CODE|OFFLINE_SERVICE|COLUMN_ACCESS，改名不改变履约编码。
- 建议 POST /delivery/policies/:productId/mutate：action:save-policy、deliveryMode:BOUND_STORE|HEADQUARTERS、version、公共审计字段；返回 productId/deliveryMode/deliveryLocked/version。明确新策略仅影响新订单还是可影响未履约订单，订单保留策略快照。

### 2.5 软件卡管理

现有 mutate 仅 void/update-note，页面需求明显更多；不能用作废或备注模拟交付。
建议新增或扩展：save-type、import、assign、deliver、retire、replace，字段按附录 SoftwareMutation。
- 卡类型：typeId/businessCode/name/termLabel/systemLabel/description/active/version。
- 导入：name/typeId/source/sourceName/referenceNo/codes:string[]/claimDeadline:null或ISO时间；需去重、最大批量和失败项结果。
- 分配：cards:[{cardId,version}]、accountId、deliveryMode:hq|store、deliveryStoreId、sourceOrderId。
- 交付/停发：cards；补发：oldCard/replacementCard。均需原因及幂等。
- 建议 POST /software-cards/exports：cards:[{cardId,version}]、reason/idempotencyKey；返回 csv/fileName/count 或受限下载凭证，记录导出审计。卡密只在授权导出时出现。
- 外部激活状态需供应商回执：externalStatus/externalValidUntil/externalCheckedAt；不能从交付状态推断已激活。

### 2.6 激活码操作与选择导出

已有批量生成接口和 mutate void/export。页面 issue/reissue/set-expiry 无直接对应能力，若保留页面，需补：
- issue：codes:[{codeId,version}]、accountId/memberId/storeId 可空，至少有效接收对象；返回发放去向与时间。
- reissue：codes、expiresAt；返回旧新码关联及各版本。
- set-expiry：codes、expiresAt:null或ISO时间；明确已使用码能否修改。
- revoke 应对接 void，但后端按完整 code 查找，前端只有 codeId；建议后端接收 codeId，不应要求普通列表暴露明文码。
- export 已存在但仅 batchId 或全量；建议扩展 codeIds:string[] 或 codes:[{codeId,version}]，必须只导出用户选择范围。响应 {codes:[{codeId,code,...}],count,operationId,requestId}，前端可转换 CSV。

### 2.7 支付任务文件

GET /payments/export 已有，是支付流水 CSV，不是某个对账任务原文件或差异文件。
若保留现有按钮，建议 GET /payments/jobs/:jobId/files/:kind，kind:source|differences；reason 必填；返回 {csv,fileName,contentType,rowCount} 或带到期时间的下载链接。不存在文件返回 NOT_FOUND；不得拿全量流水替代。
样例需求建议 GET /payments/reconciliation-sample?channel=WECHAT|ALIPAY&statementDate=YYYY-MM-DD，返回 csv/fileName/encoding/columns/schemaVersion；也可明确为前端生成模板，不新增接口。

### 2.8 素材真实上传（课程、专栏、公告、资料、商品、合伙人共用）

HQ columns/materials assets 目前是元数据登记；H5 upload-intents 示例上传地址不能作为生产上传服务验收。
建议 POST /assets/upload-intents（HQ base 下）：fileName/contentType/size/purpose 必填，purpose 明确业务枚举；可选 checksum。响应 assetId/uploadUrl/method/headers/formFields/expiresAt/maxSize/allowedContentTypes。
前端实际传文件后 POST /assets/:assetId/completions：checksum或etag；响应 {assetId,url,previewUrl,kind:image|video,contentType,size,status:ready}。失败不得回显成功或用 blob URL 冒充持久文件。签名请求与文件传输需明确管理员鉴权、CORS、大小限制与过期清理。

### 2.9 合伙人展示名称与收益操作

- save-level-names 在当前 partners upgrade/save-benefits 中无对应动作。建议扩展 names:[{partnerLevel,title,version}]、reason/idempotencyKey；编码不随展示名变化。
- 收益 request-recalc/request-reverse/reassign-allocation 不能直接等同 settle/adjust。需后端明确：recalc 返回 jobId、状态和重算范围；reverse 指定原 entryId、version，返回冲正流水；reassign 指定 entryId 与目标归属，保留变更前后审计。具体前端字段见 IncomeMutation 附录，不应在未确认规则前新增金额计算。

## 3. 已有接口但前端仍须适配

这些属于前端工作，不应重复让后端新增同义接口：
- 专栏 save/publish/offline、新建 columnId：操作名已修正；目录/详情/记录 DTO 仍需完整对照。
- 支付 save-channel/query/compensate/reconcile 已修正动作名；catalog channels/recentJobs 与页面 configs/jobs，以及列表、详情 attempts 需要组装；不能只 cast 为页面类型。
- 激活码 batches 生成、void、export：按真实动作/参数/返回结构重写适配，普通发放与补发属于上一节缺口。
- 合伙人 upgrade 当前仍映射 promote，与后端 upgrade 不一致，需要改；目录、升级回执需对照 DTO。
- 员工角色前端 update/assign-store 与后端 update-role 等有差异，需逐分支核对 staffId、角色绑定字段，不能默认 update。
- 课程发布/下架当前错误映射 grant/revoke，应改接 CMS 能力，不能影响账号学习权益。
- 收益、软件卡等动作存在相同语义错配风险，以上述后端真实枚举为准；支持调用和正确业务效果要分别验收。
- API 双信封已经支持；14模块版本头按实际 GET 路由匹配。分页、ID、金额、DTO 仍需逐接口验收。

## 4. 验收条件与未决项

- 每个页面空数据、成功、401/403、字段校验、版本冲突与幂等重放均有验证；修改后详情及列表回读一致，不能只看 HTTP 200。
- 导出范围必须等于选择范围；真实上传持久化后重新登录仍可访问；发布与账号授权分别验证。
- API 模式不使用演示数据；未注册 Pricing.tsx 仍有 mock，若未来开放路由必须先接真实商品/价格接口。
- 本清单来自静态代码和文档核查，未完成带真实账号的全部联调。后端需确认新增能力的权限、业务规则、金额单位及路径，前端据确认契约实现。

## 5. 前端字段类型附录

以下为当前前端类型原文，供后端逐字段确认，包含现有、待适配及拟补充字段；不是要求照搬 mockOnly 等演示标记。import 的关联类型可在 src/types 同名文件查阅。

### users

```typescript
/** HQ-02 总部 DTO 草案。accountId 对应小程序 profile.id；不得混用 memberId。 */
export interface BusinessIdentity {
  contextId: string
  module: 'partner' | 'agency' | 'costore'
  label: string
  assignmentId?: string
  contractId?: string
}
/** 用户对外编号前缀：仅允许下拉四项。完整编号 = 前缀 + 恰好 4 位数字。 */
export const userDisplayIdPrefixes = ['VIP', 'TS', 'SD', 'LC'] as const
export type UserDisplayIdPrefix = typeof userDisplayIdPrefixes[number]
export const USER_DISPLAY_ID_PATTERN = /^(VIP|TS|SD|LC)\d{4}$/
export interface UserAccount {
  accountId: string
  displayId: string
  nickname: string
  avatarUrl: string | null
  phone: string
  regionCodes: string[]
  regionNames: string[]
  storeId: string | null
  storeName: string | null
  frozen: boolean
  version: number
  businessContexts: BusinessIdentity[]
  createdAt: string
  passwordResetAt: string | null
}
export interface StoreOption { storeId: string; name: string; number: string; active: boolean }
export interface RegionOption { value: string; label: string; children?: RegionOption[] }
export interface UserFilters {
  keyword?: string
  regionCodes?: string[]
  storeId?: string
  status?: 'active' | 'frozen'
}
export interface UserListQuery extends UserFilters { page: number; pageSize: number }
export interface UserListResult { items: UserAccount[]; total: number; page: number; pageSize: number }
export interface UserFilterOptions { stores: StoreOption[]; regions: RegionOption[] }
interface MutationBase { accountId: string; version: number; reason: string; idempotencyKey: string }
export type UserMutation =
  | (MutationBase & { action: 'freeze'; frozen: boolean })
  | (MutationBase & { action: 'change-store'; storeId: string })
  | (MutationBase & { action: 'reset-password'; newPassword: string })
  | (MutationBase & { action: 'change-display-id'; prefix: UserDisplayIdPrefix; serial: string })
export interface UserAuditEntry {
  operationId: string
  requestId: string
  accountId: string
  action: UserMutation['action']
  operatorId: string
  operatorName: string
  reason: string
  before: string
  after: string
  occurredAt: string
}
export interface UserDetail { account: UserAccount; audit: UserAuditEntry[] }
export interface UserMutationResult { account: UserAccount; operation: UserAuditEntry; mockOnly: boolean }
export type UserErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'VERSION_CONFLICT' | 'INVALID_INPUT' | 'IDEMPOTENCY_CONFLICT'
export class UserServiceError extends Error {
  constructor(public code: UserErrorCode, message: string) { super(message); this.name = 'UserServiceError' }
}

```

### agents

```typescript
import type { HqAccount } from './auth'
export type AgentStatus = 'ACTIVE' | 'SUSPENDED' | 'EXITED'
export type TerritoryLevel = 'PROVINCE' | 'CITY' | 'DISTRICT'
export class AgentError extends Error {
  code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'EXCLUSIVITY_CONFLICT'
  constructor(code: AgentError['code'], message: string) {
    super(message)
    this.code = code
  }
}
/** 区域档位方案参考（万元展示字段，非结算回执）。 */
export interface AgentPlanRow {
  id: string
  positioning: string
  name: string
  population?: string
  fee: { tech: number; device: number; deposit: number; total: number }
  vipPartner: string
  regionCommission: string
  virtualProduct: string
  physicalProduct: string
}
export interface AgentPlanGroup {
  id: string
  label: string
  rows: AgentPlanRow[]
}
export interface AgentTerritory {
  territoryId: string
  level: TerritoryLevel
  name: string
  /** 独占：同级同名区域仅允许一名生效代理 */
  exclusive: boolean
  holderAgentId: string | null
  version: number
}
export interface RegionAgent {
  agentId: string
  accountId: string
  name: string
  phone: string
  partnerAccountId: string | null
  partnerName: string | null
  levelLabel: string
  territoryIds: string[]
  storeCount: number
  status: AgentStatus
  /** 累计佣金仅为演示快照（分），禁止当作结算终态 */
  commissionSnapshotCents: number
  version: number
  allowedActions: ('suspend' | 'resume' | 'set-exclusivity')[]
}
export interface AgentAudit {
  operationId: string
  requestId: string
  action: 'suspend' | 'resume' | 'set-exclusivity'
  targetId: string
  operatorId: string
  operatorName: string
  reason: string
  before: string
  after: string
  occurredAt: string
}
export interface AgentQuery {
  keyword?: string
  status?: AgentStatus
  territoryId?: string
  page: number
  pageSize: number
}
export interface AgentList {
  items: RegionAgent[]
  total: number
  page: number
  pageSize: number
  summary: { activeCount: number; suspendedCount: number; exclusiveTerritoryCount: number }
}
export interface AgentCatalog {
  planGroups: AgentPlanGroup[]
  planNotes: { title: string; items: string[] }[]
  territories: AgentTerritory[]
  agents: RegionAgent[]
}
export interface AgentDetail {
  agent: RegionAgent
  territories: AgentTerritory[]
  audit: AgentAudit[]
}
export type AgentMutation =
  | { action: 'suspend' | 'resume'; agentId: string; reason: string; version: number; idempotencyKey: string }
  | { action: 'set-exclusivity'; territoryId: string; exclusive: boolean; reason: string; version: number; idempotencyKey: string }
export type AgentOperator = Pick<HqAccount, 'accountId' | 'nickname'>

```

### cms

```typescript
export type RichTag = 'p' | 'div' | 'span' | 'strong' | 'b' | 'em' | 'i' | 'u' | 's' | 'br' | 'h2' | 'h3' | 'ul' | 'ol' | 'li' | 'blockquote' | 'img' | 'video'
export type ContentNode = { type: 'text'; text: string } | { name: RichTag; attrs: { style?: string; src?: string; alt?: string; poster?: string; controls?: string }; children: ContentNode[] }
export interface RichContent { version: 1; format: 'nodes'; nodes: ContentNode[] }
export interface CmsTier { membershipTierId: string; number: number; name: string; summary: string; coverUrl: string; benefits: RichContent; version: number }
export interface CmsChapter { id: string; title: string; type: 'article' | 'video'; order: number; accessibility: 'membership-required'; content: RichContent; videoUrl: string; posterUrl: string }
export interface CmsCourseDraft { levelId: string; membershipTierId: string; number: number; name: string; summary: string; covers: string[]; content: RichContent; chapters: CmsChapter[] }
export interface CmsPublication { revision: number; publishedAt: string; draftVersion: number; tierName: string; course: CmsCourseDraft }
export interface CmsCourse { draft: CmsCourseDraft; version: number; status: 'draft' | 'published' | 'offline'; publication: CmsPublication | null }
export interface CmsAudit { operationId: string; requestId: string; targetId: string; action: 'save-tier' | 'save-course' | 'publish' | 'offline'; operatorId: string; operatorName: string; reason: string; occurredAt: string; beforeVersion: number; afterVersion: number }
export interface CmsCatalog { tiers: CmsTier[]; courses: CmsCourse[]; audit: CmsAudit[] }
export type CmsMutation =
  | { action: 'save-tier'; targetId: string; version: number; value: Omit<CmsTier, 'membershipTierId' | 'version'>; reason: string; idempotencyKey: string }
  | { action: 'save-course'; targetId: string; version: number; value: CmsCourseDraft; reason: string; idempotencyKey: string }
  | { action: 'publish' | 'offline'; targetId: string; version: number; reason: string; idempotencyKey: string }
export interface CmsAsset { assetId: string; url: string; previewUrl: string; kind: 'image' | 'video'; mockOnly: boolean }
export class CmsError extends Error {
  constructor(public code: 'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_STATE', message: string) { super(message); this.name = 'CmsError' }
}

```

### columns

```typescript
import type { CmsAsset, CmsChapter, RichContent } from './cms'
/** HQ-07 草案。专栏归属账号，不使用孩子memberId/contextId。 */
export type ColumnChapter = Omit<CmsChapter, 'accessibility'> & { accessibility: 'column-required' }
export interface ColumnDraft { columnId: string; productId: string; title: string; summary: string; coverUrl: string; content: RichContent; chapters: ColumnChapter[] }
export interface ColumnPublication { revision: number; publishedAt: string; draftVersion: number; column: ColumnDraft }
export interface ManagedColumn { draft: ColumnDraft; version: number; status: 'draft' | 'published' | 'offline'; publication: ColumnPublication | null }
export interface ColumnProduct { productId: string; title: string; fulfillmentType: 'COLUMN_ACCESS'; mockOnly: boolean }
export interface ColumnOrder { orderId: string; orderNo: string; accountId: string; columnId: string; productId: string; paymentStatus: 'PAID' | 'PENDING_PAYMENT'; fulfillmentStatus: 'PENDING_DELIVERY' | 'DELIVERED'; payableAmount: number; createdAt: string; mockOnly: boolean }
export interface ColumnGrant { accountId: string; columnId: string; unlocked: true; sourceCodeId: string | null; activatedAt: string; expiresAt: null; version: number }
export interface ColumnProgress { accountId: string; columnId: string; chapterId: string; positionSeconds: number; durationSeconds: number; percent: number; completed: boolean; lastStudiedAt: string; version: number }
export interface ColumnAccountRecord { accountId: string; nickname: string; phone: string; purchaseCount: number; pendingPurchaseCount: number; grant: ColumnGrant | null; progress: ColumnProgress[] }
export interface ColumnRecords { accounts: ColumnAccountRecord[]; orders: ColumnOrder[] }
export interface ColumnAudit { operationId: string; requestId: string; action: 'save' | 'publish' | 'offline'; columnId: string; operatorId: string; operatorName: string; reason: string; beforeVersion: number; afterVersion: number; occurredAt: string }
export interface ColumnCatalog { columns: ManagedColumn[]; products: ColumnProduct[]; audit: ColumnAudit[]; accounts: { accountId: string; nickname: string; phone: string }[] }
export type ColumnMutation = { reason: string; idempotencyKey: string; columnId: string; version: number } & ({ action: 'save'; value: ColumnDraft } | { action: 'publish' | 'offline' })
export type ColumnUploadResult = CmsAsset
export interface ColumnProgressWrite { accountId: string; columnId: string; chapterId: string; positionSeconds: number; durationSeconds: number; completed: boolean; ended: boolean; version: number; idempotencyKey: string }
export class ColumnError extends Error {
  constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'PURCHASE_REQUIRED' | 'ALREADY_UNLOCKED', message: string) { super(message); this.name = 'ColumnError' }
}

```

### products

```typescript
import type { RichContent } from './cms'
export const fulfillmentTypes = ['PHYSICAL', 'ACTIVATION_CODE', 'OFFLINE_SERVICE', 'COLUMN_ACCESS'] as const
export type FulfillmentType = typeof fulfillmentTypes[number]
export interface ProductCategory { categoryId: string; categoryLabel: string; order: number; enabled: boolean; version: number }
export interface ProductType { code: FulfillmentType; title: string; version: number }
export interface ProductSpecGroup { id: string; label: string; options: { id: string; label: string }[] }
/** 所有金额均为整数分；discountLabel为展示文字，禁止据此推算实付。 */
export interface ProductPriceTier { id: string; label: string; discountLabel: string; amount: number }
export interface ProductSku { id: string; label: string; specs: Record<string, string>; amount: number; stock: number }
export interface ProductDraft { productId: string; categoryId: string; title: string; summary: string; coverUrl: string; content: RichContent; fulfillmentType: FulfillmentType; requiresMember: boolean; pricePresentation: 'standard-only' | 'tiered'; costAmount: number; originalAmount: number | null; standardAmount: number; activityAmount: number | null; memberPrices: ProductPriceTier[]; rolePrices: ProductPriceTier[]; specGroups: ProductSpecGroup[]; skus: ProductSku[] }
export interface ManagedProduct { draft: ProductDraft; version: number; status: 'draft' | 'on-sale' | 'off-sale'; publication: { revision: number; publishedAt: string; value: ProductDraft } | null }
export interface ProductAudit { operationId: string; targetId: string; action: ProductMutation['action']; reason: string; requestId: string; operatorName: string; beforeVersion: number; afterVersion: number; occurredAt: string }
export interface ProductCatalog { categories: ProductCategory[]; types: ProductType[]; products: ManagedProduct[]; audit: ProductAudit[] }
export type ProductMutation = { version: number; reason: string; idempotencyKey: string } & (
  { action: 'save-category'; value: ProductCategory } | { action: 'rename-type'; code: FulfillmentType; title: string } |
  { action: 'save-product'; value: ProductDraft } | { action: 'on-sale' | 'off-sale'; productId: string })
export class ProductError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) { super(message); this.name = 'ProductError' } }

```

### delivery

```typescript
import type { OrderTransactionSnapshot } from './orders'
import type { FulfillmentType } from './products'
export type DeliveryPolicyMode = 'BOUND_STORE' | 'HEADQUARTERS'
export interface DeliveryPolicy { productId: string; deliveryMode: DeliveryPolicyMode; deliveryLocked: boolean; version: number }
export interface DeliveryAddress { recipient: string; phone: string; regionNames: string[]; detail: string }
export interface DeliveryLogistics { carrier: string; trackingNo: string }
export interface DeliveryOrder { orderId: string; orderNo: string; accountId: string; productId: string; productTitle: string; fulfillmentType: FulfillmentType; paymentStatus: 'PAID' | 'PENDING_PAYMENT' | 'CANCELLED'; fulfillmentStatus: 'WAIT_DELIVERY' | 'DELIVERED' | 'WAIT_SHIP' | 'SHIPPED'; deliveryMode: 'HEADQUARTERS' | 'STORE'; deliveryStoreId: string | null; deliveryStoreName: string; deliveryLocked: boolean; version: number; createdAt: string; paidAt: string | null; deliveredAt: string | null; shippedAt: string | null; address: DeliveryAddress | null; logistics: DeliveryLogistics | null; mockOnly: boolean; transaction: OrderTransactionSnapshot | null }
export type DeliveryAction = 'change-delivery' | 'ship' | 'update-logistics'
export interface ManagedDeliveryOrder extends DeliveryOrder { allowedActions: DeliveryAction[] }
export interface DeliveryAudit { operationId: string; requestId: string; action: DeliveryMutation['action'] | 'confirm-delivery'; targetId: string; operatorId: string; operatorName: string; reason: string; before: string; after: string; beforeVersion: number; afterVersion: number; occurredAt: string }
export interface DeliveryCatalog { policies: DeliveryPolicy[]; products: { productId: string; title: string; fulfillmentType: FulfillmentType; status: string }[]; stores: { storeId: string; name: string; active: boolean }[]; accounts: { accountId: string; nickname: string; phone: string }[]; orders: ManagedDeliveryOrder[]; audit: DeliveryAudit[] }
export type DeliveryMutation = { version: number; reason: string; idempotencyKey: string } & (
 { action: 'save-policy'; productId: string; deliveryMode: DeliveryPolicyMode } |
 { action: 'change-delivery'; orderId: string; selectedStoreId: string } |
 { action: 'ship' | 'update-logistics'; orderId: string; logistics: DeliveryLogistics })
export interface CheckoutDeliveryOptions { productId: string; accountId: string; productRevision: number; policyVersion: number; defaultStoreId: string | null; deliveryLocked: boolean; stores: { id: string; name: string }[] }
export class DeliveryError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) { super(message); this.name = 'DeliveryError' } }

```

### activationCodes

```typescript
import type { StoreOption } from './users'
/** HQ-05 草案；与软件卡发码、总部人工学习授权分别建模。 */
export type ActivationCodeType = 'membership-tier' | 'column'
export type ActivationStatus = 'unused' | 'issued' | 'used' | 'revoked' | 'expired'
export interface ActivationCode {
  codeId: string; batchId: string; maskedCode: string; codeType: ActivationCodeType; targetId: string; targetName: string
  status: ActivationStatus; expiresAt: string | null; version: number
  issuedTo: string | null; issuedToAccountId: string | null; issuedToMemberId: string | null; storeId: string | null; issuedAt: string | null
  usedByAccountId: string | null; usedByMemberId: string | null; usedAt: string | null; sourceOrderId: string | null
  replacementCodeId: string | null; replacesCodeId: string | null; createdAt: string
}
export interface ActivationBatch { batchId: string; name: string; codeType: ActivationCodeType; targetId: string; targetName: string; quantity: number; expiresAt: string | null; createdAt: string; createdBy: string }
export interface ActivationAudit { operationId: string; requestId: string; action: 'generate' | 'issue' | 'revoke' | 'reissue' | 'set-expiry' | 'export' | 'activate'; codeIds: string[]; batchId: string | null; reason: string; operatorId: string; operatorName: string; before: string; after: string; occurredAt: string }
export interface ActivationFilters { keyword?: string; batchId?: string; codeType?: ActivationCodeType; targetId?: string; status?: ActivationStatus; storeId?: string }
export interface ActivationQuery extends ActivationFilters { page: number; pageSize: number }
export interface ActivationList { items: ActivationCode[]; total: number; page: number; pageSize: number }
export interface ActivationOptions {
  targets: { codeType: ActivationCodeType; targetId: string; name: string; demoOnly: boolean }[]
  accounts: { accountId: string; name: string; phone: string }[]
  members: { memberId: string; accountId: string; contextId: string; name: string; displayId: string }[]
  stores: StoreOption[]
  maxBatchSize: number; maxSelectionSize: number
}
export interface CodeSelection { codeId: string; version: number }
interface OperationBase { reason: string; idempotencyKey: string }
export type ActivationMutation = OperationBase & (
  | { action: 'generate'; name: string; codeType: ActivationCodeType; targetId: string; quantity: number; expiresAt: string | null }
  | { action: 'issue'; codes: CodeSelection[]; accountId: string | null; memberId: string | null; storeId: string | null }
  | { action: 'revoke'; codes: CodeSelection[] }
  | { action: 'set-expiry'; codes: CodeSelection[]; expiresAt: string | null }
  | { action: 'reissue'; codes: CodeSelection[]; expiresAt: string | null }
)
export interface ActivationMutationResult { batchId: string | null; affectedCodeIds: string[]; operation: ActivationAudit; mockOnly: boolean }
export interface ActivationDetail { code: ActivationCode; batch: ActivationBatch; audit: ActivationAudit[] }
export interface ActivationExportRequest extends OperationBase { codes: CodeSelection[] }
export interface ActivationExport { csv: string; fileName: string; count: number; requestId: string; mockOnly: boolean }
export class ActivationError extends Error {
  constructor(public code: 'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'IDENTITY_MISMATCH' | 'EXPIRED' | 'CONSUMER_UNAVAILABLE', message: string) { super(message); this.name = 'ActivationError' }
}

```

### softwareCards

```typescript
import type { StoreOption } from './users'
/** HQ-06 独立软件卡契约草案；不复用会员/专栏激活码，也不作为学习授权。 */
export interface SoftwareCardType { typeId: string; businessCode: string; name: string; termLabel: string; systemLabel: string; description: string; active: boolean; version: number }
export type SoftwareStockStatus = 'available' | 'assigned' | 'delivered' | 'retired' | 'replaced'
export const softwareStockLabels: Record<SoftwareStockStatus, string> = { available: '可分配库存', assigned: '已分配待交付', delivered: '已记录交付', retired: '库存已停发', replaced: '已补发停发' }
export interface SoftwareCard {
  cardId: string; batchId: string; typeId: string; typeName: string; maskedCode: string; status: SoftwareStockStatus; version: number
  claimDeadline: string | null; claimExpired: boolean
  /** 只能由供应商接口/可信回执更新；本轮Mock始终unknown，不能从交付状态推断。 */
  externalStatus: 'unknown' | 'inactive' | 'active' | 'expired'; externalValidUntil: string | null; externalCheckedAt: string | null
  deliveryMode: 'hq' | 'store' | null; deliveryStoreId: string | null; accountId: string | null; accountName: string | null; sourceOrderId: string | null
  assignedAt: string | null; deliveredAt: string | null; secretExportedAt: string | null
  replacesCardId: string | null; replacementCardId: string | null; createdAt: string
}
export interface SoftwareBatch { batchId: string; name: string; typeId: string; typeName: string; source: 'supplier' | 'hq' | 'mock'; sourceName: string; referenceNo: string; quantity: number; claimDeadline: string | null; createdAt: string; createdBy: string }
export interface SoftwareOrderOption { orderId: string; orderNo: string; accountId: string; typeId: string; fulfillmentType: 'ACTIVATION_CODE'; status: 'PAID' | 'PENDING_PAYMENT'; quantity: number; remainingQuantity: number; deliveryMode: 'hq' | 'store'; deliveryStoreId: string | null; mockOnly: boolean }
export interface SoftwareOptions { maxImportSize: number; maxSelectionSize: number; accounts: { accountId: string; name: string; phone: string; storeId: string | null }[]; stores: StoreOption[]; orders: SoftwareOrderOption[] }
interface OperationBase { reason: string; idempotencyKey: string }
export interface SoftwareSelection { cardId: string; version: number }
export type SoftwareMutation = OperationBase & (
  | { action: 'save-type'; typeId: string; version: number; value: Omit<SoftwareCardType, 'typeId' | 'version'> }
  | { action: 'import'; name: string; typeId: string; source: SoftwareBatch['source']; sourceName: string; referenceNo: string; codes: string[]; claimDeadline: string | null }
  | { action: 'assign'; cards: SoftwareSelection[]; accountId: string; deliveryMode: 'hq' | 'store'; deliveryStoreId: string | null; sourceOrderId: string | null }
  | { action: 'deliver' | 'retire'; cards: SoftwareSelection[] }
  | { action: 'replace'; oldCard: SoftwareSelection; replacementCard: SoftwareSelection }
)
export interface SoftwareAudit { operationId: string; requestId: string; action: SoftwareMutation['action'] | 'export'; cardIds: string[]; batchId: string | null; typeId: string | null; reason: string; operatorId: string; operatorName: string; before: string; after: string; occurredAt: string }
export interface SoftwareFilters { keyword?: string; batchId?: string; typeId?: string; status?: SoftwareStockStatus; deliveryMode?: 'hq' | 'store'; storeId?: string; accountId?: string; claimState?: 'expired' | 'valid' }
export interface SoftwareQuery extends SoftwareFilters { page: number; pageSize: number }
export interface SoftwareList { items: SoftwareCard[]; total: number; page: number; pageSize: number }
export interface SoftwareCatalog { types: SoftwareCardType[]; batches: SoftwareBatch[]; audit: SoftwareAudit[]; options: SoftwareOptions }
export interface SoftwareDetail { card: SoftwareCard; batch: SoftwareBatch; type: SoftwareCardType; audit: SoftwareAudit[] }
export interface SoftwareMutationResult { batchId: string | null; cardIds: string[]; operation: SoftwareAudit; mockOnly: boolean }
export interface SoftwareExportRequest extends OperationBase { cards: SoftwareSelection[] }
export interface SoftwareExport { csv: string; fileName: string; count: number; mockOnly: boolean }
export class SoftwareCardError extends Error {
  constructor(public code: 'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'EXTERNAL_VERIFICATION_REQUIRED', message: string) { super(message); this.name = 'SoftwareCardError' }
}

```

### payments

```typescript
export type PaymentChannel = 'WECHAT' | 'ALIPAY'
export type PaymentPlatform = 'MINI_PROGRAM' | 'H5'
export type PaymentBusiness = 'MALL' | 'MEMBERSHIP' | 'BUSINESS'
export interface PaymentChannelConfig { configId: string; platform: PaymentPlatform; business: PaymentBusiness; channel: PaymentChannel; enabled: boolean; version: number }
export interface ChannelVerification { status: 'SUCCESS' | 'PENDING' | 'CLOSED' | 'MISMATCH' | 'UNAVAILABLE'; amount: number | null; channelTradeNo: string | null; checkedAt: string; detail: string }
export interface PaymentRecord { paymentId: string; orderId: string; orderNo: string; accountId: string; channel: PaymentChannel; platform: PaymentPlatform; business: PaymentBusiness; status: 'WAITING' | 'SUCCESS' | 'CLOSED'; amount: number; paidAt: string | null; channelTradeNo: string | null; statementDate: string; createdAt: string; verification: ChannelVerification | null }
export interface PaymentAttempt { attemptId: string; paymentId: string; orderId: string; channel: PaymentChannel; platform: PaymentPlatform; status: 'WAITING' | 'SUCCESS' | 'CLOSED'; createdAt: string; requestId: string }
export interface ReconciliationDifference { id: string; paymentId: string; reason: 'CHANNEL_ONLY' | 'LOCAL_ONLY' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH' | 'TRADE_NO_MISMATCH'; localAmount: number | null; channelAmount: number | null; detail: string }
export interface PaymentJob { jobId: string; reconciliationJobId: string | null; kind: 'query' | 'compensate' | 'reconcile'; paymentId: string | null; status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED'; requestId: string; operatorName: string; reason: string; createdAt: string; completedAt: string | null; result: string; receiptId: string | null; fileName: string | null; channel: PaymentChannel | null; statementDate: string | null; differences: ReconciliationDifference[]; mockOnly: boolean }
export interface PaymentAudit { operationId: string; requestId: string; action: 'save-channel' | 'query' | 'compensate' | 'reconcile' | 'download'; targetId: string; operatorName: string; reason: string; detail: string; occurredAt: string }
export interface PaymentCatalog { configs: PaymentChannelConfig[]; payments: PaymentRecord[]; attempts: PaymentAttempt[]; jobs: PaymentJob[]; audit: PaymentAudit[] }
export type PaymentMutation = { reason: string; idempotencyKey: string } & ({ action: 'save-channel'; configId: string; version: number; enabled: boolean } | { action: 'query' | 'compensate'; paymentId: string } | { action: 'reconcile'; channel: PaymentChannel; statementDate: string; fileName: string; csv: string })
export interface PaymentMutationResult { jobId: string | null; configId: string | null }
export interface PaymentDownload { csv: string; fileName: string; mockOnly: boolean }
export class PaymentError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) { super(message); this.name = 'PaymentError' } }

```

### partners

```typescript
import type { RichContent } from './cms'
export const partnerLevels = ['DEMO-VIP', 'DEMO-ANGEL', 'DEMO-BOARD', 'DEMO-FOUNDER'] as const
export type PartnerLevel = typeof partnerLevels[number]
/** 稳定编码 DEMO-*；title 为可配置展示名（默认 VIP/天使/私董/联创）。 */
export interface PartnerLevelBenefits { partnerLevel: PartnerLevel; title: string; wholesaleLabel: string; quotaOccupancy: number; nextLevel: PartnerLevel | null; taskTarget: number | null; summary: string; content: RichContent; version: number }
export interface PartnerPromotionTask { taskId: string; version: number; beforeLevel: PartnerLevel; targetLevel: PartnerLevel; progress: number; target: number; canClaim: boolean; startedAt: string; validUntil: string; status: 'IN_PROGRESS' | 'READY' | 'PROCESSING' | 'COMPLETED' | 'EXPIRED' | 'SUPERSEDED'; qualificationNote: string }
export interface PartnerProfile { contextId: string; accountId: string; displayId: string; name: string; phone: string; partnerLevel: PartnerLevel; partnerStatus: 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'PENDING_ANNUAL'; frozen: boolean; annualStatus: 'ACTIVE' | 'EXPIRED' | 'NOT_OPEN'; annualValidUntil: string | null; annualFeeAmount: 20000; superior: { accountId: string; contextId: string | null; name: string } | null; version: number; allowedActions: ('manual-upgrade' | 'claim-promotion')[]; allowedTargetLevels: PartnerLevel[]; task: PartnerPromotionTask | null }
export interface PartnerReceipt { receiptId: string; requestId: string; contextId: string; accountId: string; source: 'HQ_MANUAL' | 'USER_TASK'; taskId: string | null; beforeLevel: PartnerLevel; targetLevel: PartnerLevel; status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED'; result: string; reason: string; operatorName: string; createdAt: string; completedAt: string | null; mockOnly: boolean }
export interface PartnerAudit { operationId: string; requestId: string; action: 'upgrade' | 'save-benefits' | 'save-level-names' | 'task-promotion'; contextId: string | null; targetId: string; operatorName: string; reason: string; before: string; after: string; occurredAt: string }
export interface PartnerCatalog { levels: PartnerLevelBenefits[]; receipts: PartnerReceipt[]; audit: PartnerAudit[] }
export interface PartnerQuery { page: number; pageSize: number; keyword?: string; partnerLevel?: PartnerLevel; partnerStatus?: PartnerProfile['partnerStatus'] }
export interface PartnerList { items: PartnerProfile[]; total: number; page: number; pageSize: number; summary: { total: number; active: number; frozen: number; annualExpired: number } }
export interface PartnerDetail { profile: PartnerProfile; taskHistory: PartnerPromotionTask[]; receipts: PartnerReceipt[]; audit: PartnerAudit[] }
export type PartnerLevelNameInput = { partnerLevel: PartnerLevel; title: string; version: number }
export type PartnerMutation =
  | { action: 'upgrade'; contextId: string; targetLevel: PartnerLevel; version: number; reason: string; idempotencyKey: string }
  | { action: 'save-benefits'; partnerLevel: PartnerLevel; summary: string; content: RichContent; version: number; reason: string; idempotencyKey: string }
  | { action: 'save-level-names'; names: PartnerLevelNameInput[]; reason: string; idempotencyKey: string }
export interface PartnerMutationResult { receiptId: string | null; operationId: string }
export class PartnerError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) { super(message); this.name = 'PartnerError' } }

```

### income

```typescript
/** HQ-22 收益联查、提点分配、结算重算与冲正。字段对齐小程序 incomeEntry / allocation / income-detail；金额为整数分；公式与比例仅展示服务端回传，前端不算佣。 */
export type IncomeModule = 'wholesale' | 'costore' | 'agency'
export type IncomeChannel = 'B' | 'C' | 'SUPPLY' | 'GLOBAL_AWARD' | 'FOUNDER_AWARD'
export type AllocationStatus = 'PENDING' | 'ALLOCATED'
export type AllocationKind = 'sales' | 'inspection'
export type SettlementStatus =
  | 'PENDING_ALLOCATION'
  | 'PENDING_SETTLEMENT'
  | 'SETTLED'
  | 'RECALC_PENDING'
  | 'REVERSED'
export type IncomeEntryKind = 'ORIGINAL' | 'RECALC' | 'REVERSAL'
export interface IncomeEntry {
  entryId: string
  kind: IncomeEntryKind
  /** 冲正/重算关联的原流水；原单为 null */
  relatedEntryId: string | null
  sourceOrder: string
  title: string
  category: string
  channel: IncomeChannel
  module: IncomeModule
  identityLabel: string
  accountId: string
  accountName: string
  phone: string
  storeId: string | null
  storeName: string | null
  regionLabel: string | null
  /** 金额（分，可为负：冲正流水） */
  amount: number
  baseAmount: number
  /** 业务提点基点，仅展示，前端不得据此重算 */
  rateBps: number
  allocationStatus: AllocationStatus
  allocationKind: AllocationKind
  allocationTarget: string | null
  allocationAgentId: string | null
  beneficiaryName: string
  settlementStatus: SettlementStatus
  pendingNote: string | null
  createdAt: string
  settledAt: string | null
  version: number
  mockOnly: boolean
  allowedActions: ('reassign-allocation' | 'request-recalc' | 'request-reverse')[]
}
export interface IncomeAudit {
  operationId: string
  requestId: string
  action: IncomeMutation['action']
  targetId: string
  relatedEntryId: string | null
  before: string
  after: string
  reason: string
  operatorId: string
  operatorName: string
  occurredAt: string
  beforeVersion: number
  afterVersion: number
}
export interface IncomeQuery {
  page: number
  pageSize: number
  keyword?: string
  module?: IncomeModule
  channel?: IncomeChannel
  allocationStatus?: AllocationStatus
  settlementStatus?: SettlementStatus
  storeId?: string
  accountId?: string
}
export interface IncomeList {
  items: IncomeEntry[]
  total: number
  page: number
  pageSize: number
  summary: {
    entries: number
    pendingAllocation: number
    pendingSettlement: number
    settled: number
    recalcPending: number
    reversed: number
    /** 分 */
    settledAmount: number
    pendingAmount: number
  }
}
export interface IncomeCatalog {
  stores: { storeId: string; name: string }[]
  modules: { value: IncomeModule; label: string }[]
  channels: { value: IncomeChannel; label: string }[]
  allocationTargets: { value: string; label: string; kind: AllocationKind | 'both' }[]
  settlementStatuses: { value: SettlementStatus; label: string }[]
  engineGapNote: string
  audit: IncomeAudit[]
  mockOnly: boolean
}
export interface IncomeDetail {
  entry: IncomeEntry
  /** 关联流水（冲正/重算子单或指向的原单） */
  related: IncomeEntry[]
  audit: IncomeAudit[]
  engineGapNote: string
}
export type IncomeMutation =
  | {
      action: 'reassign-allocation'
      entryId: string
      version: number
      targetId: string
      agentId?: string
      reason: string
      idempotencyKey: string
    }
  | {
      action: 'request-recalc'
      entryId: string
      version: number
      reason: string
      idempotencyKey: string
    }
  | {
      action: 'request-reverse'
      entryId: string
      version: number
      reason: string
      idempotencyKey: string
    }
export type IncomeMutationResult =
  | { action: 'reassign-allocation'; entry: IncomeEntry; mockOnly: boolean }
  | { action: 'request-recalc'; entry: IncomeEntry; linked: IncomeEntry; mockOnly: boolean }
  | { action: 'request-reverse'; entry: IncomeEntry; linked: IncomeEntry; mockOnly: boolean }
export class IncomeError extends Error {
  constructor(
    public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT',
    message: string,
  ) {
    super(message)
    this.name = 'IncomeError'
  }
}

```
