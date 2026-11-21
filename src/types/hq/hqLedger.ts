/** HQ-29 总部分红只读接口。路径相对于 /api/hq；本期无写接口。 */
import type { ApiResponse, Endpoint, PageData } from './common'
import type {
  HqLedgerCatalog,
  HqLedgerCatalogQuery,
  HqLedgerDetail,
  HqLedgerListData,
  HqLedgerListQuery,
} from '../hqLedger'

export interface HqLedgerEndpoints {
  /** 筛选项、目录枚举、日期范围内合计，以及组装账面余额。 */
  'GET /hq-ledger/catalog': Endpoint<never, HqLedgerCatalogQuery, never, HqLedgerCatalog>
  /** 总部收支流水分页列表。合计为当前筛选下 posted 且 includedInSummary 的全部合计。 */
  'GET /hq-ledger': Endpoint<never, HqLedgerListQuery, never, HqLedgerListData>
  /** 单笔流水详情（含关联单据与同一业务其他流水）。ledgerId 为合成 ID，须原样编码传递。 */
  'GET /hq-ledger/:ledgerId': Endpoint<{ ledgerId: string }, never, never, HqLedgerDetail>
}

export type HqLedgerCatalogResponse = ApiResponse<HqLedgerCatalog>
export type HqLedgerListResponse = ApiResponse<HqLedgerListData>
export type HqLedgerDetailResponse = ApiResponse<HqLedgerDetail>
export type HqLedgerPageData = PageData
