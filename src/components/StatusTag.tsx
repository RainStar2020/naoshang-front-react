const colorMap: Record<string, string> = {
  上架中: 'green',
  已下架: 'gray',
  营业中: 'green',
  已停业: 'gray',
  合作中: 'green',
  已解约: 'red',
  在职: 'green',
  离职: 'gray',
  已结算: 'blue',
  待结算: 'orange',
  提现中: 'purple',
}

export default function StatusTag({ status }: { status: string }) {
  const cls = colorMap[status] || 'gray'
  return <span className={`status-tag status-${cls}`}>{status}</span>
}
