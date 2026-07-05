import { Paperclip, Image as ImageIcon, GitBranch } from 'lucide-react'

/**
 * Shared toolbar with file/image/GitHub attachment buttons.
 * Extracted from BuildCode.jsx and Store.jsx (identical JSX pattern).
 */
export default function ComposerToolbar({
  fileInputRef,
  imageInputRef,
  triggerFilePicker,
  triggerImagePicker,
  onPickFiles,
  showGithubInput,
  toggleGithubInput,
  fileAccept,
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        className="composer-tool-btn"
        onClick={triggerFilePicker}
        title="Lampirkan file kode"
        aria-label="Lampirkan file kode"
      >
        <Paperclip size={15} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={fileAccept || '.txt,.md,.json,.csv,.html,.css,.js,.jsx,.ts,.tsx,.vue,.svelte'}
        onChange={onPickFiles}
        hidden
      />

      <button
        type="button"
        className="composer-tool-btn"
        onClick={triggerImagePicker}
        title="Lampirkan gambar"
        aria-label="Lampirkan gambar"
      >
        <ImageIcon size={15} />
      </button>
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={onPickFiles}
        hidden
      />

      <button
        type="button"
        className={`composer-tool-btn ${showGithubInput ? 'is-active' : ''}`}
        onClick={toggleGithubInput}
        title="Analisis repositori GitHub"
        aria-label="Analisis repositori GitHub"
      >
        <GitBranch size={15} />
      </button>

      <span style={{ width: 1, height: 22, background: 'var(--line-soft)', margin: '0 4px' }} />
    </div>
  )
}
