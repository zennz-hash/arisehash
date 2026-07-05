import { z } from 'zod'

export const generateQuestionsSchema = z.object({
  idea: z.string().min(1, 'ide wajib diisi'),
  template: z.string().min(1, 'template wajib diisi'),
  model: z.string().max(100).optional().nullable(),
  aiKeyId: z.string().max(50).optional().nullable()
})

export const generateBlueprintSchema = z.object({
  idea: z.string().min(1, 'ide wajib diisi'),
  template: z.string().min(1, 'template wajib diisi'),
  name: z.string().max(200).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  techMode: z.enum(['auto', 'manual']).optional().nullable(),
  frontend: z.string().max(100).optional().nullable(),
  backend: z.string().max(100).optional().nullable(),
  database: z.string().max(100).optional().nullable(),
  deploy: z.string().max(100).optional().nullable(),
  quizAnswers: z.array(z.any()).optional().nullable(),
  aiKeyId: z.string().max(50).optional().nullable()
})

export const updateBlueprintSchema = z.object({
  content: z.string().max(500_000, 'Konten terlalu panjang (maks 500.000 karakter)').optional().nullable(),
  name: z.string().max(200).optional().nullable(),
  folder: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional().nullable()
}).refine(
  (data) => data.content !== undefined || data.name !== undefined || data.folder !== undefined || data.tags !== undefined,
  { message: 'Minimal satu field harus diisi' }
)

export const reviseBlueprintSchema = z.object({
  instruction: z.string().trim().min(1, 'Instruksi revisi wajib diisi'),
  model: z.string().max(100).optional().nullable(),
  aiKeyId: z.string().max(50).optional().nullable()
})

export const createVersionSchema = z.object({
  name: z.string().max(200).optional().nullable()
})

export const restoreVersionSchema = z.object({
  versionNumber: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)])
})

export const shareBlueprintSchema = z.object({
  isPublic: z.boolean()
})

export const duplicateBlueprintSchema = z.object({
  asTemplate: z.boolean().optional().nullable()
})
