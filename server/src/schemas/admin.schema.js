import { z } from 'zod'

export const updateSubscriptionSchema = z.object({
  planType: z.enum(['FREE', 'PRO', 'PRO_MAX'], {
    errorMap: () => ({ message: 'Plan type tidak valid. Gunakan FREE, PRO, atau PRO_MAX.' })
  })
})
