import test from 'node:test'
import assert from 'node:assert/strict'
import { createThinkFilter } from '../src/utils/ai.js'

/**
 * Helper: run a sequence of tokens through the filter and collect the output.
 */
function runFilter(inputTokens) {
  const output = []
  const filter = createThinkFilter((t) => output.push(t))
  for (const tok of inputTokens) {
    filter(tok)
  }
  return output.join('')
}

test('thinkFilter: passes through text without think tags unchanged', () => {
  const result = runFilter(['Hello', ' ', 'World'])
  assert.equal(result, 'Hello World')
})

test('thinkFilter: strips single <think>...</think> block', () => {
  const result = runFilter(['Before ', '<think>hidden</think>', ' After'])
  assert.equal(result, 'Before  After')
})

test('thinkFilter: strips think tags split across multiple tokens', () => {
  const result = runFilter(['A ', '<thi', 'nk>inside', ' con', 'tent</think>', ' B'])
  assert.equal(result, 'A  B')
})

test('thinkFilter: strips multiple think blocks', () => {
  const result = runFilter([
    'Keep ',
    '<think>drop1</think>',
    ' middle ',
    '<think>drop2</think>',
    ' end',
  ])
  assert.equal(result, 'Keep  middle  end')
})

test('thinkFilter: strips content between opening and closing tags', () => {
  const result = runFilter([
    'Visible',
    '<think>',
    'Invisible content here',
    '</think>',
    ' Visible again',
  ])
  assert.equal(result, 'Visible Visible again')
})

test('thinkFilter: nested-like patterns are handled (greedy close)', () => {
  // The filter uses a simple state machine, not a stack, so the first </think>
  // closes the current block.
  const result = runFilter([
    'A<think>first</think>inside</think>B',
  ])
  // It strips from first <think> to first </think>
  assert.equal(result, 'Ainside</think>B')
})

test('thinkFilter: suppresses partial <think> at end of buffer', () => {
  const calls = []
  const filter = createThinkFilter((t) => calls.push(t))

  filter('Before ')
  filter('<')        // lone bracket — suppressed
  assert.equal(calls.join(''), 'Before ')

  filter('think>')   // completes <think> — should enter think mode
  filter('hidden')   // inside think — suppressed
  filter('</think>') // closes think
  filter(' After')

  assert.equal(calls.join(''), 'Before  After')
})

test('thinkFilter: suppresses partial </think> at end of buffer', () => {
  const calls = []
  const filter = createThinkFilter((t) => calls.push(t))

  filter('A<think>secret</')
  // "</" alone — close prefix suppressed
  assert.equal(calls.join(''), 'A')

  filter('think>B')
  assert.equal(calls.join(''), 'AB')
})

test('thinkFilter: does not suppress if pending text is not a think prefix', () => {
  const calls = []
  const filter = createThinkFilter((t) => calls.push(t))

  filter('<div>')
  // "<div>" starts with < but is not a think prefix — should pass through
  assert.equal(calls.join(''), '<div>')
})

test('thinkFilter: handles empty tokens gracefully', () => {
  const calls = []
  const filter = createThinkFilter((t) => calls.push(t))

  filter('')
  filter('Hello')
  filter('')
  filter(' World')
  filter('')

  assert.equal(calls.join(''), 'Hello World')
})

test('thinkFilter: safety limit of 20 iterations prevents infinite loop', () => {
  // Create a pathological case with many overlapping think patterns
  const calls = []
  const filter = createThinkFilter((t) => calls.push(t))

  // Feed many tokens that each could trigger think detection
  for (let i = 0; i < 50; i++) {
    filter('<think>')
    filter('data')
    filter('</think>')
  }
  // All content should be stripped since everything is inside think blocks
  assert.equal(calls.join(''), '')
})

test('thinkFilter: real-world streaming scenario', () => {
  const result = runFilter([
    'Tentu! Berikut adalah solusinya:\n\n',
    '<think>\n',
    'Saya perlu menganalisis kebutuhan pengguna...\n',
    'Pertimbangan arsitektur:\n',
    '- Menggunakan React dengan Vite\n',
    '</think>\n\n',
    '## Analisis\n\n',
    'Berdasarkan kebutuhan Anda, berikut rekomendasi:\n\n',
    '```jsx\n',
    'function App() {\n',
    '  return <div>Hello</div>\n',
    '}\n',
    '```\n',
  ])
  // The think block and its content should be stripped
  assert.ok(result.includes('## Analisis'))
  assert.ok(result.includes('function App()'))
  assert.ok(!result.includes('Saya perlu menganalisis'))
  assert.ok(!result.includes('Pertimbangan arsitektur'))
})
