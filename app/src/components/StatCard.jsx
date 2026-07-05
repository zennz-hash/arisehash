/**
 * Reusable stat card for grids.
 *
 * Props:
 *  - icon: LucideIcon
 *  - value: string | number
 *  - label: string
 *  - accent: boolean — makes card highlighted
 *  - suffix: string (optional, appended to value)
 *  - className: string (optional)
 *  - onClick: () => void (optional, makes card clickable)
 */
export default function StatCard({ icon: Icon, value, label, accent = false, suffix = '', className = '', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`card dash-stat ${accent ? 'dash-stat-accent' : ''} ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer', textAlign: 'left', width: '100%' } : {}}
    >
      {Icon && <span className="dash-stat-ic"><Icon size={20} color="var(--on-ink)" /></span>}
      <div>
        <div className="dash-stat-val">
          {value}{suffix && <span className="dash-stat-suffix">{suffix}</span>}
        </div>
        <div className="dash-stat-label">{label}</div>
      </div>
    </Tag>
  )
}
