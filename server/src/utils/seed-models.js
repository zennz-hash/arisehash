import 'dotenv/config'
import { prisma } from '../db.js'
import { encryptSecret } from './crypto.js'

// Daftar definisi model. API key TIDAK ditulis hardcode di sini — diambil dari
// environment variable. Jalankan seed hanya setelah semua env di-set di file .env
// Jika sebuah env belum diset, model terkait dilewati dengan peringatan.
//
// Contoh .env (jangan commit!):
//   SEED_MIMO_KEY="sk-..."
//   SEED_UPBIT_KEY="..."
//   SEED_QWEN_KEY="sk-..."
//   SEED_BYNARA_KEY="sk-..."
const MODELS = [
  { provider: 'openai', label: 'MiMo 2.5 Standard',      baseUrl: 'https://api.xiaomimimo.com/v1',                     model: 'mimo-v2.5',               keyEnv: 'SEED_MIMO_KEY' },
  { provider: 'openai', label: 'MiMo 2.5 Pro',           baseUrl: 'https://api.xiaomimimo.com/v1',                     model: 'mimo-v2.5-pro',           keyEnv: 'SEED_MIMO_KEY' },
  { provider: 'openai', label: 'Gemini 3.1 Pro',         baseUrl: 'https://gateway.upbit.my.id/v1',                    model: 'ag/gemini-3.1-pro-low',   keyEnv: 'SEED_UPBIT_KEY' },
  { provider: 'openai', label: 'Claude 4.6 Opus',        baseUrl: 'https://gateway.upbit.my.id/v1',                    model: 'ag/claude-opus-4-6-thinking', keyEnv: 'SEED_UPBIT_KEY' },
  { provider: 'openai', label: 'Qwen 3.7 Max',           baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen3-max',          keyEnv: 'SEED_QWEN_KEY' },
  { provider: 'openai', label: 'Qwen 3.7 Plus',          baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus',          keyEnv: 'SEED_QWEN_KEY' },
  { provider: 'openai', label: 'MiMo 2.5 Standard (Bynara)', baseUrl: 'https://router.bynara.id/v1',                   model: 'mimo-v2.5-free',          keyEnv: 'SEED_BYNARA_KEY' },
  { provider: 'openai', label: 'MiMo 2.5 Pro (Bynara)',  baseUrl: 'https://router.bynara.id/v1',                       model: 'mimo-v2.5-pro-free',      keyEnv: 'SEED_BYNARA_KEY' },
  { provider: 'openai', label: 'Claude 4.5 Sonnet',      baseUrl: 'https://router.bynara.id/v1',                       model: 'claude-sonnet-4.5',       keyEnv: 'SEED_BYNARA_KEY' },
]

async function main() {
  console.log('Cleaning up existing Admin AI keys...')
  await prisma.adminAiKey.deleteMany()

  const keys = []
  for (const m of MODELS) {
    const rawKey = process.env[m.keyEnv]
    if (!rawKey || !rawKey.trim()) {
      console.warn(`⚠️  Skipping "${m.label}": env ${m.keyEnv} not set.`)
      continue
    }
    keys.push({
      provider: m.provider,
      label: m.label,
      baseUrl: m.baseUrl,
      apiKey: encryptSecret(rawKey.trim()),
      model: m.model,
      isActive: true,
    })
  }

  if (keys.length === 0) {
    console.warn('No API keys found in environment. Set SEED_* env vars before seeding.')
    return
  }

  console.log(`Inserting ${keys.length} Admin AI keys...`)
  for (const key of keys) {
    const created = await prisma.adminAiKey.create({ data: key })
    console.log(`Created key: ${created.label} (${created.model})`)
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((err) => {
    console.error('Error seeding admin AI keys:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
