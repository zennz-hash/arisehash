import { z } from 'zod';

export const adminAiKeySchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  label: z.string().min(1, 'Label is required'),
  baseUrl: z.string().url('Invalid base URL'),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().min(1, 'Model is required'),
  isActive: z.boolean().default(true),
});

export const updateAdminAiKeySchema = z.object({
  provider: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
