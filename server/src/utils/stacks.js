/**
 * Stack definitions for the Build Code workspace.
 *
 * Each entry maps a Sandpack-compatible template id to:
 *  - label:        human name
 *  - sandpack:     the Sandpack template to mount on the client
 *  - entry:        the main file the AI should edit first
 *  - files:        starter files for a fresh project
 *  - promptHint:   framework-specific guidance appended to the system prompt
 *
 * All templates run fully in the browser via Sandpack. Server-rendered stacks
 * (Next.js full-stack, Django, etc.) are intentionally excluded because the
 * sandbox cannot run a real backend.
 */

export const STACKS = {
  react: {
    label: 'React',
    sandpack: 'react',
    entry: '/App.js',
    files: {
      '/App.js': `import './styles.css';

export default function App() {
  return (
    <div className="app">
      <h1>Halo, AriseHash</h1>
      <p>Ketik instruksi di kiri untuk mulai membangun aplikasimu.</p>
    </div>
  );
}`,
      '/styles.css': `.app { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 20px; }
h1 { font-size: 2rem; }`,
    },
    deps: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'lucide-react': '^0.408.0'
    },
  },

  'react-ts': {
    label: 'React + TypeScript',
    sandpack: 'react-ts',
    entry: '/App.tsx',
    files: {
      '/App.tsx': `import './styles.css';

export default function App(): JSX.Element {
  return (
    <div className="app">
      <h1>Halo, AriseHash</h1>
      <p>Ketik instruksi di kiri untuk mulai membangun aplikasimu.</p>
    </div>
  );
}`,
      '/styles.css': `.app { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 20px; }`,
    },
    deps: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'lucide-react': '^0.408.0'
    },
  },

  vue: {
    label: 'Vue 3',
    sandpack: 'vue',
    entry: '/src/App.vue',
    files: {
      '/src/App.vue': `<template>
  <div class="app">
    <h1>Halo, AriseHash</h1>
    <p>Ketik instruksi di kiri untuk mulai membangun aplikasimu.</p>
  </div>
</template>

<script setup>
</script>

<style>
.app { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 20px; }
</style>`,
    },
    deps: {
      'vue': '^3.2.0'
    },
  },

  svelte: {
    label: 'Svelte',
    sandpack: 'svelte',
    entry: '/App.svelte',
    files: {
      '/App.svelte': `<script>
  let name = 'AriseHash';
</script>

<main>
  <h1>Halo, {name}</h1>
  <p>Ketik instruksi di kiri untuk mulai membangun aplikasimu.</p>
</main>

<style>
  main { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 20px; }
</style>`,
    },
    deps: {
      'svelte': '^3.50.0'
    },
  },

  vanilla: {
    label: 'Vanilla JS',
    sandpack: 'vanilla',
    entry: '/index.js',
    files: {
      '/index.js': `import './styles.css';

document.getElementById('app').innerHTML = \`
  <h1>Halo, AriseHash</h1>
  <p>Ketik instruksi di kiri untuk mulai membangun aplikasimu.</p>
\`;`,
      '/styles.css': `body { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 20px; }`,
      '/index.html': `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>AriseHash</title></head>
  <body><div id="app"></div></body>
</html>`,
    },
    deps: {},
  },

  'vanilla-ts': {
    label: 'Vanilla + TypeScript',
    sandpack: 'vanilla-ts',
    entry: '/index.ts',
    files: {
      '/index.ts': `import './styles.css';
 
const app = document.getElementById('app');
if (app) {
  app.innerHTML = '<h1>Halo, AriseHash</h1><p>Ketik instruksi di kiri untuk mulai membangun aplikasimu.</p>';
}`,
      '/styles.css': `body { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 20px; }`,
      '/index.html': `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>AriseHash</title></head>
  <body><div id="app"></div></body>
</html>`,
    },
    deps: {},
  },

  other: {
    label: 'Lainnya (Jelaskan)',
    sandpack: 'vanilla',
    entry: '/index.js',
    files: {
      '/index.js': `import './styles.css';

document.getElementById('app').innerHTML = \`
  <h1>Custom Stack Workspace</h1>
  <p>Tulis instruksi di kolom chat untuk mulai membangun aplikasi dengan stack pilihan Anda.</p>
\`;`,
      '/styles.css': `body { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 20px; text-align: center; }`,
      '/index.html': `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>AriseHash Workspace</title></head>
  <body><div id="app"></div></body>
</html>`,
    },
    deps: {},
  },
}

