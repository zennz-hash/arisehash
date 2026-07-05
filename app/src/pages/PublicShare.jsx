import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FileText, Layout } from 'lucide-react'
import { api } from '../api.js'
import { useLang } from '../context/LanguageContext.jsx'
import MermaidRender from '../components/MermaidRender.jsx'
import { renderInline } from '../utils/markdown.jsx'

function PublicMarkdown({ content }) {
  const blocks = useMemo(() => {
    const out = []
    const re = /```(\w+)?\n?([\s\S]*?)```/g
    let last = 0, m
    while ((m = re.exec(content || '')) !== null) {
      if (m.index > last) out.push({ type: 'md', value: content.slice(last, m.index) })
      out.push({ type: 'code', lang: m[1] || '', value: m[2].replace(/\n$/, '') })
      last = m.index + m[0].length
    }
    if (last < (content || '').length) out.push({ type: 'md', value: content.slice(last) })
    return out
  }, [content])

  return (
    <div className="prd-md">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'code') return <pre key={blockIndex} className="prd-code"><code>{block.value}</code></pre>
        const lines = block.value.split('\n')
        const elements = []
        let list = null
        const flushList = (i) => {
          if (!list) return
          elements.push(<ul key={`u-${blockIndex}-${i}`} className="prd-ul">{list}</ul>)
          list = null
        }
        lines.forEach((raw, i) => {
          const line = raw.replace(/\s+$/, '')
          if (!line.trim()) { flushList(i); return }
          const heading = /^(#{1,4})\s+(.*)$/.exec(line)
          if (heading) {
            flushList(i)
            const Tag = `h${Math.min(heading[1].length + 1, 5)}`
            elements.push(<Tag key={`h-${blockIndex}-${i}`} className={`prd-h prd-h${heading[1].length}`}>{renderInline(heading[2], `h-${blockIndex}-${i}`, 'prd-')}</Tag>)
            return
          }
          const item = /^\s*[-*]\s+(.*)$/.exec(line) || /^\s*\d+\.\s+(.*)$/.exec(line)
          if (item) {
            if (!list) list = []
            list.push(<li key={`l-${blockIndex}-${i}`}>{renderInline(item[1], `l-${blockIndex}-${i}`, 'prd-')}</li>)
            return
          }
          flushList(i)
          elements.push(<p key={`p-${blockIndex}-${i}`} className="prd-p">{renderInline(line.trim(), `p-${blockIndex}-${i}`, 'prd-')}</p>)
        })
        flushList('end')
        return <div key={blockIndex}>{elements}</div>
      })}
    </div>
  )
}

export default function PublicShare() {
  const { token } = useParams()
  const { t } = useLang()
  const [blueprint, setBlueprint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const bp = await api.getPublicShare(token)
        setBlueprint(bp)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (token) load()
  }, [token])

  const mermaidChart = useMemo(() => {
    if (!blueprint) return ''
    const match = /```mermaid\s+([\s\S]*?)```/.exec(blueprint.content)
    return match ? match[1].trim() : ''
  }, [blueprint])

  if (loading) {
    return (
      <div className="container section" style={{ textAlign: 'center', padding: '100px 0' }}>
        <h1 className="display h-md">{t('common.loading')}</h1>
      </div>
    )
  }

  if (error || !blueprint) {
    return (
      <div className="container section" style={{ textAlign: 'center', padding: '100px 0' }}>
        <div className="card" style={{ padding: 40, maxWidth: 500, margin: '0 auto' }}>
          <h2 className="display" style={{ fontSize: 22, color: '#9c2a20', marginBottom: 14 }}>Tautan Tidak Valid</h2>
          <p className="text-muted" style={{ marginBottom: 20 }}>
            {error || 'Link ini sudah kadaluwarsa atau tidak lagi dibagikan secara publik.'}
          </p>
          <Link to="/" className="pill pill-indigo">Pergi ke Beranda</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container section">
      {/* Brand logo link home */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={28} className="text-indigo-600" />
          <h1 className="display h-md">{blueprint.name}</h1>
          <span className="chip chip-lime" style={{ fontSize: 10.5 }}>{blueprint.type}</span>
        </div>
        <Link to="/" className="pill">
          <Layout size={16} /> Buat Aplikasi Anda Sendiri
        </Link>
      </div>

      <div className="order-detail-grid">
        {/* Markdown specs */}
        <div className="card" style={{ padding: 24, minHeight: '60vh' }}>
          <h3 className="display" style={{ fontSize: 16, marginBottom: 16 }}>Dokumen PRD Publik</h3>
          <PublicMarkdown content={blueprint.content} />
        </div>

        {/* Mermaid diagram */}
        <div className="card" style={{ padding: 24, background: 'var(--surface-2)', minHeight: '60vh' }}>
          <h3 className="display" style={{ fontSize: 16, marginBottom: 16 }}>Diagram Arsitektur</h3>
          {mermaidChart ? (
            <div style={{ padding: 14, background: '#fff', borderRadius: 14, border: '1.5px solid var(--line-soft)' }}>
              <MermaidRender chart={mermaidChart} securityLevel="strict" />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
              <Layout size={36} style={{ strokeWidth: 1.5, marginBottom: 12 }} />
              <p style={{ fontSize: 14 }}>Tidak ada diagram Mermaid yang terdeteksi.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
