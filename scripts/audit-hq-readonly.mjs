import axios from 'axios'
import { readFile, readdir, writeFile } from 'node:fs/promises'

// Explicit opt-in: never run as part of the ordinary unit-test command.
if (!process.env.HQ_API_PASSWORD) throw new Error('请通过 HQ_API_PASSWORD 提供测试口令')
const client = axios.create({ baseURL: process.env.HQ_API_TEST_URL || 'http://localhost:3000/api/hq', timeout: 15000 })
const directory = new URL('../src/types/hq/', import.meta.url)
const routes = []
for (const name of await readdir(directory)) {
  if (!name.endsWith('.ts') || ['common.ts', 'index.ts'].includes(name)) continue
  const source = await readFile(new URL(name, directory), 'utf8')
  for (const match of source.matchAll(/'GET ([^']+)':/g)) routes.push(match[1])
}
let login
try {
  login = await client.post('/auth/login', { username: process.env.HQ_API_USERNAME || 'admin', password: process.env.HQ_API_PASSWORD })
} catch (error) {
  // Never print Axios configs: they contain the login password and authorization headers.
  console.error(`后端登录连接失败：${error.code || 'REQUEST_FAILED'}，HTTP ${error.response?.status || '无响应'}。未更新 README 历史快照。`)
  process.exit(1)
}
if (login.data.code !== 0) throw new Error('登录失败')
client.defaults.headers.common.Authorization = `Bearer ${login.data.data.token}`
const empty = []
const errors = []
const related = []
let count = 0
try {
  for (const path of routes.filter((route) => !route.includes(':'))) {
    try {
      const response = await client.get(path, { params: { page: 1, pageSize: 1 } })
      if (response.data.code !== 0) throw new Error(`code ${response.data.code}`)
      count++
      const data = response.data.data
      if (data && Array.isArray(data.items) && data.total === 0 && data.items.length === 0) empty.push(path)
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const key of ['columns', 'templates', 'recentJobs', 'plans', 'audit', 'benefits', 'products', 'stores', 'categories']) {
          if (Array.isArray(data[key]) && data[key].length === 0) related.push(`${path} → ${key}`)
        }
      }
    } catch (error) { errors.push({ path, status: error.response?.status, code: error.response?.data?.code, message: error.response?.data?.message || error.message }) }
  }
} finally {
  await client.post('/auth/logout', {}).catch((error) => {
    errors.push({ path: '/auth/logout', status: error.response?.status, message: '测试会话注销失败，请在服务恢复后清理；未输出会话信息' })
  })
}
const now = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium' }).format(new Date())
const section = [
  '<!-- HQ_EMPTY_API_START -->',
  '## 真实后台空数据接口清单',
  '',
  `检查时间：${now}（Asia/Shanghai）；目标：\`${client.defaults.baseURL}\`。使用管理员会话、page=1/pageSize=1，只读查询，不执行业务写入。`,
  '',
  `已读取 ${count} 个不含路径参数的 GET 接口。以下 ${empty.length} 个接口返回 HTTP 200、code=0、items=[]、total=0，表示当前没有业务数据，不是请求失败：`,
  '',
  ...empty.sort().map((path) => `- \`GET /api/hq${path}\``),
  '',
  '目录 / 汇总接口中为空的业务数组（接口本身成功，其余字段可能有数据）：',
  '',
  ...related.sort().map((path) => `- \`${path}\``),
  '',
  '列表为空的模块无法完成真实记录的详情、变更闭环验收；详情中的 404 仅验证了资源不存在的契约。不要为通过测试而伪造业务记录。',
  '',
  '本次不含路径参数的 GET 请求异常：',
  '',
  ...(errors.length ? errors.map((error) => `- \`${error.path}\`：HTTP ${error.status || '无响应'} / code ${error.code || '未知'}，${error.message}`) : ['- 无。']),
  '',
  '复查命令：设置 HQ_API_PASSWORD 后运行 `npm run audit:api:empty`；脚本会更新本节，不保存 token、口令或业务明细。',
  '<!-- HQ_EMPTY_API_END -->',
].join('\n')
const target = new URL('../README.md', import.meta.url)
const readme = await readFile(target, 'utf8')
const marker = /<!-- HQ_EMPTY_API_START -->[\s\S]*?<!-- HQ_EMPTY_API_END -->/
await writeFile(target, marker.test(readme) ? readme.replace(marker, () => section) : `${readme}\n\n${section}\n`, 'utf8')
console.log(JSON.stringify({ staticGetSuccess: count, emptyListCount: empty.length, emptyLists: empty, errors }, null, 2))
if (errors.length) process.exitCode = 1
