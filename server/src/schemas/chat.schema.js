import { z } from 'zod'

export const createChatSchema = z.object({
  model: z.string().max(100).optional().nullable(),
  aiKeyId: z.string().max(50).optional().nullable()
})

export const updateChatSchema = z.object({
  title: z.string().trim().max(120).optional(),
  model: z.string().max(100).optional().nullable(),
  aiKeyId: z.string().max(50).optional().nullable()
})

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(500_000, 'Pesan terlalu panjang (maks 500.000 karakter untuk mendukung gambar base64)'),
  model: z.string().max(100).optional().nullable(),
  aiKeyId: z.string().max(50).optional().nullable(),
  deepSearch: z.boolean().optional()
})

export const analyzeGithubSchema = z.object({
  url: z.string().url('URL GitHub tidak valid')
})

export const updateMessageSchema = z.object({
  content: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(500_000, 'Pesan terlalu panjang (maks 500.000 karakter)')
})


