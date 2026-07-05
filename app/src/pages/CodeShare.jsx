import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Code2, Eye, AlertTriangle } from 'lucide-react'
import { SandpackProvider, SandpackPreview, SandpackCodeEditor } from '@codesandbox/sandpack-react'
import { api } from '../api.js'
import { buildZip, downloadBlob } from '../utils/zip.js'

function safeParseDeps(pkgText) {
  try {
    return JSON.parse(pkgText || '{}')?.dependencies || {}
  } catch {
    return {}
  }
}

export default function CodeShare() {
  const { token } = useParams()
  const [project, setProject] = useState(null)
  const [files, setFiles] = useState({})
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState('preview')
  const dependencies = useMemo(() => safeParseDeps(files['/package.json']), [files])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const data = await api.publicCodeProject(token)
        if (!active) return
        setProject(data)
        setFiles(JSON.parse(data.filesJson || '{}'))
      } catch (err) {
        if (active) setError(err.message || 'Tidak ditemukan')
      } finally {
        if (active) setLoaded(true)
      }
    })()
    return () => { active = false }
  }, [token])

  if (!loaded) {
    return <div className="container section" style={{ textAlign: 'center' }}><p className="text-muted">Memuat proyek...</p></div>
  }
  if (error || !project) {
    return (
      <div className="container section" style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
        <div className="card" style={{ padding: '40px 32px', maxWidth: 440, textAlign: 'center' }}>
          <AlertTriangle size={28} style={{ color: 'var(--accent-2)', marginBottom: 12 }} />
          <h2 className="display" style={{ fontSize: 20, marginBottom: 8 }}>Proyek tidak tersedia</h2>
          <p className="text-muted" style={{ fontSize: 14, marginBottom: 20 }}>{error || 'Link mungkin sudah dinonaktifkan oleh pemiliknya.'}</p>
          <Link to="/" className="pill pill-indigo">Ke Beranda</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="ide-shell">
      <header className="ide-header">
        <div className="ide-head-l">
          <Link to="/" className="ide-back"><Code2 size={16} /> <span className="ide-back-label">AriseHash</span></Link>
        </div>
        <h1 className="ide-head-title display">{project.name} · dibagikan</h1>
        <div className="ide-head-r">
          {project.shareAllowDownload && (
            <button className="pill ide-export-btn" onClick={() => downloadBlob(buildZip(files), `${project.name.replace(/\s+/g, '-').toLowerCase()}.zip`)}>
              Unduh ZIP
            </button>
          )}
          <Link to="/login" className="pill ide-export-btn">Buat punyamu</Link>
        </div>
      </header>

      <SandpackProvider
        className="ide-provider"
        files={files}
        template={project.template || 'react'}
        theme="dark"
        customSetup={{ dependencies }}
      >
        <div className="ide-body" style={{ gridTemplateColumns: '1fr' }}>
          <section className="ide-right">
            <div className="ide-tabs">
              <div className="ide-tabs-group">
                <button className={`ide-tab ${tab === 'preview' ? 'is-active' : ''}`} onClick={() => setTab('preview')}><Eye size={15} /> Preview</button>
                <button className={`ide-tab ${tab === 'code' ? 'is-active' : ''}`} onClick={() => setTab('code')}><Code2 size={15} /> Code</button>
              </div>
            </div>
            <div className="ide-right-body">
              <div className="ide-pane" style={{ display: tab === 'preview' ? 'block' : 'none' }}>
                <SandpackPreview showNavigator={false} showRefreshButton showOpenInCodeSandbox={false} style={{ height: '100%' }} />
              </div>
              <div className="ide-pane ide-code-pane" style={{ display: tab === 'code' ? 'flex' : 'none' }}>
                <div className="ide-editor">
                  <SandpackCodeEditor showTabs showLineNumbers readOnly style={{ height: '100%' }} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </SandpackProvider>
    </div>
  )
}
