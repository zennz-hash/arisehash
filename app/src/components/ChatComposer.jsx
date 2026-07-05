import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, Image as ImageIcon, GitBranch, Search as SearchIcon, Send, Square, Loader2, X } from 'lucide-react'

export default function ChatComposer({
  input, streaming, ModelIcon,
  attachedFiles, attachedImages,
  showGithubInput, githubUrl, analyzingGithub,
  deepSearch, selectedModelLabel,
  taRef,
  onSetInput, onSend, onStopStreaming, onKeyDown,
  onTriggerFilePicker, onTriggerImagePicker, onToggleGithubInput,
  onSetGithubUrl, onSetShowGithubInput, onHandleGithubAnalyze,
  onRemoveFile, onRemoveImage, onSetDeepSearch,
  MAX_CHARS,
}) {
  return (
    <div className="chat-composer">
      {attachedFiles.length > 0 && (
        <div className="chat-attach-bar">
          <span className="chat-attach-label">File:</span>
          {attachedFiles.map((f, i) => (
            <span key={i} className="chat-attach-chip">
              <Paperclip size={11} />
              {f.name}
              <button className="chat-attach-x" onClick={() => onRemoveFile(i)} aria-label={`Hapus file ${f.name}`}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}

      {attachedImages.length > 0 && (
        <div className="chat-attach-bar">
          <span className="chat-attach-label">Gambar:</span>
          {attachedImages.map((img, i) => (
            <span key={i} className="chat-attach-img-chip">
              <img src={img.data} alt={img.name} width="32" height="32" className="chat-attach-thumb" />
              <button className="chat-attach-x" onClick={() => onRemoveImage(i)} aria-label={`Hapus gambar ${img.name}`}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showGithubInput && (
          <motion.div
            className="chat-github-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="chat-github-inner">
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
          </motion.div>
        )}
      </AnimatePresence>

      <div className="chat-composer-inner">
        <span className="chat-composer-mode"><ModelIcon size={14} /></span>
        <textarea
          ref={taRef}
          className="chat-textarea"
          placeholder={`Kirim pesan (${selectedModelLabel})...`}
          value={input}
          onChange={(e) => onSetInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={streaming}
          maxLength={MAX_CHARS}
        />
        <div className="chat-composer-right">
          <div className="chat-composer-tools">
            <button className="chat-tool-btn" onClick={onTriggerFilePicker} title="Lampirkan file kode" aria-label="Lampirkan file kode">
              <Paperclip size={15} />
            </button>
            <button className="chat-tool-btn" onClick={onTriggerImagePicker} title="Lampirkan gambar" aria-label="Lampirkan gambar">
              <ImageIcon size={15} />
            </button>
            <button
              className={`chat-tool-btn ${showGithubInput ? 'is-active' : ''}`}
              onClick={() => onToggleGithubInput()}
              title="Analisis repositori GitHub"
              aria-label="Analisis repositori GitHub"
            >
              <GitBranch size={15} />
            </button>
            <button
              className={`chat-tool-btn chat-tool-deep ${deepSearch ? 'is-active' : ''}`}
              onClick={() => onSetDeepSearch((v) => !v)}
              title={deepSearch ? 'Nonaktifkan pencarian mendalam' : 'Aktifkan pencarian mendalam'}
              aria-label={deepSearch ? 'Nonaktifkan pencarian mendalam' : 'Aktifkan pencarian mendalam'}
            >
              <SearchIcon size={15} />
              {deepSearch && <span className="chat-deep-label">Deep</span>}
            </button>
          </div>
          {input && <span className="chat-char-count" title={`${input.length}/${MAX_CHARS}`}>{MAX_CHARS - input.length}</span>}
          {streaming ? (
            <button className="chat-send-btn" onClick={onStopStreaming} aria-label="Hentikan" style={{ background: '#dc2626' }}>
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button className="chat-send-btn" onClick={onSend} disabled={!input.trim()} aria-label="Kirim">
              <Send size={17} />
            </button>
          )}
        </div>
      </div>
      <p className="chat-disclaimer">AriseHash dapat membuat kesalahan. Verifikasi informasi penting.</p>
    </div>
  )
}
