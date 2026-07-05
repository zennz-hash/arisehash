import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import MermaidRender from '../MermaidRender.jsx'

describe('MermaidRender', () => {
  let origCreateElement

  beforeEach(() => {
    // Mock window.mermaid
    window.mermaid = {
      initialize: vi.fn(),
      render: vi.fn().mockResolvedValue({ svg: '<svg>rendered</svg>' }),
    }
    // Spy on createElement without overriding it — the component's script-loading
    // logic uses document.createElement, and we let it work normally.
    origCreateElement = document.createElement.bind(document)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.mermaid
  })

  it('renders loading text when no chart provided', () => {
    render(<MermaidRender chart="" />)
    expect(screen.getByText('Memuat diagram...')).toBeInTheDocument()
  })

  it('renders loading text when chart is null', () => {
    render(<MermaidRender chart={null} />)
    expect(screen.getByText('Memuat diagram...')).toBeInTheDocument()
  })

  it('renders custom loading text when provided', () => {
    render(<MermaidRender chart="" loadingText="Loading..." />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('initializes mermaid with correct config', async () => {
    render(<MermaidRender chart="flowchart TD; A-->B;" />)
    await act(async () => { await Promise.resolve() })

    await vi.waitFor(() => {
      expect(window.mermaid.initialize).toHaveBeenCalledWith({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'strict',
        suppressErrorRendering: true,
      })
    })
  })

  it('calls mermaid.render with the chart content', async () => {
    const chart = 'flowchart TD; A-->B;'
    render(<MermaidRender chart={chart} />)
    await act(async () => { await Promise.resolve() })

    await vi.waitFor(() => {
      expect(window.mermaid.render).toHaveBeenCalledWith(
        expect.stringContaining('mm-'),
        chart,
      )
    })
  })

  it('uses securityLevel="strict" when passed', async () => {
    render(<MermaidRender chart="flowchart TD; A-->B;" securityLevel="strict" />)
    await act(async () => { await Promise.resolve() })

    await vi.waitFor(() => {
      expect(window.mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ securityLevel: 'strict' }),
      )
    })
  })

  it('shows error fallback when mermaid.render fails', async () => {
    window.mermaid.render.mockRejectedValue(new Error('render failed'))

    render(<MermaidRender chart="flowchart TD; A-->B;" />)
    await act(async () => { await Promise.resolve() })

    // Teks fallback ada di dalam dangerouslySetInnerHTML, gunakan regex
    const el = await screen.findByText(/Gagal merender diagram/, {}, { timeout: 2000 })
    expect(el).toBeInTheDocument()
  })
})
