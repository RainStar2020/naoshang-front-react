# 总部后台 API

26 个业务文件与 `src/types/hq` 对应，共 120 个接口函数，统一从 `src/api/index.ts` 导出。
函数以 HTTP 方法和路径命名，例如 `getUsers`、`getUsersByAccountId`、`postUsersByAccountIdMutate`。
每个函数的 JSDoc 标注端点、用途、参数、返回值和异常。

## 配置与调用

默认请求地址 `/api/hq`，超时 30 秒。开发环境已通过 Vite 代理转发到 `http://localhost:3000`，配置位于 `.env.development`；修改后重启开发服务器。跨域或独立部署可在 `.env.local` 配置：

```dotenv
VITE_HQ_API_BASE_URL=http://localhost:3000/api/hq
```

同源部署需要服务端将 `/api/hq` 转发到后端。跨域部署需后端允许前端来源和鉴权、审计请求头。

```ts
import {
  postAuthLogin,
  setApiToken,
  getUsers,
  postUsersByAccountIdMutate,
} from "./api";

const login = await postAuthLogin({ username: "admin", password: "example" });
if (login.code === 0) setApiToken(login.data.token);

const users = await getUsers({ page: 1, pageSize: 20, frozen: false });
await postUsersByAccountIdMutate(
  { accountId: "user-id" },
  {
    body: {
      action: "update-note",
      note: "已回访",
      reason: "客服跟进",
      version: 1,
    },
    headers: { "Idempotency-Key": "unique-operation-key" },
  },
);
```

也可以调用 `setApiTokenProvider(() => yourSessionStore.token)` 按请求读取最新会话。
token 默认仅在内存保存；应用自行管理持久化、登录/登出及口令修改后的清理。
登录接口不自动附带 token。AuthProvider 已通过真实认证适配器接入登录、会话恢复和注销，并用 sessionStorage 保存 token；请求层按请求读取。真实模式业务页面通过 services/real/registry.ts 绑定具名 API 函数，不读取 mock 业务数据；mock 模式保留旧演示页面用于回归。

`VITE_HQ_AUTH_MODE=mock` 可显式切换演示认证；`.env.test` 为现有业务回归测试启用 mock，真实认证适配器另有独立单元测试。生产环境默认启用真实认证，需要部署服务端配置 `/api/hq` 反向代理。

## 请求与错误约定

- GET：路径参数对象（若有）、可选 query、可选 options。
- POST：路径参数对象（若有）、request、可选 options。认证接口 request 直接为 JSON body；其他写接口为 `{ body, headers? }`。
- reason 必须通过 request.body.reason 或 request.headers['X-Reason'] 提供；审计头与 body 分开发送。
- options 支持 signal、timeout 和额外 headers；request 的审计头优先。不自动生成幂等键、不自动重试写操作，重试应复用原键。
- 返回完整 `{ code, message, data }` 信封，类型从对应 Endpoints 取得。文档未定义的实体仍为 unknown，不进行不可靠的类型断言。
- 后端业务错误（包括 HTTP 200 中非零 code）抛出 ApiError，保留 code、status、response、currentVersion；网络、超时、取消等保留原 AxiosError。
- 401 不自动跳转或清除应用状态，由调用层统一处理。
- `/payments/export` 已实测为 JSON 信封，data 包含 fileName、contentType、rowCount、csv，类型已补齐。

`src/types/hq/common.ts` 的 Endpoint 增加 request 字段，用于保留写操作 body/headers 联合约束，现有字段保持兼容。

## 真实联调测试

日常 `npm test` 不访问真实服务。PowerShell 中显式设置以下环境变量再执行：

```powershell
$env:HQ_API_LIVE='1'
$env:HQ_API_USERNAME='admin'
$env:HQ_API_PASSWORD='<测试账号口令>'
# 可选：通过开发代理验证（默认直接访问局域网后端）
# $env:HQ_API_TEST_URL='http://127.0.0.1:5174/api/hq'
npm run test:api:live
Remove-Item Env:HQ_API_PASSWORD
```

测试调用实际 src/api 函数，覆盖登录、全部 82 个 GET 路由、分页上限、CSV 信封、注销及 token 撤销。详情从现有列表提取 ID；集合为空时仅验证 404，不视为成功读取详情。列表提供 ID 但详情不存在时保留失败断言。
不执行冻结、发券、改价等业务写入，不创建业务数据。

2026-10-28 首次联调：经本地开发代理覆盖 82 个 GET 路由，70 个成功读取，11 个因集合无数据而返回预期 404，1 个商品详情路由失败。进一步逐个核对商品列表中的 8 个 productId，详情均返回 HTTP 404 / code 40400（例如列表存在 adminFee，详情报“商品不存在：adminFee”）。因此真实联调测试暂时保持失败，待后端修复后复验；不将该问题隐藏为通过。分页上限、CSV 信封、登录、注销和 token 撤销验证通过。

第一阶段浏览器通过开发代理验证真实登录、刷新恢复会话、注销及注销后刷新。第二阶段已完成真实模块绑定，最新验证和空数据清单见项目根 README。
