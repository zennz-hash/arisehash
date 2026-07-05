import { useState, useEffect } from 'react'

/**
 * Renders a Mermaid diagram from a chart definition string.
 *
 * Props:
 *  - chart: Mermaid diagram source code (string)
 *  - securityLevel: 'strict' | 'loose' (default 'strict')
 *  - loadingText: text shown while loading (default 'Memuat diagram...')
 */
export default function MermaidRender({ chart, securityLevel = 'strict', loadingText = 'Memuat diagram...' }) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let active = true
    if (!chart) return

    async function draw() {
      const id = 'mm-' + Math.random().toString(36).slice(2, 9)
      try {
        if (!window.mermaid) {
          await new Promise((resolve) => {
            const script = document.createElement('script')
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
            script.onload = resolve
            document.body.appendChild(script)
          })
        }
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel,
          suppressErrorRendering: true,
        })
        const { svg: renderedSvg } = await window.mermaid.render(id, chart)
        if (active) setSvg(renderedSvg)
      } catch (err) {
        // Clean up stray elements mermaid may have left in document.body
        const stray = document.getElementById(id) || document.getElementById(`d${id}`)
        if (stray) stray.remove()
        const errorElements = document.querySelectorAll(`div[id^="d${id}"], div[id^="${id}"]`)
        errorElements.forEach((el) => {
          if (el.parentNode === document.body) el.remove()
        })
        if (active) {
          setSvg(
            '<div style="padding: 12px; border: 1.5px solid var(--line-soft); border-radius: 12px; background: var(--surface-2); font-family: monospace; font-size: 12px;">Gagal merender diagram.</div>'
          )
        }
      }
    }

    draw()
    return () => {
      active = false
    }
  }, [chart, securityLevel])

  if (!svg) {
    return <p className="text-muted" style={{ fontSize: 13.5 }}>{loadingText}</p>
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />
}
