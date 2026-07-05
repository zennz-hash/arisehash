import { PrismaClient } from '@prisma/client'

// Cache the client on globalThis so serverless (Vercel) invocations reuse one
// instance instead of opening a new DB connection per cold start.
const globalForPrisma = globalThis
export const prisma = globalForPrisma.__prisma ?? new PrismaClient()
if (!globalForPrisma.__prisma) globalForPrisma.__prisma = prisma
