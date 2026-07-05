import 'dotenv/config'
import { prisma } from '../db.js'

async function main() {
  const latest = await prisma.codeProject.findFirst({
    orderBy: { createdAt: 'desc' }
  })
  if (!latest) return
  const files = JSON.parse(latest.filesJson)
  console.log('styles.css content:')
  console.log(files['/styles.css'])
}

main().catch(console.error).finally(() => prisma.$disconnect())
