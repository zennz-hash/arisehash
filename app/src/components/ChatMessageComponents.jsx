import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Code, RotateCcw, Edit3, Share2, Paperclip, Bot, User as UserIcon, Zap, Brain } from 'lucide-react'
import { renderInline } from '../utils/markdown.jsx'
import { formatTime } from '../utils/time.js'
import { getModelLabel } from '../model-utils.js'
import { useToast } from '../context/ToastContext.jsx'

/* ── Helpers ────────────────────────────────────────────────────────────── */
/** Collapse duplicate blank lines for cleaner display. */
function collapseBlanks(text) {
  return text.replace(/\n{3,}/g, '\n\n')
}

/* ── Markdown prose renderer for chat bubbles ───────────────────────────── */
export function MarkdownProse({ text }) {
  const lines = text.split('\n')
  const blocks = []
  let list = null, para = []

  const flushPara = (key) => {
    if (para.length) {
      blocks.push(<p key={`p${key}`} className="chat-p">{renderInline(para.join(' '), `p${key}`, 'chat-')}</p>)
      para = []
    }
  }
  const flushList = (key) => {
    if (list) { blocks.push(<ul key={`u${key}`} className="chat-ul">{list}</ul>); list = null }
  }

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) { flushPara(idx); flushList(idx); return }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      flushPara(idx); flushList(idx)
      const lvl = h[1].length
      const Tag = `h${Math.min(lvl + 2, 6)}`
      blocks.push(<Tag key={`h${idx}`} className="chat-h">{renderInline(h[2], `h${idx}`, 'chat-')}</Tag>)
      return
    }
    const li = /^\s*[-*]\s+(.*)$/.exec(line)
    if (li) {
      flushPara(idx)
      if (!list) list = []
      list.push(<li key={`l${idx}`}>{renderInline(li[1], `l${idx}`, 'chat-')}</li>)
      return
    }
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (ol) {
      flushPara(idx)
      if (!list) list = []
      list.push(<li key={`l${idx}`}>{renderInline(ol[1], `l${idx}`, 'chat-')}</li>)
      return
    }
    flushList(idx)
    para.push(line.trim())
  })
  flushPara('end'); flushList('end')
  return <>{blocks}</>
}

/* ── Code block component ───────────────────────────────────────────────── */
export function ChatCodeBlock({ lang, code, onBuild }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }
  const buildable = /jsx?|tsx?|react|javascript|typescript/i.test(lang || '')
  return (
    <div className="chat-codeblock">
      <div className="chat-codeblock-bar">
        <span className="chat-codeblock-lang">{lang || 'code'}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {buildable && onBuild && (
            <button className="chat-codeblock-btn" onClick={() => onBuild(code)} title="Buka di Sandbox">
              <Code size={13} /> Build
            </button>
          )}
          <button className="chat-codeblock-btn" onClick={copy} title="Salin kode">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Tersalin' : 'Salin'}
          </button>
        </div>
      </div>
      <pre className="chat-codeblock-pre"><code>{code}</code></pre>
    </div>
  )
}

/* ── Message content (assistant) ────────────────────────────────────────── */
export function MessageContent({ content, onBuild }) {
  const parts = useMemo(() => {
    const out = []
    const regex = /```(\w+)?\n?([\s\S]*?)```/g
    let last = 0, m
    while ((m = regex.exec(content)) !== null) {
      if (m.index > last) out.push({ type: 'text', value: content.slice(last, m.index) })
      out.push({ type: 'code', lang: m[1] || '', value: m[2].replace(/\n$/, '') })
      last = m.index + m[0].length
    }
    if (last < content.length) out.push({ type: 'text', value: content.slice(last) })
    return out
  }, [content])

  return (
    <div className="chat-md">
      {parts.map((p, i) =>
        p.type === 'code'
          ? <ChatCodeBlock key={i} lang={p.lang} code={p.value} onBuild={onBuild} />
          : <MarkdownProse key={i} text={p.value} />
      )}
    </div>
  )
}

