import { describe, expect, it } from 'vitest'
import { buildSandpackSetup, getSandpackEntry, getSandpackTemplate, safeParseDeps } from '../sandpackSetup.js'

describe('sandpackSetup', () => {
  it('maps custom "other" stack to a runnable vanilla Sandpack template', () => {
    expect(getSandpackTemplate('other')).toBe('vanilla')
  })

  it('detects Vite React entry files so generated projects run in preview', () => {
    const files = {
      '/src/main.jsx': 'import React from "react"',
      '/src/App.jsx': 'export default function App() { return null }',
      '/package.json': '{"dependencies":{"react":"^18.2.0"}}'
    }

    expect(getSandpackEntry('react', files)).toBe('/src/main.jsx')
  })

  it('builds customSetup with dependencies and entry without throwing on bad package json', () => {
    const files = {
      '/src/main.tsx': 'import React from "react"',
      '/package.json': '{broken'
    }

    expect(safeParseDeps(files['/package.json'])).toEqual({})
    expect(buildSandpackSetup('react-ts', files, '/missing.js', 'p1')).toMatchObject({
      template: 'react-ts',
      entry: '/src/main.tsx',
      activeFile: '/src/main.tsx',
      customSetup: {
        dependencies: {},
        entry: '/src/main.tsx'
      }
    })
  })
})
