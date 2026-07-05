import { z } from 'zod'

const TEMPLATES = ['react', 'react-ts', 'vue', 'svelte', 'vanilla', 'vanilla-ts', 'other']

export const createCodeProjectSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  blueprintId: z.string().max(50).nullable().optional(),
  template: z.enum(TEMPLATES).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  aiKeyId: z.string().max(50).nullable().optional()
})

const jsonString = z.string().nullable().optional().refine(
  (val) => {
    if (val == null) return true
    try { JSON.parse(val); return true } catch { return false }
  },
  { message: 'Harus berupa JSON yang valid' }
)

export const updateCodeProjectSchema = z.object({
  filesJson: jsonString,
  messagesJson: jsonString,
  name: z.string().max(200).nullable().optional(),
  model: z.string().max(100).nullable().optional()
})

export const shareCodeProjectSchema = z.object({
  isPublic: z.boolean(),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
  allowDownload: z.boolean().nullable().optional()
})

export const addCollaboratorSchema = z.object({
  email: z.string().email('Email tidak valid').trim().toLowerCase(),
  role: z.enum(['VIEWER', 'EDITOR']).nullable().optional()
})

export const streamCodeProjectSchema = z.object({
  instruction: z.string().min(1, 'instruksi wajib diisi'),
  messagesHistory: z.array(z.object({
    role: z.string(),
    content: z.any()
  })).nullable().optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'text']),
    name: z.string().nullable().optional(),
    dataUrl: z.string().nullable().optional(),
    content: z.string().nullable().optional()
  })).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  aiKeyId: z.string().max(50).nullable().optional(),
  activeSkills: z.array(z.string()).nullable().optional(),
  customSkills: z.array(z.object({
    id: z.string(),
    name: z.string(),
    desc: z.string().nullable().optional(),
    url: z.string().nullable().optional()
  })).nullable().optional()
})

export const saveVersionSchema = z.object({
  label: z.string().max(200).nullable().optional()
})
