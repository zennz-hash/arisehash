// Estimasi harga model AI per 1.000.000 token (USD): { in: input/prompt, out: output/completion }.
// Dipakai untuk memperkirakan biaya pemakaian token pengguna (analisis di dashboard).
// Angka adalah perkiraan publik dan bisa disesuaikan; pencocokan dilakukan via substring nama model.
const PRICES = [
  ['gpt-4o-mini', { in: 0.15, out: 0.6 }],
  ['gpt-4o', { in: 2.5, out: 10 }],
  ['gpt-4-turbo', { in: 10, out: 30 }],
  ['gpt-4', { in: 30, out: 60 }],
  ['gpt-3.5', { in: 0.5, out: 1.5 }],
  ['o1-mini', { in: 1.1, out: 4.4 }],
  ['o1', { in: 15, out: 60 }],
  ['claude-3-5-sonnet', { in: 3, out: 15 }],
  ['claude-3-5-haiku', { in: 0.8, out: 4 }],
  ['claude-3-opus', { in: 15, out: 75 }],
  ['claude-3-haiku', { in: 0.25, out: 1.25 }],
  ['claude-3-sonnet', { in: 3, out: 15 }],
  ['claude', { in: 3, out: 15 }],
  ['gemini-1.5-pro', { in: 1.25, out: 5 }],
  ['gemini-1.5-flash', { in: 0.075, out: 0.3 }],
  ['gemini', { in: 0.5, out: 1.5 }],
  ['deepseek', { in: 0.27, out: 1.1 }],
  ['llama', { in: 0.2, out: 0.2 }],
  ['mistral', { in: 0.25, out: 0.25 }],
  ['qwen', { in: 0.2, out: 0.2 }],
]
const DEFAULT_PRICE = { in: 0.5, out: 1.5 }

// Bersihkan prefix internal seperti "admin:" / "custom:" lalu cari harga via substring.
export function priceFor(model = '') {
  const m = String(model).toLowerCase().replace(/^(admin|custom):/, '')
  for (const [key, price] of PRICES) if (m.includes(key)) return price
  return DEFAULT_PRICE
}

// Biaya (USD) untuk satu permintaan berdasarkan jumlah token input & output.
export function costOf(model, promptTokens = 0, completionTokens = 0) {
  const p = priceFor(model)
  return (promptTokens / 1e6) * p.in + (completionTokens / 1e6) * p.out
}

// Label model yang ringkas & rapi untuk ditampilkan di UI.
export function labelFor(model = '') {
  return String(model).replace(/^(admin|custom):/, '') || 'lainnya'
}
