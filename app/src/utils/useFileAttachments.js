import { useState, useRef, useCallback } from 'react'
import { readAttachment } from './attachments.js'

/**
 * Hook for file/image attachment picker logic.
 * Extracted from BuildCode.jsx and Store.jsx (identical code).
 */
export function useFileAttachments(addToast, { maxAttachments = 4, maxSizeMB = 4 } = {}) {
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const [attachments, setAttachments] = useState([])
  const maxBytes = maxSizeMB * 1024 * 1024

  const triggerFilePicker = useCallback(() => fileInputRef.current?.click(), [])
  const triggerImagePicker = useCallback(() => imageInputRef.current?.click(), [])

  const onPickFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    const newAtts = []
    for (const f of files) {
      if (newAtts.length + attachments.length >= maxAttachments) {
        addToast(`Maksimal ${maxAttachments} lampiran.`, 'error')
        break
      }
      if (f.size > maxBytes) {
        addToast(`${f.name} terlalu besar (maks ${maxSizeMB}MB).`, 'error')
        continue
      }
      try {
        const att = await readAttachment(f)
        newAtts.push(att)
      } catch (err) {
        addToast(err.message, 'error')
      }
    }
    if (newAtts.length) {
      setAttachments((prev) => [...prev, ...newAtts].slice(0, maxAttachments))
    }
  }, [addToast, attachments.length, maxAttachments, maxBytes, maxSizeMB])

  return {
    fileInputRef,
    imageInputRef,
    attachments,
    setAttachments,
    triggerFilePicker,
    triggerImagePicker,
    onPickFiles,
  }
}
