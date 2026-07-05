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
  react: `Stack: React (JavaScript). Komponen pakai file .js/.jsx. Entry: /App.js (export default). Styling boleh CSS file atau inline. Hanya gunakan paket yang ada di /package.json; tambahkan dependensi baru ke /package.json bila perlu.`,
  'react-ts': `Stack: React + TypeScript. Pakai file .tsx/.ts dengan tipe yang benar. Entry: /App.tsx (export default). Tambahkan dependensi baru ke /package.json bila perlu.`,
  vue: `Stack: Vue 3 (Composition API, <script setup>). File komponen pakai ekstensi .vue di dalam /src. Entry: /src/App.vue. Jangan pakai sintaks React.`,
  svelte: `Stack: Svelte. File komponen pakai ekstensi .svelte. Entry: /App.svelte. Gunakan sintaks Svelte (reactive declarations, stores), bukan React.`,
  vanilla: `Stack: Vanilla JavaScript (tanpa framework). Manipulasi DOM langsung. Entry: /index.js. /index.html berisi <div id="app">. Jangan pakai JSX atau framework.`,
  'vanilla-ts': `Stack: Vanilla TypeScript (tanpa framework). Entry: /index.ts dengan tipe yang benar. /index.html berisi <div id="app">.`,
  other: `Stack: Custom (sesuai deskripsi pengguna). Pengguna ingin menggunakan stack teknologi khusus. Periksa deskripsi prompt pengguna dan buat berkas-berkas dengan format, ekstensi, dan struktur folder yang sesuai dengan teknologi yang diminta (misal: Python, PHP, Java, HTML statis, Node.js, dll). Catatan: Sandbox visual menggunakan serverless vanilla JS untuk preview, silakan sesuaikan file entry atau index.html agar preview tidak crash jika memungkinkan, namun prioritaskan penulisan struktur kode yang benar sesuai permintaan pengguna.`,
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
