import { z } from 'zod'

export const createAiKeySchema = z.object({
  label: z.string().max(100).optional(),
  provider: z.string().max(50).optional(),
  baseUrl: z.string().url('Base URL tidak valid').min(1, 'baseUrl wajib diisi'),
  apiKey: z.string().min(1, 'apiKey wajib diisi'),
  model: z.string().min(1, 'model wajib diisi').max(100)
})

export const updateAiKeySchema = z.object({
  label: z.string().max(100).optional(),
  provider: z.string().max(50).optional(),
  baseUrl: z.string().url('Base URL tidak valid').optional(),
  apiKey: z.string().optional(),
  model: z.string().max(100).optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Minimal satu field harus diisi' }
)
