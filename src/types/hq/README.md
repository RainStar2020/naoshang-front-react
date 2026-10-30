# 总部后台 API 类型

来源：用户提供的《后台API.md》2026-10-28 v1.0，基础路径 `/api/hq`。
按 HQ-01 至 HQ-26 分为 26 个业务模块，`index.ts` 统一导出，`HqEndpoints` 收录全部 120 个端点。

## 使用

```ts
import type { LoginRequest, LoginResponse, UsersMutationRequest, HqEndpoints } from './index'

const login: LoginRequest = { username: 'admin', password: 'example' }
const update: UsersMutationRequest = {
  body: { action: 'update-note', note: '已联系', reason: '客服回访' },
}
const freeze: UsersMutationRequest = {
  body: { action: 'freeze', version: 1 },
  headers: { 'X-Reason': '风险处置', 'Idempotency-Key': 'unique-key' },
}
type LoginResult = HqEndpoints['POST /auth/login']['response']
```

`MutationRequest` 表示 body 与 headers 组成的请求配置，保证 reason 至少存在于一处。
`Endpoint` 的 body 与 headers 用于分别查询字段类型；两者之间的 reason 约束应使用完整的 `MutationRequest` 校验。
Header 中的幂等键优先于 body。version 与 idempotencyKey 按通用约定设为可选。

## 契约范围

- 明确建模：登录参数与登录结果、响应信封及数字错误码、分页、审计回执与审计记录、各模块 action 枚举、路径参数、账号 keyword/frozen/tier 筛选、备注操作必填 note。
- 文档大部分路由仅描述功能，未提供完整 DTO。未定义的业务对象、汇总结构、创建参数、筛选参数使用 unknown 或 Record<string, unknown>；可用泛型细化，不凭功能描述推断字段名、必填性、状态枚举。
- 某些创建路由没有单独列出 action；这些请求保留通用 MutationRequest，不套用资源更新的 action 枚举。认证接口未擅自套用审计字段。
- CSV 导出未描述响应包装与下载形式，保留 unknown。graphVersion 的具体类型未定义，保留 unknown。
- 金额使用 number，单位元。MoneyYuan/Integer 仅表达语义；两位小数、整数、分页上限需要运行时校验。
- 原有 src/types 下的界面草案仍由现有页面使用。后台契约独立放在此目录，接入真实服务时需显式转换，尤其注意旧草案中的金额单位与 action 差异。

精确补全业务实体需要后端补充逐字段请求/响应定义或 OpenAPI 文档。