/* ── User message content (with file/image attachment rendering) ────────── */
export function UserMessageContent({ content }) {
  const images = []
  const files = []

  // Use fast, non-regex index parsing to extract base64 images without engine limits
  let lastIndex = 0
  const cleanTextParts = []
  while (true) {
    const startTag = content.indexOf('![', lastIndex)
    if (startTag === -1) {
      cleanTextParts.push(content.substring(lastIndex))
      break
    }
    cleanTextParts.push(content.substring(lastIndex, startTag))
    const endName = content.indexOf('](', startTag + 2)
    if (endName === -1) {
      cleanTextParts.push(content.substring(startTag))
      break
    }
    const name = content.substring(startTag + 2, endName)
    const endUrl = content.indexOf(')', endName + 2)
    if (endUrl === -1) {
      cleanTextParts.push(content.substring(startTag))
      break
    }
    const url = content.substring(endName + 2, endUrl)
    if (url.startsWith('data:image/')) {
      images.push({ name, dataUrl: url })
    } else {
      cleanTextParts.push(content.substring(startTag, endUrl + 1))
    }
    lastIndex = endUrl + 1
  }

  // Clean the text by joining parts and removing file attachment tags
  let text = cleanTextParts.join('')

  // Extract files
  let fileMatch
  const fileRegex = /\[Lampiran: ([^\]]+) \(([^)]+)\)\]/g
  while ((fileMatch = fileRegex.exec(text)) !== null) {
    files.push({ name: fileMatch[1], sizeStr: fileMatch[2] })
  }
  text = text.replace(/\[Lampiran: ([^\]]+) \(([^)]+)\)\]/g, '').trim()

  return (
    <div className="user-message-content" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {text && <p className="chat-p" style={{ whiteSpace: 'pre-wrap', color: 'inherit', margin: 0 }}>{text}</p>}

      {/* File chips */}
      {files.length > 0 && (
        <div className="chat-attached-files-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {files.map((f, i) => (
            <div key={i} className="chat-attached-file-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: 8, fontSize: '12.5px', border: '1px solid rgba(255,255,255,0.25)', width: 'fit-content', color: '#fff' }}>
              <Paperclip size={13} style={{ color: '#fff' }} />
              <span style={{ fontWeight: 500 }}>{f.name}</span>
              <span style={{ opacity: 0.8, fontSize: '11px' }}>({f.sizeStr})</span>
            </div>
          ))}
        </div>
      )}

      {/* Image previews */}
      {images.length > 0 && (
        <div className="chat-attached-images-list" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, justifyContent: 'flex-end' }}>
          {images.map((img, i) => (
            <div key={i} className="chat-attached-image-container" style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', width: '120px', height: '120px', minWidth: '120px', minHeight: '120px', flexGrow: 0, flexShrink: 0, background: 'rgba(255,255,255,0.1)' }}>
              <img src={img.dataUrl} alt={img.name} width="120" height="120" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Bubble Action Toolbar ──────────────────────────────────────────────── */
export function BubbleActions({ role, onCopy, onRegenerate, onEdit, chatId }) {
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const { addToast } = useToast()

  const handleCopy = () => {
    navigator.clipboard?.writeText(onCopy()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  const handleShareLink = () => {
    if (!chatId) return
    const url = `${window.location.origin}/app/asisten?id=${chatId}`
    navigator.clipboard?.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1600)
      addToast('Link percakapan disalin ke clipboard!', 'success')
    })
  }

  return (
    <div className="chat-actions">
      <button className="chat-action-btn" onClick={handleCopy} title="Salin pesan" aria-label="Salin pesan">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      {role === 'assistant' && chatId && (
        <button className="chat-action-btn" onClick={handleShareLink} title="Salin link chat" aria-label="Salin link chat">
          {linkCopied ? <Check size={13} /> : <Share2 size={13} />}
        </button>
      )}
      {role === 'assistant' && onRegenerate && (
        <button className="chat-action-btn" onClick={onRegenerate} title="Coba lagi" aria-label="Coba lagi">
          <RotateCcw size={13} />
        </button>
      )}
      {role === 'user' && onEdit && (
        <button className="chat-action-btn" onClick={onEdit} title="Edit pesan" aria-label="Edit pesan">
          <Edit3 size={13} />
        </button>
      )}
    </div>
  )
}
