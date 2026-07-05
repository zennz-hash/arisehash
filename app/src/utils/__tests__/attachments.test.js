import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readAttachment } from '../attachments.js'

describe('readAttachment', () => {
  let mockTextFile, mockImageFile

  beforeEach(() => {
    mockTextFile = new File(['hello world content'], 'test.txt', { type: 'text/plain' })

    // minimal valid PNG
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00,
      0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27,
      0x8C, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
      0x44, 0xAE, 0x42, 0x60, 0x82,
    ])
    mockImageFile = new File([pngBytes], 'image.png', { type: 'image/png' })
  })

  it('reads a text file and returns type "text" with content', async () => {
    const result = await readAttachment(mockTextFile)
    expect(result.type).toBe('text')
    expect(result.name).toBe('test.txt')
    expect(result.content).toContain('hello world')
  })

  it('reads an image file and returns type "image" with dataUrl', async () => {
    const result = await readAttachment(mockImageFile)
    expect(result.type).toBe('image')
    expect(result.name).toBe('image.png')
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('truncates text content to MAX_ATTACHMENT_TEXT_LENGTH (8000)', async () => {
    const longContent = 'a'.repeat(10000)
    const longFile = new File([longContent], 'long.txt', { type: 'text/plain' })
    const result = await readAttachment(longFile)
    expect(result.content.length).toBeLessThanOrEqual(8000)
    expect(result.content).toBe('a'.repeat(8000))
  })

  it('rejects with error when file read fails', async () => {
    const orig = globalThis.FileReader
    globalThis.FileReader = function () {
      this.readAsText = vi.fn()
      this.readAsDataURL = vi.fn()
      setTimeout(() => this.onerror?.(), 0)
    }
    const badFile = new File(['x'], 'bad.txt', { type: 'text/plain' })
    await expect(readAttachment(badFile)).rejects.toThrow('Gagal membaca bad.txt')
    globalThis.FileReader = orig
  })

  it('rejects on abort', async () => {
    const orig = globalThis.FileReader
    globalThis.FileReader = function () {
      this.readAsText = vi.fn()
      this.readAsDataURL = vi.fn()
      setTimeout(() => this.onabort?.(), 0)
    }
    const abortFile = new File(['x'], 'abort.txt', { type: 'text/plain' })
    await expect(readAttachment(abortFile)).rejects.toThrow('Pembacaan abort.txt dibatalkan')
    globalThis.FileReader = orig
  })
})
