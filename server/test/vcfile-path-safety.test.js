/**
 * Regression test: AI-generated <vcFile> / fenced paths must not allow
 * directory traversal ("..") into the workspace or a ZIP-slip on export.
 * Mirrors the safeProjectPath logic used in routes/codeProjects.js stream handler.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

// Same normaliser as the stream route.
function safeProjectPath(raw) {
  if (!raw) return null
  let p = String(raw).trim().replace(/\\/g, '/')
  if (!p.startsWith('/')) p = '/' + p
  p = p.replace(/\/{2,}/g, '/')
  if (p.split('/').some((seg) => seg === '..')) return null
  return p
}

// Parse like the route does, but through safeProjectPath.
function parseFiles(content) {
  const regex = /<vcFile\s+path="([^"]+)">([\s\S]*?)(?:<\/vcFile>|$)/g
  const out = {}
  let m
  while ((m = regex.exec(content)) !== null) {
    const p = safeProjectPath(m[1])
    if (p) out[p] = m[2].trim()
  }
  return out
}

test('rejects absolute traversal path', () => {
  const files = parseFiles('<vcFile path="/../../etc/passwd">x</vcFile>')
  assert.deepEqual(Object.keys(files), [])
})

test('rejects relative traversal path', () => {
  const files = parseFiles('<vcFile path="../evil.js">x</vcFile>')
  assert.deepEqual(Object.keys(files), [])
})

test('rejects mid-path traversal segment', () => {
  const files = parseFiles('<vcFile path="/src/../../secret.js">x</vcFile>')
  assert.deepEqual(Object.keys(files), [])
})

test('normalises missing leading slash', () => {
  const files = parseFiles('<vcFile path="App.js">code</vcFile>')
  assert.deepEqual(Object.keys(files), ['/App.js'])
})

test('collapses duplicate slashes', () => {
  const files = parseFiles('<vcFile path="/src//components///Btn.jsx">code</vcFile>')
  assert.deepEqual(Object.keys(files), ['/src/components/Btn.jsx'])
})

test('keeps valid nested path and content intact', () => {
  const files = parseFiles('<vcFile path="/src/App.jsx">const a = 1</vcFile>')
  assert.equal(files['/src/App.jsx'], 'const a = 1')
})

test('mixed safe + unsafe: keeps only safe', () => {
  const files = parseFiles(
    '<vcFile path="/App.js">ok</vcFile><vcFile path="/../../x">bad</vcFile>'
  )
  assert.deepEqual(Object.keys(files), ['/App.js'])
})