const PROMPT_HINTS = {
  react: `Stack: React (JavaScript). Komponen pakai file .js/.jsx. Entry Sandpack default: /App.js (export default). Jika memakai struktur Vite /src, WAJIB sertakan entry runnable /src/main.jsx atau /src/index.jsx yang memanggil ReactDOM.createRoot(...). Jangan hanya membuat /src/App.jsx tanpa entry. Styling boleh CSS file atau inline. Hanya gunakan paket yang ada di /package.json; tambahkan dependensi baru ke /package.json bila perlu.`,
  'react-ts': `Stack: React + TypeScript. Pakai file .tsx/.ts dengan tipe yang benar. Entry Sandpack default: /App.tsx (export default). Jika memakai struktur Vite /src, WAJIB sertakan entry runnable /src/main.tsx atau /src/index.tsx yang memanggil ReactDOM.createRoot(...). Jangan hanya membuat /src/App.tsx tanpa entry. Tambahkan dependensi baru ke /package.json bila perlu.`,
  vue: `Stack: Vue 3 (Composition API, <script setup>). File komponen pakai ekstensi .vue di dalam /src. Entry default: /src/App.vue. Jika membuat /src/main.js atau /src/main.ts, pastikan entry tersebut me-mount App dengan createApp(App).mount('#app'). Jangan pakai sintaks React.`,
  svelte: `Stack: Svelte. File komponen pakai ekstensi .svelte. Entry default: /App.svelte. Jika membuat /src/main.js atau /src/main.ts, pastikan entry tersebut me-mount App Svelte ke document.body atau #app. Gunakan sintaks Svelte, bukan React.`,
  vanilla: `Stack: Vanilla JavaScript (tanpa framework). Manipulasi DOM langsung. Entry default: /index.js. /index.html berisi <div id="app">. Jika memakai /src/main.js atau /src/index.js, pastikan file itu adalah entry runnable. Jangan pakai JSX atau framework.`,
  'vanilla-ts': `Stack: Vanilla TypeScript (tanpa framework). Entry default: /index.ts dengan tipe yang benar. /index.html berisi <div id="app">. Jika memakai /src/main.ts atau /src/index.ts, pastikan file itu adalah entry runnable.`,
  other: `Stack: Custom (sesuai deskripsi pengguna). Pengguna ingin menggunakan stack teknologi khusus. Periksa deskripsi prompt pengguna dan buat berkas-berkas dengan format, ekstensi, dan struktur folder yang sesuai dengan teknologi yang diminta (misal: Python, PHP, Java, HTML statis, Node.js, dll). Catatan: Sandbox visual berjalan sebagai template vanilla JS di browser. Agar preview tidak blank, sediakan /index.html dengan elemen root dan entry runnable /index.js atau /src/main.js bila memungkinkan, namun prioritaskan struktur kode yang benar sesuai permintaan pengguna.`,
}

export function getStack(template) {
  return STACKS[template] || STACKS.react
}

export function defaultFilesFor(template) {
  const stack = getStack(template)
  const deps = { ...stack.deps }
  const pkg = {
    name: 'arisehash-project',
    dependencies: deps,
  }
  return { ...stack.files, '/package.json': JSON.stringify(pkg, null, 2) }
}

export function promptHintFor(template) {
  return PROMPT_HINTS[template] || PROMPT_HINTS.react
}

export function isValidTemplate(template) {
  return Object.prototype.hasOwnProperty.call(STACKS, template)
}

const RUNNABLE_ENTRY_BY_TEMPLATE = {
  react: ['/src/main.jsx', '/src/main.js', '/src/index.jsx', '/src/index.js', '/index.jsx', '/index.js'],
  'react-ts': ['/src/main.tsx', '/src/main.ts', '/src/index.tsx', '/src/index.ts', '/index.tsx', '/index.ts'],
  vue: ['/src/main.js', '/src/main.ts', '/main.js', '/main.ts'],
  svelte: ['/src/main.js', '/src/main.ts', '/main.js', '/main.ts'],
}

function hasRunnableEntry(files, template) {
  return (RUNNABLE_ENTRY_BY_TEMPLATE[template] || []).some((path) => files[path])
}

