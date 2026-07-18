export function validateBlueprintContent(content) {
  const warnings = []
  const text = String(content || '')
  if (text.length < 800) warnings.push('Dokumen PRD terlihat terlalu pendek.')
  if (!/^#\s+/m.test(text)) warnings.push('Dokumen belum memiliki heading utama Markdown.')
  if (!/```mermaid[\s\S]*?```/i.test(text)) warnings.push('Diagram Mermaid belum terdeteksi.')
  if (!/schema\.prisma|model\s+\w+/i.test(text)) warnings.push('Skema database Prisma belum terdeteksi.')
  return warnings
}

// Common entry files by stack — used to detect missing runnable entries.
const ENTRY_FILES_BY_TEMPLATE = {
  react: ['/App.js', '/App.jsx', '/src/main.jsx', '/src/main.js', '/src/index.jsx', '/src/index.js'],
  'react-ts': ['/App.tsx', '/App.ts', '/src/main.tsx', '/src/main.ts', '/src/index.tsx', '/src/index.ts'],
  vue: ['/src/App.vue', '/App.vue', '/src/main.js', '/src/main.ts'],
  svelte: ['/App.svelte', '/src/App.svelte', '/src/main.js', '/src/main.ts'],
  vanilla: ['/index.js', '/src/main.js', '/src/index.js', '/App.js'],
  'vanilla-ts': ['/index.ts', '/src/main.ts', '/src/index.ts', '/App.ts'],
}

const CSS_IMPORT_RE = /import\s+(?:[^'"]+\s+from\s+)?['"](\.[^'"]+\.css)['"]/g

/**
 * Check whether referenced imports actually exist in the files.
 */
function validateImportPaths(files) {
  const missing = []
  for (const [filePath, code] of Object.entries(files)) {
    const dir = filePath.split('/').slice(0, -1).join('/') || ''
    CSS_IMPORT_RE.lastIndex = 0
    let m
    while ((m = CSS_IMPORT_RE.exec(String(code))) !== null) {
      const rel = m[1].replace(/^\.\//, '').replace(/['"]\s*;?\s*$/, '')
      const refPath = `${dir}/${rel}`.replace(/\/{2,}/g, '/')
      if (!files[refPath]) {
        missing.push(`${filePath} → ${refPath}`)
      }
    }
  }
  return missing
}

export function validateGeneratedFiles(files, template) {
  const warnings = []
  const entries = Object.entries(files || {})
  if (!entries.length) warnings.push('Tidak ada file yang dihasilkan.')

  for (const [path, code] of entries) {
    if (!path.startsWith('/')) warnings.push(`Path ${path} harus diawali "/".`)
    if (path.includes('..')) warnings.push(`Path ${path} tidak aman.`)
    if (String(code || '').trim().length === 0) warnings.push(`File ${path} kosong.`)
  }

  // Check for missing entry file (specific to the template)
  if (template && ENTRY_FILES_BY_TEMPLATE[template]) {
    const hasEntry = ENTRY_FILES_BY_TEMPLATE[template].some((entry) => files[entry])
    if (!hasEntry) {
      warnings.push(`Tidak ada entry file yang dapat dieksekusi untuk stack ${template}. Pastikan ada file seperti ${ENTRY_FILES_BY_TEMPLATE[template].slice(0, 3).join(', ')}.`)
    }
  }

  if (files?.['/package.json']) {
    try {
      JSON.parse(files['/package.json'])
    } catch {
      warnings.push('/package.json tidak valid JSON.')
    }
  }

  // Check for missing CSS imports
  const missingImports = validateImportPaths(files)
  if (missingImports.length > 0) {
    warnings.push(`Import CSS tidak ditemukan: ${missingImports.slice(0, 3).join(', ')}${missingImports.length > 3 ? ` (+${missingImports.length - 3} lainnya)` : ''}`)
  }

  return warnings
}
