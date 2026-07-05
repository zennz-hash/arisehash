import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'

/**
 * Consistent empty-state block for lists/tables across the app.
 *
 * Props:
 *  - icon:   lucide icon component (defaults to Inbox)
 *  - title:  short headline
 *  - desc:   supporting line
 *  - actionLabel / actionTo / onAction: optional CTA (link or button)
 *  - compact: tighter padding for inline use
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  desc,
  actionLabel,
  actionTo,
  onAction,
  compact = false,
}) {
  return (
    <div className={`empty-state ${compact ? 'is-compact' : ''}`}>
      <span className="empty-state-ic"><Icon size={compact ? 22 : 28} /></span>
      {title && <h3 className="display empty-state-title">{title}</h3>}
      {desc && <p className="empty-state-desc">{desc}</p>}
      {actionLabel && (actionTo ? (
        <Link to={actionTo} className="pill pill-indigo empty-state-btn">{actionLabel}</Link>
      ) : onAction ? (
        <button className="pill pill-indigo empty-state-btn" onClick={onAction}>{actionLabel}</button>
      ) : null)}
    </div>
  )
}
