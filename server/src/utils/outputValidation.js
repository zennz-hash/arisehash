export function validateBlueprintContent(content) {
  const warnings = []
  const text = String(content || '')
  if (text.length < 800) warnings.push('Dokumen PRD terlihat terlalu pendek.')
  if (!/^#\s+/m.test(text)) warnings.push('Dokumen belum memiliki heading utama Markdown.')
  if (!/```mermaid[\s\S]*?```/i.test(text)) warnings.push('Diagram Mermaid belum terdeteksi.')
  if (!/schema\.prisma|model\s+\w+/i.test(text)) warnings.push('Skema database Prisma belum terdeteksi.')
  return warnings
}

export function validateGeneratedFiles(files) {
  const warnings = []
  const entries = Object.entries(files || {})
  if (!entries.length) warnings.push('Tidak ada file yang dihasilkan.')

  for (const [path, code] of entries) {
    if (!path.startsWith('/')) warnings.push(`Path ${path} harus diawali "/".`)
    if (path.includes('..')) warnings.push(`Path ${path} tidak aman.`)
    if (String(code || '').trim().length === 0) warnings.push(`File ${path} kosong.`)
  }

  if (files?.['/package.json']) {
    try {
      JSON.parse(files['/package.json'])
    } catch {
      warnings.push('/package.json tidak valid JSON.')
    }
  }

  return warnings
}
