import { z } from 'zod'

export const googleLoginSchema = z.object({
  credential: z.string().min(1, 'credential wajib diisi')
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Nama tidak boleh kosong').max(80, 'Nama terlalu panjang (maks 80 karakter)')
})
