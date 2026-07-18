const STACK_TEMPLATE_MAP = {
  other: 'vanilla',
}

const EXECUTABLE_ENTRIES = {
  react: ['/src/main.jsx', '/src/main.js', '/src/index.jsx', '/src/index.js', '/index.jsx', '/index.js', '/App.js', '/App.jsx'],
  'react-ts': ['/src/main.tsx', '/src/main.ts', '/src/index.tsx', '/src/index.ts', '/index.tsx', '/index.ts', '/App.tsx', '/App.ts'],
  vue: ['/src/main.js', '/src/main.ts', '/main.js', '/main.ts', '/src/App.vue', '/App.vue'],
  svelte: ['/src/main.js', '/src/main.ts', '/main.js', '/main.ts', '/App.svelte', '/src/App.svelte'],
  vanilla: ['/index.js', '/src/main.js', '/src/index.js', '/App.js'],
  'vanilla-ts': ['/index.ts', '/src/main.ts', '/src/index.ts', '/App.ts'],
}

const ACTIVE_FILE_CANDIDATES = {
  react: ['/App.js', '/App.jsx', '/src/App.jsx', '/src/App.js', ...EXECUTABLE_ENTRIES.react],
  'react-ts': ['/App.tsx', '/App.ts', '/src/App.tsx', '/src/App.ts', ...EXECUTABLE_ENTRIES['react-ts']],
  vue: ['/src/App.vue', '/App.vue', ...EXECUTABLE_ENTRIES.vue],
  svelte: ['/App.svelte', '/src/App.svelte', ...EXECUTABLE_ENTRIES.svelte],
  vanilla: ['/index.js', '/src/main.js', '/src/index.js', '/index.html', '/App.js'],
  'vanilla-ts': ['/index.ts', '/src/main.ts', '/src/index.ts', '/index.html', '/App.ts'],
}

function stableHash(value) {
  const text = String(value || '')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

export function safeParsePackage(pkgText) {
  try {
    const parsed = JSON.parse(pkgText || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function safeParseDeps(pkgText) {
  return safeParsePackage(pkgText).dependencies || {}
}

export function getSandpackTemplate(projectTemplate) {
  const template = projectTemplate || 'react'
  return STACK_TEMPLATE_MAP[template] || template
}

export function getSandpackEntry(projectTemplate, files = {}) {
  const template = getSandpackTemplate(projectTemplate)
  const candidates = EXECUTABLE_ENTRIES[template] || EXECUTABLE_ENTRIES.react
  return candidates.find((path) => Object.prototype.hasOwnProperty.call(files, path))
}

export function getPreferredActiveFile(projectTemplate, files = {}, activeFile) {
  if (activeFile && Object.prototype.hasOwnProperty.call(files, activeFile)) return activeFile

  const template = getSandpackTemplate(projectTemplate)
  const candidates = ACTIVE_FILE_CANDIDATES[template] || ACTIVE_FILE_CANDIDATES.react
  return candidates.find((path) => Object.prototype.hasOwnProperty.call(files, path))
    || Object.keys(files).find((path) => path !== '/package.json' && !path.endsWith('.html') && !path.endsWith('.css'))
    || Object.keys(files)[0]
    || '/App.js'
}

export function buildSandpackSetup(projectTemplate, files = {}, activeFile, keyScope = 'workspace') {
  const template = getSandpackTemplate(projectTemplate)
  const entry = getSandpackEntry(projectTemplate, files)
  const dependencies = safeParseDeps(files['/package.json'])
  const customSetup = entry ? { dependencies, entry } : { dependencies }
  const providerKey = [
    keyScope,
    template,
    entry || 'default-entry',
    stableHash(files['/package.json'] || ''),
  ].join(':')

  return {
    template,
    entry,
    customSetup,
    providerKey,
    activeFile: getPreferredActiveFile(projectTemplate, files, activeFile),
    visibleFiles: Object.keys(files),
  }
}
