import { prisma } from './src/db.js'
import { streamCompletion } from './src/utils/ai.js'

async function testMaxStream() {
  console.log('--- Test: Max Thinking Stream (Claude via 9Router localhost:20128) ---')
  try {
    let acc = ''
    await streamCompletion(
      [
        { role: 'system', content: 'Kamu adalah konsultan senior perangkat lunak.' },
        { role: 'user', content: 'Bagaimana cara mengoptimalkan query PostgreSQL untuk 10 juta baris?' }
      ],
      (token) => {
        acc += token
        // Print first token to show streaming works
        if (acc.length <= 50) process.stdout.write(token)
      },
      null,  // no userId to skip FK log error
      'max'
    )
    console.log('\n✅ Max Stream Success, length:', acc.length)
    console.log('First 300 chars:', acc.slice(0, 300))
  } catch (err) {
    console.error('❌ Max Stream Failed:', err.message)
  }
}

async function testStandardStream() {
  console.log('\n--- Test: Standard Stream (MiniMax M3 via tokenrouter.com) ---')
  try {
    let acc = ''
    await streamCompletion(
      [
        { role: 'system', content: 'Kamu adalah asisten AI.' },
        { role: 'user', content: 'Halo, apa kabar?' }
      ],
      (token) => { acc += token },
      null,
      'standard'
    )
    console.log('✅ Standard Stream Success, length:', acc.length)
  } catch (err) {
    console.error('❌ Standard Stream Failed:', err.message)
  }
}

// Test endpoint behavior with direct fetch to see raw format
async function inspect9Router() {
  console.log('\n--- Inspect: 9Router non-streaming response format ---')
  try {
    const res = await fetch('http://localhost:20128/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_MAX_KEY || 'test-key'}`
      },
      body: JSON.stringify({
        model: 'claude-opus-stable',
        messages: [{ role: 'user', content: 'hi' }]
      })
    })
    const text = await res.text()
    console.log('Status:', res.status)
    console.log('Content-Type:', res.headers.get('content-type'))
    console.log('Body starts with:', text.slice(0, 100))
    const isSSE = text.trim().startsWith('data:')
    if (isSSE) {
      console.log('⚠️  9Router returns SSE format even for non-streaming request!')
      // Try parse the JSON inside data: line
      const dataLine = text.split('\n').find(l => l.startsWith('data:') && !l.includes('[DONE]'))
      if (dataLine) {
        try {
          const obj = JSON.parse(dataLine.slice(6))
          console.log('Parsed object keys:', Object.keys(obj))
        } catch {}
      }
    }
  } catch (err) {
    console.error('❌ Inspect failed:', err.message)
  }
}

async function main() {
  await testMaxStream()
  await testStandardStream()
  await inspect9Router()
  console.log('\n--- Stream tests completed ---')
  await prisma.$disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  prisma.$disconnect().finally(() => process.exit(1))
})
