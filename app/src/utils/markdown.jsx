/**
 * Shared inline markdown renderer.
 * Handles `code`, **bold**, and *italic*.
 * Used by MarkdownProse (Chat.jsx) and Markdown (Store.jsx).
 *
 * @param {string} text - Text to render
 * @param {string|number} keyPrefix - Unique prefix for React keys
 * @param {string} [clsPrefix=''] - CSS class prefix for inline code elements (e.g., 'chat-', 'prd-')
 */
export function renderInline(text, keyPrefix, clsPrefix = '') {
  const nodes = []
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g
  let last = 0, m, i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('`')) {
      const codeClass = clsPrefix ? `${clsPrefix}code-inline` : 'md-code-inline'
      nodes.push(<code key={`${keyPrefix}c${i}`} className={codeClass}>{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}b${i}`}>{tok.slice(2, -2)}</strong>)
    } else {
      nodes.push(<em key={`${keyPrefix}i${i}`}>{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length; i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
