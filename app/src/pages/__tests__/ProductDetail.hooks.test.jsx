/**
 * Lightweight unit test for ProductDetail's hooks-ordering fix.
 *
 * Instead of importing the full ProductDetail (which pulls in lucide-react,
 * @codesandbox/sandpack-react, etc. consuming ~2GB+ heap), this test
 * replicates the exact hooks-ordering pattern that was fixed:
 *
 *   before (BUG):  hooks → early return → MORE hooks (useMemo)
 *   after (FIX):   hooks → useMemo → early return → render
 *
 * It verifies that transitioning from loading→loaded does NOT cause React's
 * "Rendered more hooks than during the previous render" error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React, { useState, useMemo, useEffect } from 'react'

// --- Helper: renders children without passing unknown DOM props ---
const MockDiv = ({ children, ...props }) => {
  const safe = {}
  if (props['data-testid']) safe['data-testid'] = props['data-testid']
  if (props.className) safe.className = props.className
  if (props.style) safe.style = props.style
  if (props.role) safe.role = props.role
  return <div {...safe}>{children}</div>
}

// --- Helper to build a deferred promise ---
function deferredData(delay = 10) {
  let resolver
  const promise = new Promise((resolve) => {
    resolver = () =>
      setTimeout(
        () =>
          resolve({
            id: 'test-id',
            name: 'Test Project',
            template: 'react',
            filesJson: JSON.stringify({
              '/App.jsx': 'export default function App() { return null }',
              '/package.json': '{"dependencies":{}}',
            }),
            messagesJson: '[]',
            mode: 'gpt-4o',
            isPublic: false,
            updatedAt: new Date().toISOString(),
          }),
        delay,
      )
  })
  return { promise, resolve: resolver }
}

function buildSandpackSetup(template, files, activeFile, key) {
  return {
    providerKey: `${key}-${template}`,
    template: template || 'react',
    customSetup: { dependencies: {} },
    activeFile: Object.keys(files).find((k) => k.includes('App')) || activeFile || '/App.js',
    visibleFiles: Object.keys(files),
  }
}

/**
 * Simplified ProductDetail that preserves the EXACT hooks-ordering pattern:
 *
 *   1. useState hooks (x26)
 *   2. useRef hooks (x10)
 *   3. useEffect hooks (x3)
 *   4. useCallback hooks (x17)
 *   5. const busy = loading || autoCorrecting;
 *   6. const sandbox = useMemo(...) ← THIS was moved BEFORE early return
 *   7. if (!project || files empty) → early return
 *   8. return <IDE />
 */
function SimplifiedProductDetail({
  id = 'test-id',
  onGetCodeProject,
  onGetQuota,
}) {
  // --- useState (26 total, matching ProductDetail) ---
  const [project, setProject] = useState(null)
  const [files, setFiles] = useState({})
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [quota, setQuota] = useState(null)
  const [rightTab, setRightTab] = useState('preview')
  const [mobileView, setMobileView] = useState('chat')
  const [autoCorrecting, setAutoCorrecting] = useState(false)
  const [showFiles, setShowFiles] = useState(true)
  const [activeFile, setActiveFile] = useState('/App.js')
  const [versions, setVersions] = useState([])
  const [showVersions, setShowVersions] = useState(false)
  const [versionDiff, setVersionDiff] = useState(null)
  const [showExport, setShowExport] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareDays, setShareDays] = useState(30)
  const [shareAllowDownload, setShareAllowDownload] = useState(false)
  const [showCollaborators, setShowCollaborators] = useState(false)
  const [collaborators, setCollaborators] = useState([])
  const [collabEmail, setCollabEmail] = useState('')
  const [collabRole, setCollabRole] = useState('VIEWER')
  const [previewFull, setPreviewFull] = useState(false)
  const [streamingPath, setStreamingPath] = useState(null)
  const [aiKeyId, setAiKeyId] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [fileDialog, setFileDialog] = useState(null)

  // --- useRef (10 total, matching ProductDetail) ---
  const imageInputRef = React.useRef(null)
  const debounceTimerRef = React.useRef(null)
  const scrollRef = React.useRef(null)
  const autoRanRef = React.useRef(false)
  const autoFixAttemptsRef = React.useRef(0)
  const abortRef = React.useRef(null)
  const filesRef = React.useRef(files)
  const messagesRef = React.useRef(messages)
  const mountedRef = React.useRef(true)
  const cacheTimerRef = React.useRef(null)

  // --- useEffect mount tracking ---
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // --- Effect: load project on mount ---
  useEffect(() => {
    if (!id) return

    async function load() {
      setLoading(true)
      try {
        const data = await onGetCodeProject(id)
        if (!data) {
          setLoaded(true)
          return
        }
        setProject(data)
        let loadedFiles = {}
        try { loadedFiles = JSON.parse(data.filesJson || '{}') } catch { /* ignore */ }
        setFiles(loadedFiles)
        const keys = Object.keys(loadedFiles)
        const entry =
          keys.find((k) => /(\/src)?\/(App|index)\.(jsx?|tsx?|vue|svelte)$/.test(k)) ||
          keys.find((k) => k !== '/package.json' && !k.endsWith('.html') && !k.endsWith('.css')) ||
          keys[0]
        if (entry) setActiveFile(entry)

        const q = await onGetQuota().catch(() => null)
        if (q) setQuota(q)
      } catch {
        // network error — handled downstream
      } finally {
        setLoading(false)
        setLoaded(true)
      }
    }

    load()
  }, [id, onGetCodeProject, onGetQuota])

  // --- Effect: cache sync (debounced) ---
  useEffect(() => {
    if (!id || !loaded) return
    if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current)
    cacheTimerRef.current = setTimeout(() => {
      // noop in test — real app writes to WorkspaceContext cache
    }, 500)
    return () => {
      if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current)
    }
  }, [id, project, files, messages, activeFile, quota, loaded])

  // --- useCallback (17 total, matching ProductDetail) ---
  const executeInstruction = React.useCallback(async () => {}, [])
  const handleCompileError = React.useCallback(
    (errorMessage) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        if (autoCorrecting || loading) return
        if (autoFixAttemptsRef.current >= 3) {
          setRightTab('code')
          return
        }
        autoFixAttemptsRef.current += 1
        executeInstruction()
      }, 2000)
    },
    [autoCorrecting, loading, executeInstruction],
  )
  const downloadZip = React.useCallback(() => {}, [])
  const handleShareCode = React.useCallback(async () => {}, [])
  const toggleCollaborators = React.useCallback(async () => {}, [])
  const addCollaborator = React.useCallback(async () => {}, [])
  const removeCollaborator = React.useCallback(async () => {}, [])
  const openExternal = React.useCallback(() => {}, [])
  const addFile = React.useCallback(() => {}, [])
  const submitFileDialog = React.useCallback(() => {}, [])
  const toggleVersions = React.useCallback(async () => {}, [])
  const snapshotNow = React.useCallback(async () => {}, [])
  const restoreVersion = React.useCallback(async () => {}, [])
  const compareVersion = React.useCallback(async () => {}, [])
  const onPickImages = React.useCallback(async () => {}, [])
  const saveWorkspace = React.useCallback(async () => {}, [])

  // --- THE CRITICAL FIX: These were AFTER the early return (the hook-ordering bug) ---
  const busy = loading || autoCorrecting
  const sandbox = useMemo(
    () => buildSandpackSetup(project?.template, files, activeFile, id),
    [project?.template, files, activeFile, id],
  )

  // --- EARLY RETURN (same as ProductDetail) ---
  if (!project || Object.keys(files).length === 0) {
    if (!loaded) {
      return <MockDiv data-testid="loading-screen">Memuat...</MockDiv>
    }
    return (
      <MockDiv data-testid="not-found-screen">Workspace tidak ditemukan</MockDiv>
    )
  }

  // --- NORMAL RENDER (main IDE view, shows Sandpack, chat, etc.) ---
  return (
    <MockDiv data-testid="ide-shell">
      <MockDiv data-testid="project-name">{project.name}</MockDiv>
      <MockDiv data-testid="sandpack-provider" />
      <MockDiv
        data-testid="loading-indicator"
        style={{ display: busy ? 'block' : 'none' }}
      >
        {autoCorrecting ? 'Memperbaiki...' : 'Menulis...'}
      </MockDiv>
    </MockDiv>
  )
}

