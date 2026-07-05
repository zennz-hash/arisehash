import test from 'node:test'
import assert from 'node:assert/strict'
import { validateBlueprintContent, validateGeneratedFiles } from '../src/utils/outputValidation.js'

test('validateBlueprintContent accepts a complete-ish PRD', () => {
  const content = `# PRD\n\n${'lorem '.repeat(200)}\n\n\`\`\`mermaid\nflowchart TD\nA-->B\n\`\`\`\n\n\`\`\`prisma\nmodel User { id String @id }\n\`\`\``
  assert.deepEqual(validateBlueprintContent(content), [])
})

test('validateBlueprintContent warns on missing sections', () => {
  const warnings = validateBlueprintContent('# Pendek')
  assert.ok(warnings.length >= 2)
})

test('validateGeneratedFiles catches unsafe paths and invalid package json', () => {
  const warnings = validateGeneratedFiles({
    '../bad.js': 'x',
    '/package.json': '{ nope'
  })
  assert.ok(warnings.some((w) => w.includes('tidak aman')))
  assert.ok(warnings.some((w) => w.includes('package.json')))
})
