/**
 * 统一分页配置。
 *
 * - 页面级列表：默认 20，可选 10 / 20 / 50 / ALL
 * - 抽屉/弹窗内列表：默认 10，可选 10 / 20 / ALL
 *
 * antd 5.29 会把 pageSizeOptions 强制 Number 化，字符串 'ALL' 会变成 NaN，
 * 因此 ALL 用一个内部大数值 PAGE_SIZE_ALL 承载，再通过 rc-pagination 运行时
 * 支持的 buildOptionText 让该选项显示为 'ALL'。
 *
 * 注意：后端当前对 pageSize 有 100 的上限（超出会截断为 100），所以后端放开
 * 上限前，ALL 实际最多返回 100 条；后端放开后该值即代表真正全量。
 */
import type { ReactNode } from 'react'
import type { TablePaginationConfig } from 'antd/es/table'

/** ALL 选项的内部 pageSize 数值。 */
export const PAGE_SIZE_ALL = 99999

/** 页面级列表默认每页条数。 */
export const DEFAULT_PAGE_SIZE = 20
/** 页面级列表可选每页条数（含 ALL）。 */
export const PAGE_SIZE_OPTIONS: number[] = [10, 20, 50, PAGE_SIZE_ALL]

/** 抽屉/弹窗内列表默认每页条数。 */
export const DEFAULT_MODAL_PAGE_SIZE = 10
/** 抽屉/弹窗内列表可选每页条数（含 ALL）。 */
export const MODAL_SIZE_OPTIONS: number[] = [10, 20, PAGE_SIZE_ALL]

/** rc-pagination 运行时支持该回调，但未在其 d.ts 中声明。 */
type WithBuildOptionText = TablePaginationConfig & {
  buildOptionText?: (value: number) => ReactNode
}

function buildOptionText(value: number): ReactNode {
  return value === PAGE_SIZE_ALL ? 'ALL' : `${value} 条/页`
}

interface PaginationArgs {
  page: number
  pageSize: number
  total: number
  onChange: (page: number, pageSize: number) => void
  showTotal?: (total: number, range: [number, number]) => ReactNode
}

function buildPaginationConfig(
  sizeOptions: number[],
  args: PaginationArgs,
): TablePaginationConfig {
  const config: WithBuildOptionText = {
    current: args.page,
    pageSize: args.pageSize,
    total: args.total,
    showSizeChanger: true,
    pageSizeOptions: sizeOptions,
    buildOptionText,
    onChange: args.onChange,
    ...(args.showTotal ? { showTotal: args.showTotal } : {}),
  }
  return config
}

/** 页面级列表分页：默认 20，选项 10 / 20 / 50 / ALL。 */
export function pagePagination(args: PaginationArgs): TablePaginationConfig {
  return buildPaginationConfig(PAGE_SIZE_OPTIONS, args)
}

/** 抽屉/弹窗内列表分页：默认 10，选项 10 / 20 / ALL。 */
export function modalPagination(args: PaginationArgs): TablePaginationConfig {
  return buildPaginationConfig(MODAL_SIZE_OPTIONS, args)
}

/**
 * 非受控预设：数据已全量在前端、由 antd Table 自行分页时使用。
 * 页面级：默认 20，选项 10 / 20 / 50 / ALL。
 */
export const pagePaginationDefaults: WithBuildOptionText = {
  defaultPageSize: DEFAULT_PAGE_SIZE,
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  buildOptionText,
}

/**
 * 非受控预设：抽屉/弹窗内、数据已全量在前端时使用。
 * 默认 10，选项 10 / 20 / ALL。
 */
export const modalPaginationDefaults: WithBuildOptionText = {
  defaultPageSize: DEFAULT_MODAL_PAGE_SIZE,
  showSizeChanger: true,
  pageSizeOptions: MODAL_SIZE_OPTIONS,
  buildOptionText,
}