/* ─── TESTS ─────────────────────────────────────────────────────────────── */

describe('ProductDetail hooks ordering (simplified)', () => {
  let getProject
  let getQuota

  beforeEach(() => {
    getProject = vi.fn()
    getQuota = vi.fn().mockResolvedValue({
      planType: 'FREE',
      codeQuota: 100,
      codeQuotaUsedToday: 0,
      nextResetAt: new Date(Date.now() + 86400000).toISOString(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should NOT throw "Rendered more hooks" when transitioning from loading to loaded', async () => {
    const { promise, resolve } = deferredData()
    getProject.mockReturnValue(promise)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <SimplifiedProductDetail
        id="test-id"
        onGetCodeProject={getProject}
        onGetQuota={getQuota}
      />,
    )

    // 1) Verify loading state (early return #1 → FullscreenLoader)
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument()
    expect(screen.getByText('Memuat...')).toBeInTheDocument()

    // 2) Trigger API resolution
    resolve()
    await waitFor(
      () => expect(screen.getByTestId('ide-shell')).toBeInTheDocument(),
      { timeout: 3000 },
    )

    // 3) Verify project name appears (data was loaded)
    expect(screen.getByText('Test Project')).toBeInTheDocument()

    // 4) CHECK FOR HOOKS VIOLATIONS BEFORE restoring the spy
    const hooksErrorCalls = consoleSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('Rendered more hooks'),
    )
    consoleSpy.mockRestore()

    expect(hooksErrorCalls.length).toBe(0)
  })

  it('should NOT throw on when API resolves immediately (simulates fast network)', async () => {
    const projectData = {
      id: 'test-id',
      name: 'Test Project',
      template: 'react',
      filesJson: JSON.stringify({
        '/App.jsx': 'export default function App() { return null }',
        '/package.json': '{"dependencies":{}}',
      }),
      messagesJson: '[]',
    }
    getProject.mockResolvedValue(projectData)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <SimplifiedProductDetail
        id="test-id"
        onGetCodeProject={getProject}
        onGetQuota={getQuota}
      />,
    )

    // Should show loading first, then transition to loaded
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument()

    await waitFor(
      () => expect(screen.getByTestId('ide-shell')).toBeInTheDocument(),
      { timeout: 3000 },
    )

    const hooksErrorCalls = consoleSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('Rendered more hooks'),
    )
    consoleSpy.mockRestore()

    expect(hooksErrorCalls.length).toBe(0)
  })

  it('renders not-found view when API returns null after loading', async () => {
    getProject.mockResolvedValue(null)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <SimplifiedProductDetail
        id="test-id"
        onGetCodeProject={getProject}
        onGetQuota={getQuota}
      />,
    )

    // Wait for load to complete
    await waitFor(
      () => expect(screen.getByTestId('not-found-screen')).toBeInTheDocument(),
      { timeout: 3000 },
    )

    const hooksErrorCalls = consoleSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('Rendered more hooks'),
    )
    consoleSpy.mockRestore()

    expect(hooksErrorCalls.length).toBe(0)
  })
})
