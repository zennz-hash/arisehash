import React from 'react'

/**
 * Map model labels to logo image paths in /public/images.
 */
const LOGO_MAP = {
  'kimi-k2.6': '/images/kimi-ai.png',
  'minimax-m2.7': '/images/minimax.png',
  'mimo': '/images/minimax.png',
  'gemini-2.5-flash': '/images/gemini.png',
  'opus-4-8': '/images/anthropic.png',
  'gemini': '/images/gemini.png',
  // fallbacks kept for convenience
  'claude opus (9router)': '/images/anthropic.png',
  'claude': '/images/anthropic.png',
  'anthropic': '/images/anthropic.png',
}

function resolveLogo(labelOrModel = '') {
  const key = Object.keys(LOGO_MAP).find(
    (k) => labelOrModel.toLowerCase().includes(k)
  )
  return key ? LOGO_MAP[key] : null
}

export default function ModelIcon({ label, size = 16, className = '' }) {
  const src = resolveLogo(label)
  if (!src) return null
  return (
    <img
      src={src}
      alt={label}
      width={size}
      height={size}
      className={className}
      style={{
        flexShrink: 0,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'inline-block',
      }}
      draggable={false}
    />
  )
}

/**
 * Create a Lucide-compatible icon component for a given model label.
 * Returns a function component that accepts { size } so Dropdown.jsx
 * can render <Icon size={14} />.
 */
export function createModelIcon(label) {
  const src = resolveLogo(label)
  if (!src) return null
  return function Icon({ size = 16 }) {
    return <ModelIcon label={label} size={size} />
  }
}
