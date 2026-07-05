import 'dotenv/config'
import { prisma } from '../db.js'

async function main() {
  const latest = await prisma.codeProject.findFirst({
    orderBy: { createdAt: 'desc' }
  })
  if (!latest) return

  console.log(`Project ID: ${latest.id}, Name: ${latest.name}`)
  const files = JSON.parse(latest.filesJson)
  console.log('Files:', Object.keys(files))
  console.log('Package.json dependencies:', JSON.parse(files['/package.json'] || '{}').dependencies)
  
  let loadedMessages = []
  try { loadedMessages = JSON.parse(latest.messagesJson || '[]') } catch { loadedMessages = [] }
  console.log('Messages count:', loadedMessages.length)
  if (loadedMessages.length > 0) {
    console.log('Last message from assistant:', loadedMessages[loadedMessages.length - 1])
  }

  // Print first 50 lines of App.js
  if (files['/App.js']) {
    console.log('App.js first 50 lines:')
    const lines = files['/App.js'].split('\n')
    console.log(lines.slice(0, 50).join('\n'))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
