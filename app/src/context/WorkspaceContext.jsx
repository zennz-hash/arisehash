import { createContext, useContext, useState } from 'react'

const WorkspaceContext = createContext()

export function WorkspaceProvider({ children }) {
  const [cache, setCache] = useState({})

  const getCache = (id) => cache[id] || null
  const setCacheItem = (id, data) => {
    setCache((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...data,
      },
    }))
  }
  const clearCache = (id) => {
    setCache((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  return (
    <WorkspaceContext.Provider value={{ getCache, setCacheItem, clearCache }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
