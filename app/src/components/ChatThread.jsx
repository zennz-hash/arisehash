import { motion, AnimatePresence } from 'framer-motion'
import { Bot, User as UserIcon, ArrowDown, Brain, Zap } from 'lucide-react'
import { MessageContent, UserMessageContent, BubbleActions } from './ChatMessageComponents.jsx'
import { formatTime } from '../utils/time.js'
import { getModelLabel } from '../model-utils.js'

export default function ChatThread({
  messages, streamText, streaming, scrollRef, showScrollBtn,
  editingMsgId, editingText, user, adminModels, aiKeys, model, activeId,
  onStartEdit, onCommitEdit, onCancelEdit, onSetEditingText,
  onScroll, onScrollToBottom, onSend, onRegenerate, onBuildCode,
}) {
  return (
    <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
      <div className="chat-thread">
        {messages.map((m) => {
          const hasImages = m.content && typeof m.content === 'string' && m.content.includes('data:image/')
          return (
            <div key={m.id} className={`chat-row chat-row-${m.role}`}>
              <span className={`chat-avatar chat-avatar-${m.role}`}>
                {m.role === 'user' ? (
                  <>
                    {user.picture && (
                      <img
                        src={user.picture}
                        alt={user?.name || 'User'}
                        width="36" height="36"
                        onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'inline-flex'; }}
                      />
                    )}
                    <span style={{ display: user.picture ? 'none' : 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                      <UserIcon size={16} />
                    </span>
                  </>
                ) : (
                  <Bot size={16} />
                )}
              </span>
              <div className="chat-bubble-wrap">
                <div className={`chat-bubble ${hasImages ? 'chat-bubble-has-images' : ''}`} onDoubleClick={() => m.role === 'user' && onStartEdit(m)}>
                  {editingMsgId === m.id ? (
                    <div className="chat-edit-wrap">
                      <textarea
                        className="chat-edit-textarea"
                        value={editingText}
                        onChange={(e) => onSetEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onCommitEdit() }
                          if (e.key === 'Escape') onCancelEdit()
                        }}
                        maxLength={10000}
                        autoFocus
                      />
                      <div className="chat-edit-actions">
                        <span className="chat-char-count">{editingText.length}/10000</span>
                        <button className="chat-edit-cancel" onClick={onCancelEdit}>Batal</button>
                        <button className="chat-edit-save" onClick={onCommitEdit}>Simpan</button>
                      </div>
                    </div>
                  ) : m.role === 'assistant' ? (
                    <MessageContent content={m.content} onBuild={onBuildCode} />
                  ) : (
                    <UserMessageContent content={m.content} />
                  )}
                </div>
                <span className={`chat-time chat-time-${m.role}`}>
                  {formatTime(m.createdAt) || (m.id?.startsWith('tmp-') ? 'mengirim...' : '')}
                </span>
                {m.role === 'assistant' && m.model && (
                  <span className={`chat-model-badge ${m.model}`}>
                    {m.model === 'max' ? <Brain size={10} /> : <Zap size={10} />}
                    {getModelLabel(m.model, adminModels, aiKeys)}
                  </span>
                )}
                <BubbleActions
                  role={m.role}
                  chatId={activeId}
                  onCopy={() => m.content}
                  onRegenerate={m.role === 'assistant' ? () => {
                    const lastUser = [...messages].reverse().find((x) => x.role === 'user')
                    if (lastUser) onRegenerate(lastUser)
                  } : undefined}
                  onEdit={m.role === 'user' ? () => onStartEdit(m) : undefined}
                />
              </div>
            </div>
          )
        })}

        {streaming && (
          <div className="chat-row chat-row-assistant">
            <span className="chat-avatar chat-avatar-assistant"><Bot size={16} /></span>
            <div className="chat-bubble-wrap">
              <div className="chat-bubble">
                {streamText
                  ? <MessageContent content={streamText} onBuild={onBuildCode} />
                  : <span className="chat-typing"><i /><i /><i /></span>}
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            className="chat-scroll-btn"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onScrollToBottom}
            aria-label="Scroll ke bawah"
          >
            <ArrowDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
