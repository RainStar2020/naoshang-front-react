import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  title: string
  width?: number
  align?: 'left' | 'center' | 'right'
  render?: (row: T, index: number) => ReactNode
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[]
  rows: T[]
  emptyText?: string
}

export default function DataTable<T extends { id: string }>({ columns, rows, emptyText = '暂无数据' }: DataTableProps<T>) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align || 'left' }}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyText}
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || 'left' }}>
                  {c.render ? c.render(row, i) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
