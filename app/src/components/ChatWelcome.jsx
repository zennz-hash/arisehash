import { motion } from 'framer-motion'
import { MessageSquare, Paperclip, Image as ImageIcon, GitBranch, Search as SearchIcon, Loader2, CornerDownLeft, X } from 'lucide-react'
import BorderGlowCard from './BorderGlowCard.jsx'
import Dropdown from './Dropdown.jsx'

const SUGGESTIONS = [
  'Buatkan komponen kartu profil React + Tailwind',
  'Jelaskan perbedaan SSR dan CSR',
  'Rancang skema database untuk aplikasi todo',
]

export default function ChatWelcome({
  user, input, model, modelOptions, streaming, deepSearch,
  attachedFiles, attachedImages, uploading,
  showGithubInput, githubUrl, analyzingGithub,
  onSetInput, onSetModel, onSetDeepSearch, onSend,
  onTriggerFilePicker, onTriggerImagePicker, onToggleGithubInput,
  onSetGithubUrl, onSetShowGithubInput, onHandleGithubAnalyze,
  onRemoveFile, onRemoveImage, onKeyDown,
}) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}
    >
      <div className="bolt-page" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
        <div className="bolt-center" style={{ margin: 'auto', padding: '40px 24px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="bolt-badge"><MessageSquare size={13} /> Asisten AI</span>
            <h1 className="display bolt-title">Halo, {user.name?.split(' ')[0] || 'Sobat'}</h1>
            <p className="text-muted bolt-sub">Tanyakan apa saja — arsitektur sistem, debugging, atau minta saya rakit komponen React.</p>
          </div>

          <div className="composer-glow-wrap">
            <div className="composer-glow" aria-hidden="true" />
            <BorderGlowCard
              borderRadius={22}
              glowRadius={60}
              backgroundColor="var(--surface)"
              className="bolt-composer"
              innerStyle={{ overflow: 'visible' }}
            >
              <textarea
                className="bolt-input"
                placeholder="Tanyakan apa saja..."
                value={input}
                onChange={(e) => onSetInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={3}
              />

              {attachedFiles.length > 0 && (
                <div className="chat-attach-bar" style={{ padding: '0 20px 10px' }}>
                  <span className="chat-attach-label">File:</span>
                  {attachedFiles.map((f, i) => (
                    <span key={i} className="chat-attach-chip">
                      <Paperclip size={11} />
                      {f.name}
                      <button className="chat-attach-x" onClick={() => onRemoveFile(i)} aria-label={`Hapus file ${f.name}`}><X size={11} /></button>
                    </span>
                  ))}
                  {uploading && <span className="chat-attach-uploading">Mengupload...</span>}
                </div>
              )}

              {attachedImages.length > 0 && (
                <div className="chat-attach-bar" style={{ padding: '0 20px 10px' }}>
                  <span className="chat-attach-label">Gambar:</span>
                  {attachedImages.map((img, i) => (
                    <span key={i} className="chat-attach-img-chip">
                      <img src={img.data} alt={img.name} width="32" height="32" className="chat-attach-thumb" />
                      <button className="chat-attach-x" onClick={() => onRemoveImage(i)} aria-label={`Hapus gambar ${img.name}`}><X size={11} /></button>
                    </span>
                  ))}
                </div>
              )}

              {showGithubInput && (
                <div className="chat-github-bar" style={{ padding: '0 20px 10px', background: 'transparent', borderTop: 'none' }}>
                  <div className="chat-github-inner" style={{ background: 'var(--surface-2)' }}>
                    <GitBranch size={14} className="chat-github-ic" />
                    <input
                      className="chat-github-input"
                      placeholder="https://github.com/owner/repo"
                      value={githubUrl}
                      onChange={(e) => onSetGithubUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onHandleGithubAnalyze() } }}
                      disabled={analyzingGithub}
                    />
                    <button className="chat-github-btn" onClick={onHandleGithubAnalyze} disabled={!githubUrl.trim() || analyzingGithub}>
                      {analyzingGithub ? 'Menganalisis...' : 'Analisis'}
                    </button>
                    <button className="chat-github-close" onClick={() => { onSetShowGithubInput(false); onSetGithubUrl('') }} aria-label="Tutup input GitHub">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className="bolt-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Dropdown value={model} onChange={onSetModel} options={modelOptions} />
                  <button
                    type="button"
                    className={`deep-search-cool ${deepSearch ? 'is-active' : ''}`}
                    onClick={() => onSetDeepSearch((v) => !v)}
                    title={deepSearch ? 'Nonaktifkan pencarian mendalam' : 'Aktifkan pencarian mendalam'}
                  >
                    <SearchIcon size={14} />
                    <span>Pencarian Mendalam</span>
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="composer-tool-btn" onClick={onTriggerFilePicker} title="Lampirkan file kode" aria-label="Lampirkan file kode">
                    <Paperclip size={15} />
                  </button>
                  <button type="button" className="composer-tool-btn" onClick={onTriggerImagePicker} title="Lampirkan gambar" aria-label="Lampirkan gambar">
                    <ImageIcon size={15} />
                  </button>
                  <button type="button" className={`composer-tool-btn ${showGithubInput ? 'is-active' : ''}`} onClick={onToggleGithubInput} title="Analisis repositori GitHub" aria-label="Analisis repositori GitHub">
                    <GitBranch size={15} />
                  </button>
                  <span style={{ width: 1, height: 22, background: 'var(--line-soft)', margin: '0 4px' }} />
                  <button className="bolt-send" onClick={onSend} disabled={streaming || !input.trim()}>
                    {streaming ? <Loader2 size={16} className="aster-spin" /> : <CornerDownLeft size={16} />}
                    <span>{streaming ? 'Mengirim...' : 'Tanya'}</span>
                  </button>
                </div>
              </div>
            </BorderGlowCard>
          </div>

          <div className="bolt-suggest">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="bolt-chip" onClick={() => onSetInput(s)}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
