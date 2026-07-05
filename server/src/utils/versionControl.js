import { prisma } from '../db.js'

/**
 * Creates a new version snapshot for a blueprint within an atomic database transaction.
 */
export async function createBlueprintVersion(blueprintId, userId, name, content, source = 'MANUAL') {
  return await prisma.$transaction(async (tx) => {
    const maxVersion = await tx.blueprintVersion.aggregate({
      where: { blueprintId },
      _max: { version: true }
    })
    
    const nextVersion = (maxVersion._max.version || 0) + 1

    const versionRecord = await tx.blueprintVersion.create({
      data: {
        blueprintId,
        userId,
        version: nextVersion,
        name,
        content,
        source
      }
    })

    await tx.blueprint.update({
      where: { id: blueprintId },
      data: {
        currentVersion: nextVersion,
        content // Keep current content synchronized with the newest version
      }
    })

    return versionRecord
  })
}
