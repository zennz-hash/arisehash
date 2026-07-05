import { useState, useEffect } from 'react'
import { api } from '../api.js'

/**
 * Fetches admin models and user AI keys when user changes.
 * Centralizes the pattern duplicated across Chat.jsx and Store.jsx.
 *
 * @param {object|null} user - The authenticated user object (from useAuth)
 * @returns {{ adminModels: Array, aiKeys: Array, modelsLoading: boolean }}
 */
export function useAdminModels(user) {
  const [adminModels, setAdminModels] = useState([])
  const [aiKeys, setAiKeys] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setModelsLoading(false)
      return
    }

    setModelsLoading(true)
    Promise.all([
      api.models().catch(() => []),
      api.aiKeys().catch(() => []),
    ]).then(([models, keys]) => {
      setAdminModels(Array.isArray(models) ? models : [])
      setAiKeys(Array.isArray(keys) ? keys : [])
      setModelsLoading(false)
    })
  }, [user])

  return { adminModels, aiKeys, modelsLoading }
}
