import type { ReactNode } from 'react'
import { formatMoney } from '../utils/file'
import type { NoteGroup } from '../mock/plan'

/* ---------- 方案卡片容器 ---------- */
interface PlanCardProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function PlanCard({ title, subtitle, children }: PlanCardProps) {
  return (
    <div className="card plan-card">
      <h3 className="card-title">
        {title}
        {subtitle && <span className="plan-card-sub">{subtitle}</span>}
      </h3>
      {children}
    </div>
  )
}

/* ---------- 金额展示（静态展示，不参与计算） ---------- */
export function Money({ value, plain, int }: { value: number; plain?: boolean; int?: boolean }) {
  const text = int ? value.toLocaleString('zh-CN') : formatMoney(value)
  if (plain) return <>{text}</>
  return <span className="plan-money">¥{text}</span>
}

/* ---------- 分组规则备注 ---------- */
export function NoteGroups({ groups }: { groups: NoteGroup[] }) {
  return (
    <div className="note-groups">
      {groups.map((g) => (
        <div key={g.title} className="note-group">
          <div className="note-group-title">{g.title}</div>
          <ul className="notice-list">
            {g.items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}
