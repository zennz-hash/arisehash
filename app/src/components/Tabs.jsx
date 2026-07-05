import { useState, useMemo } from 'react'

/**
 * Reusable tabs component.
 *
 * Props:
 *  - tabs: [{ id, label, icon?: LucideIcon }]
 *  - activeTab: string (controlled)
 *  - onChange: (tabId) => void
 *  - variant: 'underline' | 'pills' (default 'underline')
 *  - className: string (optional)
 *  - size: 'sm' | 'md' (default 'md')
 */
export default function Tabs({ tabs, activeTab, onChange, variant = 'underline', className = '', size = 'md' }) {
  const tabClass = variant === 'pills' ? 'tabs-pill' : 'tabs-underline'
  const sizeClass = size === 'sm' ? 'tabs-sm' : 'tabs-md'

  return (
    <div className={`tabs-wrap ${tabClass} ${sizeClass} ${className}`} role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tabs-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {Icon && <Icon size={size === 'sm' ? 14 : 15} />}
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Uncontrolled Tabs wrapper for convenience.
 * Props: same as Tabs + defaultTab
 */
export function useTabs(tabs, defaultTab) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)
  const tabProps = useMemo(() => ({ tabs, activeTab, onChange: setActiveTab }), [tabs, activeTab])
  return { activeTab, setActiveTab, tabProps }
}
