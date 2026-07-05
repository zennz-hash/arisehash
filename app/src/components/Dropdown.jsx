import { useState, useRef, useEffect, memo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Check, Lock } from 'lucide-react'

/**
 * Themed dropdown (custom popover, not a native <select>).
 *
 * props:
 *  - value: selected value
 *  - onChange: (value) => void
 *  - options: [{ value, label, icon?, desc? }]
 *  - label: small uppercase prefix shown in the trigger (optional)
 *  - icon: leading icon component (optional)
 *  - align: 'left' | 'right' (menu alignment)
 */
function DropdownBase({ value, onChange, options, label, icon: Icon, align = 'left', minWidth = 180 }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const selected = options.find((o) => o.value === value) || options[0]

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    setCoords({
      top: r.bottom + 6,
      left: align === 'right' ? r.right : r.left,
      width: Math.max(minWidth, r.width),
      align,
    })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onScroll = () => place()
    const onClick = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`dd-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {Icon && !selected?.icon && <Icon size={14} />}
        {label && <span className="dd-label">{label}</span>}
        {selected?.icon && <selected.icon size={14} />}
        <span className="dd-value">{selected?.label}</span>
        <ChevronDown size={14} className="dd-caret" />
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          className="dd-menu"
          role="listbox"
          style={{
            position: 'fixed',
            top: coords.top,
            ...(coords.align === 'right'
              ? { left: coords.left, transform: 'translateX(-100%)' }
              : { left: coords.left }),
            minWidth: coords.width,
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`dd-item ${o.value === value ? 'is-active' : ''}`}
              onClick={() => {
                if (o.isLocked) {
                  navigate('/app/upgrade')
                  setOpen(false)
                } else {
                  onChange(o.value)
                  setOpen(false)
                }
              }}
              style={o.isLocked ? { opacity: 0.6, cursor: 'pointer' } : {}}
            >
              {o.icon && <span className="dd-item-ic"><o.icon size={15} /></span>}
              <span className="dd-item-text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className="dd-item-label">{o.label}</span>
                  {o.desc && <span className="dd-item-desc" style={{ fontSize: 11, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.desc}</span>}
                </span>
                {o.isLocked && (
                  <span className="lock-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid rgba(239, 68, 68, 0.25)', marginLeft: 8 }}>
                    <Lock size={10} /> Upgrade
                  </span>
                )}
              </span>
              {o.value === value && !o.isLocked && <Check size={15} strokeWidth={3} className="dd-item-check" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

const Dropdown = memo(DropdownBase)
export default Dropdown
