import { prisma } from './src/db.js'
import jwt from 'jsonwebtoken'
import { generateCompletion } from './src/utils/ai.js'

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

async function getOrCreateTestUser() {
  const email = 'testrunner@arisehash.local'
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: 'Test Runner',
        picture: null,
        role: 'USER'
      }
    })
    console.log('Created test user:', user.id)
  }
  return user
}

function createToken(user) {
  // Match server token format: { uid, role, csrf, sid }
  return jwt.sign({ uid: user.id, role: user.role, csrf: 'test-csrf-token' }, JWT_SECRET, { expiresIn: '7d' })
}

function makeHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Cookie': `arisehash_session=${token}; arisehash_csrf=test-csrf-token`,
    'X-CSRF-Token': 'test-csrf-token'
  }
}

async function testEndpoints(user, token) {
  const base = 'http://localhost:4000'
  const headers = makeHeaders(token)

  console.log('\n--- API Endpoint Tests ---')

  // 1. Create Chat
  console.log('\n1. POST /api/chat')
  try {
    const res = await fetch(`${base}/api/chat`, { method: 'POST', headers, body: JSON.stringify({ mode: 'standard' }) })
    const body = await res.json()
    console.log('   Status:', res.status, '| Chat ID:', body.id)
    global.chatId = body.id
  } catch (err) { console.error('   ❌ Failed:', err.message) }

  // 2. Send Message (Standard via non-stream, likely fails due to tokenrouter)
  console.log('\n2. POST /api/chat/:id/message (Standard - MiniMax M3)')
  try {
    const res = await fetch(`${base}/api/chat/${global.chatId}/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: 'Hello, ini test message', mode: 'standard' })
    })
    // This is SSE, read a bit
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = '', tokens = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value)
      tokens += (buf.match(/data:/g) || []).length
      if (buf.includes('"done":true') || buf.includes('"error"')) break
    }
    console.log('   Status:', res.status, '| Tokens received:', tokens)
    if (buf.includes('"error"')) console.log('   Contains error event:', buf.slice(0, 200))
  } catch (err) { console.error('   ❌ Failed:', err.message) }

  // 3. Create Blueprint
  console.log('\n3. POST /api/blueprints/generate-questions')
  try {
    const res = await fetch(`${base}/api/blueprints/generate-questions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ idea: 'Aplikasi catatan keuangan harian', template: 'saas' })
    })
    const body = await res.json()
    console.log('   Status:', res.status, '| Questions count:', Array.isArray(body) ? body.length : 'N/A')
    global.questions = body
  } catch (err) { console.error('   ❌ Failed:', err.message) }

  // 4. Create Code Project
  console.log('\n4. POST /api/code-projects')
  try {
    const res = await fetch(`${base}/api/code-projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Test Project', template: 'react' })
    })
    const body = await res.json()
    console.log('   Status:', res.status, '| Project ID:', body.id, '| Template:', body.template)
    global.projectId = body.id
  } catch (err) { console.error('   ❌ Failed:', err.message) }

  // 5. Stream Code Project instruction
  console.log('\n5. POST /api/code-projects/:id/stream')
  try {
    const res = await fetch(`${base}/api/code-projects/${global.projectId}/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instruction: 'Buat tombol klik sederhana dengan React', messagesHistory: [] })
    })
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = '', tokens = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value)
      // Count data: lines
      const count = (buf.match(/data:/g) || []).length
      if (count > tokens) tokens = count
      if (buf.includes('"done":true') || buf.includes('"error"')) break
    }
    console.log('   Status:', res.status, '| Token chunks:', tokens)
    if (buf.includes('"error"')) console.log('   Contains error event:', buf.slice(0, 300))
  } catch (err) { console.error('   ❌ Failed:', err.message) }

  // 6. Quota check
  console.log('\n6. GET /api/quota')
  try {
    const res = await fetch(`${base}/api/quota`, { headers })
    const body = await res.json()
    console.log('   Status:', res.status, '| Quota:', JSON.stringify(body).slice(0, 200))
  } catch (err) { console.error('   ❌ Failed:', err.message) }

  // 7. Update message endpoint
  console.log('\n7. PATCH /api/chat/:id/messages/:messageId')
  const msg = await prisma.chatMessage.findFirst({ where: { chatId: global.chatId } })
  if (msg) {
    try {
      const res = await fetch(`${base}/api/chat/${global.chatId}/messages/${msg.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ content: 'Updated test message' })
      })
      const body = await res.json()
      console.log('   Status:', res.status, '| Updated content:', body.content?.slice(0, 50))
    } catch (err) { console.error('   ❌ Failed:', err.message) }
  } else {
    console.log('   Skipped: no messages found')
  }

  // Cleanup
  console.log('\n--- Cleanup test data ---')
  if (global.projectId) {
    await prisma.codeProjectVersion.deleteMany({ where: { codeProjectId: global.projectId } })
    await prisma.codeProject.deleteMany({ where: { id: global.projectId } })
    console.log('Deleted code project')
  }
  const chat = await prisma.chat.findUnique({ where: { id: global.chatId }, include: { messages: true } })
  if (chat) {
    await prisma.chatMessage.deleteMany({ where: { chatId: global.chatId } })
    await prisma.chat.delete({ where: { id: global.chatId } })
    console.log('Deleted chat')
  }
}

async function testGenerateCompletionBug() {
  console.log('\n--- Testing generateCompletion bug (non-streaming via 9Router returns SSE) ---')
  try {
    const res = await generateCompletion(
      [{ role: 'user', content: 'Testing non-stream' }],
      {},
      null,
      'max'
    )
    console.log('✅ generateCompletion (max) success:', res.slice(0, 100))
  } catch (err) {
    console.error('❌ generateCompletion (max) failed:', err.message)
  }
}

async function main() {
  const user = await getOrCreateTestUser()
  const token = createToken(user)
  await testEndpoints(user, token)
  await testGenerateCompletionBug()
  console.log('\n--- All API tests completed ---')
  await prisma.$disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  prisma.$disconnect().finally(() => process.exit(1))
})