function copyRelativeCssImports(files, sourcePath, targetDir, updatedPaths) {
  const source = files[sourcePath]
  if (!source) return

  const sourceDir = sourcePath.split('/').slice(0, -1).join('/') || ''
  const cssImportRe = /import\s+(?:[^'"]+\s+from\s+)?['"](\.\/[^'"]+\.css)['"]/g
  let match
  while ((match = cssImportRe.exec(source)) !== null) {
    const rel = match[1].replace(/^\.\//, '')
    const from = `${sourceDir}/${rel}`.replace(/\/{2,}/g, '/')
    const to = `${targetDir}/${rel}`.replace(/\/{2,}/g, '/')
    if (files[from] && !files[to]) {
      files[to] = files[from]
      updatedPaths.push(to)
    }
  }
}

/**
 * Ensure Sandpack's default entry exists for workspace files.
 * Returns /src/main.js content that mounts the Vue app, or null.
 */
function ensureVueEntry(files) {
  if (files['/src/main.js'] || files['/src/main.ts']) return null
  const appContent = files['/src/App.vue']
  if (!appContent) return null
  return `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')`
}

/**
 * Makes common AI-generated Vite-style output runnable in Sandpack templates.
 * Models often emit /src/App.* without a /src/main.* entry, while Sandpack's
 * React/Svelte templates execute root entry files by default.
 */
export function normalizeFilesForSandbox(files, template, updatedPaths = []) {
  const next = { ...files }
  const paths = [...updatedPaths]

  if ((template === 'react' || template === 'vanilla') && !hasRunnableEntry(next, template)) {
    const sourcePath = next['/src/App.jsx'] ? '/src/App.jsx' : (next['/src/App.js'] ? '/src/App.js' : null)
    if (!sourcePath) {
      // Also try /src/index.js as a candidate for vanilla
      const idxPath = next['/src/index.js'] ? '/src/index.js' : null
      if (idxPath && !paths.includes('/index.js')) {
        next['/index.js'] = next[idxPath]
        paths.push('/index.js')
        copyRelativeCssImports(next, idxPath, '', paths)
      }
    } else if (!paths.includes('/App.js')) {
      next['/App.js'] = next[sourcePath]
      paths.push('/App.js')
      copyRelativeCssImports(next, sourcePath, '', paths)
    }
  }

  if (template === 'react-ts' && !hasRunnableEntry(next, template)) {
    const sourcePath = next['/src/App.tsx'] ? '/src/App.tsx' : (next['/src/App.ts'] ? '/src/App.ts' : null)
    if (sourcePath && !paths.includes('/App.tsx')) {
      next['/App.tsx'] = next[sourcePath]
      paths.push('/App.tsx')
      copyRelativeCssImports(next, sourcePath, '', paths)
    }
  }

  if (template === 'vue' && !hasRunnableEntry(next, template)) {
    const mainContent = ensureVueEntry(next)
    if (mainContent) {
      next['/src/main.js'] = mainContent
      paths.push('/src/main.js')
    }
    // Also mirror /src/App.vue to root for Sandpack detection
    if (next['/src/App.vue'] && !paths.includes('/App.vue')) {
      next['/App.vue'] = next['/src/App.vue']
      paths.push('/App.vue')
    }
  }

  if ((template === 'svelte' || template === 'vanilla' || template === 'vanilla-ts') && !hasRunnableEntry(next, template)) {
    if (template === 'svelte' && next['/src/App.svelte'] && !paths.includes('/App.svelte')) {
      next['/App.svelte'] = next['/src/App.svelte']
      paths.push('/App.svelte')
    }
    // For vanilla + vanilla-ts: mirror /src/index.* to root if no entry
    if ((template === 'vanilla' || template === 'vanilla-ts') && !hasRunnableEntry(next, template)) {
      const ext = template === 'vanilla-ts' ? 'ts' : 'js'
      const srcPath = next[`/src/index.${ext}`] ? `/src/index.${ext}` : null
      if (srcPath && !paths.includes(`/index.${ext}`)) {
        next[`/index.${ext}`] = next[srcPath]
        paths.push(`/index.${ext}`)
      }
    }
  }

  return { files: next, updatedPaths: [...new Set(paths)] }
}
