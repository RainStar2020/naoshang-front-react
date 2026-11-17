import type { ReactNode } from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

/** 单个汇总指标：label 为列标题，value 为单元格内容（数字或已格式化的金额/状态文本） */
export interface SummaryItem {
  key: string
  label: string
  value: ReactNode
}

interface SummaryTableProps {
  items: SummaryItem[]
  size?: 'small' | 'middle'
}

type SummaryRow = Record<string, ReactNode>

/**
 * 单行汇总表：每个指标占一列，表头为指标名、唯一一行数据为指标值，
 * 用于替换页面中 Space + Statistic 的裸数字排列。
 */
export default function SummaryTable({ items, size = 'small' }: SummaryTableProps) {
  const columns: ColumnsType<SummaryRow> = items.map((item) => ({
    title: item.label,
    dataIndex: item.key,
    key: item.key,
    align: 'center',
  }))

  const row: SummaryRow = items.reduce((acc, item) => {
    acc[item.key] = item.value
    return acc
  }, {} as SummaryRow)

  return (
    <Table<SummaryRow>
      rowKey={() => 'summary'}
      size={size}
      bordered
      columns={columns}
      dataSource={[row]}
      pagination={false}
    />
  )
}
