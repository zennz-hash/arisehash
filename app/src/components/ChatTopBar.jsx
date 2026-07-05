import { Menu, Download } from 'lucide-react'
import Dropdown from './Dropdown.jsx'

export default function ChatTopBar({
  model, modelOptions, activeId, messages,
  onSetModel, onExportChat,
  onSetSidebarOpen, onSetSidebarCollapsed,
}) {
  return (
    <header className="chat-topbar">
      <button
        type="button"
        className="chat-menu-btn"
        onClick={() => {
          if (window.innerWidth < 1024) {
            onSetSidebarOpen(true)
          } else {
            onSetSidebarCollapsed((prev) => !prev)
          }
        }}
        aria-label="Menu percakapan"
      >
        <Menu size={20} />
      </button>

      <div className="chat-topbar-center">
        <div className="chat-model-dropdown">
          <Dropdown
            value={model}
            onChange={onSetModel}
            options={modelOptions}
            align="left"
            minWidth={200}
          />
        </div>
      </div>

      <div className="chat-topbar-right">
        {messages.length > 0 && (
          <button className="chat-export-btn" onClick={onExportChat} title="Ekspor obrolan" aria-label="Ekspor obrolan">
            <Download size={16} />
          </button>
        )}
      </div>
    </header>
  )
}
