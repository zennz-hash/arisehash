import { useRef, useEffect, useCallback } from 'react'

/* DotGrid background — adapted from reactbits.dev (DavidHDev/react-bits),
   ported to vanilla canvas (no GSAP). Dots brighten near the cursor and
   get a soft push that springs back. Monochrome / theme-driven. */

function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 255, g: 255, b: 255 }
}

export default function DotGrid({
  dotSize = 4, gap = 28,
  baseColor = '#2a2a30', activeColor = '#f5f5f6',
  proximity = 130, speedTrigger = 90, maxSpeed = 5000,
  className = '', style = {},
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const dotsRef = useRef([])
  const pointerRef = useRef({ x: -9999, y: -9999, lastX: 0, lastY: 0, lastTime: 0, vx: 0, vy: 0, speed: 0 })
  const rafRef = useRef(0)

  const baseRgb = hexToRgb(baseColor)
  const activeRgb = hexToRgb(activeColor)

  const buildGrid = useCallback(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current
    if (!wrap || !canvas) return
    const { width, height } = wrap.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr; canvas.height = height * dpr
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cell = dotSize + gap
    const cols = Math.floor((width + gap) / cell)
    const rows = Math.floor((height + gap) / cell)
    const startX = (width - (cell * cols - gap)) / 2 + dotSize / 2
    const startY = (height - (cell * rows - gap)) / 2 + dotSize / 2
    const dots = []
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      dots.push({ cx: startX + x * cell, cy: startY + y * cell, ox: 0, oy: 0, vx: 0, vy: 0 })
    }
    dotsRef.current = dots
  }, [dotSize, gap])

  useEffect(() => {
    buildGrid()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = canvasRef.current.getContext('2d')
    const proxSq = proximity * proximity

    const draw = () => {
      const canvas = canvasRef.current
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const { x: px, y: py } = pointerRef.current
      for (const d of dotsRef.current) {
        // spring offset back to origin
        d.vx += (0 - d.ox) * 0.08; d.vy += (0 - d.oy) * 0.08
        d.vx *= 0.82; d.vy *= 0.82
        d.ox += d.vx; d.oy += d.vy
        const ox = d.cx + d.ox, oy = d.cy + d.oy
        const dx = d.cx - px, dy = d.cy - py
        const dsq = dx * dx + dy * dy
        let r = baseRgb.r, g = baseRgb.g, b = baseRgb.b
        if (dsq <= proxSq) {
          const t = 1 - Math.sqrt(dsq) / proximity
          r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t)
          g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t)
          b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t)
        }
        ctx.beginPath()
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.arc(ox, oy, dotSize / 2, 0, Math.PI * 2)
        ctx.fill()
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()

    const onMove = (e) => {
      const pr = pointerRef.current, now = performance.now()
      const dt = pr.lastTime ? now - pr.lastTime : 16
      const dx = e.clientX - pr.lastX, dy = e.clientY - pr.lastY
      let vx = (dx / dt) * 1000, vy = (dy / dt) * 1000
      let speed = Math.hypot(vx, vy)
      if (speed > maxSpeed) { const s = maxSpeed / speed; vx *= s; vy *= s; speed = maxSpeed }
      pr.lastTime = now; pr.lastX = e.clientX; pr.lastY = e.clientY
      const rect = canvasRef.current.getBoundingClientRect()
      pr.x = e.clientX - rect.left; pr.y = e.clientY - rect.top
      if (reduce) return
      if (speed > speedTrigger) {
        for (const d of dotsRef.current) {
          const dist = Math.hypot(d.cx - pr.x, d.cy - pr.y)
          if (dist < proximity) {
            const f = (1 - dist / proximity)
            d.vx += (d.cx - pr.x) * 0.002 * f + vx * 0.0006 * f
            d.vy += (d.cy - pr.y) * 0.002 * f + vy * 0.0006 * f
          }
        }
      }
    }
    const ro = 'ResizeObserver' in window ? new ResizeObserver(buildGrid) : null
    if (ro) ro.observe(wrapRef.current); else window.addEventListener('resize', buildGrid)
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMove)
      if (ro) ro.disconnect(); else window.removeEventListener('resize', buildGrid)
    }
  }, [buildGrid, proximity, speedTrigger, maxSpeed, dotSize]) // eslint-disable-line

  return (
    <div ref={wrapRef} className={`dotgrid ${className}`} style={style} aria-hidden="true">
      <canvas ref={canvasRef} className="dotgrid-canvas" />
    </div>
  )
}
