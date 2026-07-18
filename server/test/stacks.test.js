import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFilesForSandbox } from '../src/utils/stacks.js'

test('normalizeFilesForSandbox mirrors React src/App.jsx to root App.js when no runnable entry exists', () => {
  const result = normalizeFilesForSandbox({
    '/App.js': 'export default function App() { return <p>starter</p> }',
    '/src/App.jsx': "import './App.css'\nexport default function App() { return <h1>Generated</h1> }",
    '/src/App.css': 'h1 { color: red; }',
    '/package.json': '{}'
  }, 'react', ['/src/App.jsx', '/src/App.css'])

  assert.match(result.files['/App.js'], /Generated/)
  assert.equal(result.files['/App.css'], 'h1 { color: red; }')
  assert.ok(result.updatedPaths.includes('/App.js'))
  assert.ok(result.updatedPaths.includes('/App.css'))
})

test('normalizeFilesForSandbox leaves React Vite projects alone when a runnable main entry exists', () => {
  const result = normalizeFilesForSandbox({
    '/App.js': 'starter',
    '/src/main.jsx': 'import "./App.jsx"',
    '/src/App.jsx': 'generated'
  }, 'react', ['/src/main.jsx', '/src/App.jsx'])

  assert.equal(result.files['/App.js'], 'starter')
  assert.deepEqual(result.updatedPaths, ['/src/main.jsx', '/src/App.jsx'])
})

test('normalizeFilesForSandbox mirrors Svelte src/App.svelte when no runnable entry exists', () => {
  const result = normalizeFilesForSandbox({
    '/src/App.svelte': '<h1>Generated</h1>'
  }, 'svelte', ['/src/App.svelte'])

  assert.equal(result.files['/App.svelte'], '<h1>Generated</h1>')
  assert.ok(result.updatedPaths.includes('/App.svelte'))
})
