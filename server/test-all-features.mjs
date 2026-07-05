import 'dotenv/config'
import { prisma } from './src/db.js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

async function getOrCreateTestUser() {
  const email = 'testrunner@arisehash.local'
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({ data: { email, name: 'Test Runner', picture: null, role: 'USER' } })
    console.log('Created test user:', user.id)
  }
  return user
}

function createToken(user) {
  return jwt.sign({ uid: user.id, role: user.role, csrf: 'test-csrf-token' }, JWT_SECRET, { expiresIn: '7d' })
}

function makeHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Cookie': `arisehash_session=${token}; arisehash_csrf=test-csrf-token`,
    'X-CSRF-Token': 'test-csrf-token'
  }
}

async function testWithModel(user, token, mode) {
  const base = 'http://localhost:4000'
  const headers = makeHeaders(token)
  console.log(`\n========== Testing with model: ${mode} ==========`)

  // 1. Create Chat
  console.log('\n1. POST /api/chat')
  const chatRes = await fetch(`${base}/api/chat`, { method: 'POST', headers, body: JSON.stringify({ model: mode }) })
  const chatBody = await chatRes.json()
  console.log('   Status:', chatRes.status, '| Chat ID:', chatBody.id)
  const chatId = chatBody.id

  // 2. Send Message
  console.log(`\n2. POST /api/chat/${chatId}/message`)
  const msgRes = await fetch(`${base}/api/chat/${chatId}/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: 'Hello, ini test message pakai mode ' + mode, model: mode })
  })
  const reader = msgRes.body.getReader()
  const dec = new TextDecoder()
  let buf = '', tokens = 0, hasError = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value)
    const count = (buf.match(/data:/g) || []).length
    if (count > tokens) tokens = count
    if (buf.includes('"error"')) { hasError = true; break }
    if (buf.includes('"done":true')) break
  }
  console.log('   Status:', msgRes.status, '| SSE chunks:', tokens, '| Has error:', hasError)
  if (hasError) console.log('   Error preview:', buf.match(/data:\s*\{[^}]*"error"[^}]*\}/)?.[0]?.slice(0, 200))

  // 3. Create Code Project
  console.log('\n3. POST /api/code-projects')
  const cpRes = await fetch(`${base}/api/code-projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `Test-${mode}`, template: 'react' })
  })
  const cpBody = await cpRes.json()
  console.log('   Status:', cpRes.status, '| Project ID:', cpBody.id, '| Template:', cpBody.template)
  const projectId = cpBody.id

  // 4. Stream Code Project (use max mode for code too)
  console.log(`\n4. POST /api/code-projects/${projectId}/stream`)
  const streamRes = await fetch(`${base}/api/code-projects/${projectId}/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ instruction: 'Buat tombol klik dengan label "Klik Saya"', messagesHistory: [], model: mode })
  })
  const streamReader = streamRes.body.getReader()
  const streamDec = new TextDecoder()
  let streamBuf = '', streamTokens = 0, streamError = false
  while (true) {
    const { done, value } = await streamReader.read()
    if (done) break
    streamBuf += streamDec.decode(value)
    const count = (streamBuf.match(/data:/g) || []).length
    if (count > streamTokens) streamTokens = count
    if (streamBuf.includes('"error"')) { streamError = true; break }
    if (streamBuf.includes('"done":true')) break
  }
  console.log('   Status:', streamRes.status, '| SSE chunks:', streamTokens, '| Has error:', streamError)
  if (!streamError && streamTokens > 0) console.log('   Code preview:', streamBuf.match(/<vcFile[^>]*>/)?.[0]?.slice(0, 100))
  if (streamError) console.log('   Error preview:', streamBuf.match(/data:\s*\{[^}]*"error"[^}]*\}/)?.[0]?.slice(0, 200))

  // 5. Generate Blueprint (PRD) - this endpoint does NOT accept mode in body easily, but streamCode does.
  // Note: generate-questions and generate blueprint don't accept mode param from frontend easily.
  // We'll skip blueprint stream test because it lacks mode param support in current schema.

  // Cleanup
  if (projectId) {
    await prisma.codeProjectVersion.deleteMany({ where: { codeProjectId: projectId } }).catch(() => {})
    await prisma.codeProject.deleteMany({ where: { id: projectId } }).catch(() => {})
  }
  if (chatId) {
    await prisma.chatMessage.deleteMany({ where: { chatId } }).catch(() => {})
    await prisma.chat.delete({ where: { id: chatId } }).catch(() => {})
  }
}

async function main() {
  const user = await getOrCreateTestUser()
  const token = createToken(user)

  const models = await prisma.adminAiKey.findMany({ where: { isActive: true }, orderBy: { label: 'asc' } })
  const maxModel = models.find(m => m.model?.includes('claude')) || models[0]
  const stdModel = models.find(m => !m.model?.includes('claude')) || models[models.length - 1]

  if (maxModel) {
    console.log(`\\n--- Using model: ${maxModel.label} (${maxModel.id}) ---`)
    await testWithModel(user, token, maxModel.id)
    await testBlueprints(user, token, maxModel.id)
  }

  if (stdModel && stdModel.id !== maxModel?.id) {
    console.log(`\\n--- Using model: ${stdModel.label} (${stdModel.id}) ---`)
    await testWithModel(user, token, stdModel.id)
    await testBlueprints(user, token, stdModel.id)
  }

  console.log('\\n--- Done ---')
  await prisma.$disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal:', err)
  prisma.$disconnect().finally(() => process.exit(1))
})
// Test blueprints generate-questions + generate + revise (using maxModel)
async function testBlueprints(user, token, model) {
  const base = 'http://localhost:4000'
  const headers = makeHeaders(token)
  console.log(`\n--- Blueprints testing with model: ${model} ---`)

  console.log('\n5. POST /api/blueprints/generate-questions')
  const qRes = await fetch(`${base}/api/blueprints/generate-questions`, {
    method: 'POST', headers, body: JSON.stringify({ idea: 'Aplikasi toko online', template: 'react', model, aiKeyId: null })
  })
  const qBody = await qRes.json()
  console.log('   Status:', qRes.status, '| Questions count:', Array.isArray(qBody) ? qBody.length : 0)

  console.log('\n6. POST /api/blueprints/generate')
  const bRes = await fetch(`${base}/api/blueprints/generate`, {
    method: 'POST', headers, body: JSON.stringify({ idea: 'Aplikasi toko online', template: 'ecommerce', model, aiKeyId: null })
  })
  // Generate returns SSE stream with PRD tokens
  const bReader = bRes.body.getReader()
  const bDec = new TextDecoder()
  let bBuf = '', bTokens = 0, bHasError = false, bDone = false
  while (true) {
    const { done, value } = await bReader.read()
    if (done) break
    bBuf += bDec.decode(value)
    const count = (bBuf.match(/data:/g) || []).length
    if (count > bTokens) bTokens = count
    if (bBuf.includes('"error"')) { bHasError = true; break }
    if (bBuf.includes('"done":true')) { bDone = true; break }
  }
  const bPreview = bBuf.match(/data: (\{[^{}]*?\})/)?.[1] || ''
  console.log('   Status:', bRes.status, '| SSE chunks:', bTokens, '| Has error:', bHasError, '| Done:', bDone, '| Preview:', bPreview.slice(0, 60))
}
