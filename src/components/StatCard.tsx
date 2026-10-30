interface StatCardProps {
  title: string
  value: string
  suffix?: string
  sub?: string
  tone: 'blue' | 'green' | 'orange' | 'purple'
}

export default function StatCard({ title, value, suffix, sub, tone }: StatCardProps) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">
        {value}
        {suffix && <span className="stat-suffix">{suffix}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
