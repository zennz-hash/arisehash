import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, MessageSquare, Trash2, Search, X, Menu, Folder } from 'lucide-react'

export default function ChatSidebar({
  chats, activeId, searchQuery, filteredChats,
  renamingChatId, renameText, quota,
  sidebarOpen, sidebarCollapsed,
  onOpenChat, onNewChat, onRemoveChat, onDeleteAllChats,
  onStartRename, onCommitRename,
  onSetSearchQuery, onSetRenamingChatId, onSetRenameText,
  onSetSidebarOpen, onSetSidebarCollapsed,
}) {
  const renameInputRef = useRef(null)

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.button
            type="button"
            className="chat-sidebar-overlay"
            aria-label="Tutup sidebar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onSetSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`chat-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="chat-sidebar-header" style={{ marginBottom: 14 }}>
          <span className="chat-sidebar-title">Riwayat Chat</span>
          <button
            type="button"
            className="chat-sidebar-toggle"
            onClick={() => {
              if (window.innerWidth < 1024) {
                onSetSidebarOpen(false)
              } else {
                onSetSidebarCollapsed(true)
              }
            }}
            title="Sembunyikan Riwayat"
          >
            <Menu size={15} />
          </button>
        </div>

        <button className="pill pill-indigo chat-new-btn" onClick={onNewChat}>
          <Plus size={17} /> Percakapan Baru
        </button>

        {/* Search */}
        <div className="chat-search-wrap">
          <Search size={14} className="chat-search-ic" />
          <input
            className="chat-search-input"
            placeholder="Cari percakapan..."
            value={searchQuery}
            onChange={(e) => onSetSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="chat-search-clear" onClick={() => onSetSearchQuery('')} aria-label="Bersihkan pencarian">
              <X size={14} />
            </button>
          )}
        </div>

        {/* History */}
        <div className="chat-history">
          {filteredChats.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13, padding: '12px 6px' }}>
              {searchQuery ? 'Tidak ditemukan.' : 'Belum ada percakapan.'}
            </p>
          ) : (
            filteredChats.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenChat(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpenChat(c.id)
                  }
                }}
                className={`chat-history-item ${activeId === c.id ? 'is-active' : ''}`}
              >
                <MessageSquare size={15} style={{ flexShrink: 0 }} />
                {renamingChatId === c.id ? (
                  <input
                    ref={renameInputRef}
                    className="chat-rename-input"
                    value={renameText}
                    onChange={(e) => onSetRenameText(e.target.value)}
                    onBlur={onCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onCommitRename()
                      if (e.key === 'Escape') onSetRenamingChatId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    maxLength={120}
                  />
                ) : (
                  <span className="chat-history-title" onDoubleClick={() => onStartRename(c.id, c.title)}>
                    {c.title}
                  </span>
                )}
                <button
                  type="button"
                  className="chat-history-del"
                  onClick={(e) => onRemoveChat(c.id, e)}
                  title="Hapus"
                  aria-label="Hapus percakapan"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Sidebar footer */}
        <div className="chat-sidebar-foot">
          {quota && (
            <div className="chat-quota">
              <MessageSquare size={13} />
              <span
                title={`Standard: ${quota.usage?.chatStandard ?? quota.quotaUsedToday}/${quota.limits?.chatStandard ?? quota.prdQuota} · Max: ${quota.usage?.maxThinking ?? quota.codeQuotaUsedToday}/${quota.limits?.maxThinking ?? quota.codeQuota}`}
              >
                {(quota.usage?.chatStandard ?? quota.quotaUsedToday)}/{(quota.limits?.chatStandard ?? quota.prdQuota)} std · {(quota.usage?.maxThinking ?? quota.codeQuotaUsedToday)}/{(quota.limits?.maxThinking ?? quota.codeQuota)} max
              </span>
            </div>
          )}
          {chats.length > 1 && (
            <button className="chat-delete-all-btn" onClick={onDeleteAllChats}>
              <Trash2 size={13} /> Hapus Semua
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
