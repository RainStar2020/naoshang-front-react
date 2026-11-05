/** 所有字段引用并防止表格软件将文本当作公式执行。 */
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
export function makeCsv(rows: unknown[][]): string { return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') }

/** 将当前前端表格数据下载为 UTF-8 BOM CSV，Excel 可直接打开。 */
export function downloadCsv(fileName: string, rows: unknown[][]): void {
  const url = URL.createObjectURL(new Blob([makeCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
