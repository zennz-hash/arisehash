import { prisma } from './src/db.js'
import { generateCompletion, streamCompletion } from './src/utils/ai.js'

async function testChat() {
  console.log('--- Test 1: Chat (Standard / MiniMax M3) ---')
  try {
    const messages = [
      { role: 'system', content: 'Kamu adalah asisten AI.' },
      { role: 'user', content: 'Halo, apa kabar? Jelaskan secara singkat apa itu React.js dalam 2 kalimat.' }
    ]
    const reply = await generateCompletion(messages, {}, 'test-user-id', 'standard')
    console.log('✅ Chat Standard Success:', reply.slice(0, 200))
  } catch (err) {
    console.error('❌ Chat Standard Failed:', err.message)
  }
}

async function testBuildProject() {
  console.log('\n--- Test 2: Build Project (PRD Generation / MiniMax M3) ---')
  try {
    const messages = [
      { role: 'system', content: `Anda adalah arsitek sistem AI. Buat PRD singkat untuk ide aplikasi to-do list.` },
      { role: 'user', content: 'Ide: aplikasi to-do list dengan filter dan kategori' }
    ]
    const reply = await generateCompletion(messages, {}, 'test-user-id', 'standard')
    console.log('✅ PRD Generation Success, length:', reply.length)
    console.log('Preview:', reply.slice(0, 300))
  } catch (err) {
    console.error('❌ PRD Generation Failed:', err.message)
  }
}

async function testBuildCode() {
  console.log('\n--- Test 3: Build Code (Stream / MiniMax M3) ---')
  try {
    let acc = ''
    await streamCompletion(
      [
        { role: 'system', content: 'Kamu adalah agen pemrograman. Buat komponen React sederhana dengan daftar item.' },
        { role: 'user', content: 'Buat komponen TodoList React dengan state useState dan styling CSS inline.' }
      ],
      (token) => { acc += token },
      'test-user-id',
      'standard'
    )
    console.log('✅ Code Stream Success, length:', acc.length)
    console.log('Preview:', acc.slice(0, 300))
  } catch (err) {
    console.error('❌ Code Stream Failed:', err.message)
  }
}

async function testMaxThinking() {
  console.log('\n--- Test 4: Max Thinking (Claude Opus via 9Router) ---')
  try {
    const messages = [
      { role: 'system', content: 'Kamu adalah konsultan senior perangkat lunak.' },
      { role: 'user', content: 'Bagaimana cara mengoptimalkan query database PostgreSQL untuk 10 juta baris data?' }
    ]
    const reply = await generateCompletion(messages, {}, 'test-user-id', 'max')
    console.log('✅ Max Thinking Success:', reply.slice(0, 200))
  } catch (err) {
    console.error('❌ Max Thinking Failed:', err.message)
  }
}

async function main() {
  await testChat()
  await testBuildProject()
  await testBuildCode()
  await testMaxThinking()
  console.log('\n--- All tests completed ---')
  await prisma.$disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  prisma.$disconnect().finally(() => process.exit(1))
})
