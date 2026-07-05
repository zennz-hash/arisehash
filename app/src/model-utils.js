import { Zap, Code } from 'lucide-react'
import { createModelIcon } from './components/ModelIcon.jsx'

/**
 * Parse a unified model-selection value into model / aiKeyId parts.
 * Admin model IDs are returned as-is; BYOK keys use the `key:${id}` form.
 */
export function parseModelSelection(value) {
  if (!value) return { model: null, aiKeyId: null }
  if (typeof value === 'string' && value.startsWith('key:')) {
    return { model: null, aiKeyId: value.slice(4) }
  }
  return { model: value, aiKeyId: null }
}

/**
 * Build dropdown options from admin models + BYOK keys.
 */
export function buildModelOptions(adminModels = [], aiKeys = [], planType = 'FREE') {
  const out = []
  if (adminModels?.length) {
    out.push(
      ...adminModels.map((m) => {
        const icon = createModelIcon(m.label || m.model)
        const isLocked = planType === 'FREE' && !m.model.startsWith('mimo-v2.5')
        return {
          value: m.id,
          label: m.label,
          desc: m.model,
          icon: icon || Zap,
          isLocked,
        }
      })
    )
  }
  if (aiKeys?.length) {
    out.push(
      ...aiKeys.map((k) => ({
        value: `key:${k.id}`,
        label: k.label,
        icon: Code,
        desc: `${k.provider} \u00b7 ${k.model}`,
        isLocked: planType === 'FREE',
      }))
    )
  }
  return out
}

/**
 * Resolve a human-readable label for the currently selected model value.
 */
export function getModelLabel(value, adminModels = [], aiKeys = []) {
  if (typeof value === 'string' && value.startsWith('key:')) {
    const key = aiKeys.find((k) => k.id === value.slice(4))
    return key?.label || 'BYOK'
  }
  const am = adminModels.find((m) => m.id === value)
  return am?.label || 'Model'
}
