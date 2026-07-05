/**
 * Shared file attachment reading utility.
 * Used by Store.jsx, BuildCode.jsx, ProductDetail.jsx
 */

const MAX_ATTACHMENT_TEXT_LENGTH = 8000

/**
 * Read a File into the attachment shape used by stream endpoints.
 * @param {File} file
 * @returns {Promise<{type: string, name: string, dataUrl?: string, content?: string}>}
 */
export function readAttachment(file) {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/')
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca ' + file.name))
    reader.onabort = () => reject(new Error('Pembacaan ' + file.name + ' dibatalkan'))
    if (isImage) {
      reader.onload = () => resolve({ type: 'image', name: file.name, dataUrl: reader.result })
      reader.readAsDataURL(file)
    } else {
      reader.onload = () =>
        resolve({ type: 'text', name: file.name, content: reader.result.slice(0, MAX_ATTACHMENT_TEXT_LENGTH) })
      reader.readAsText(file)
    }
  })
}
