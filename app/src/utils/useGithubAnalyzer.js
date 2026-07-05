import { useState, useCallback } from 'react'

/**
 * Hook for GitHub repository content analysis.
 * Extracted from BuildCode.jsx and Store.jsx (identical ~40-line code).
 *
 * @param {function} setAttachments - State setter for attachments array
 * @param {function} addToast - Toast notification function
 * @returns {{ githubUrl, setGithubUrl, showGithubInput, setShowGithubInput, analyzingGithub, handleGithubAnalyze }}
 */
export function useGithubAnalyzer(setAttachments, addToast) {
  const [githubUrl, setGithubUrl] = useState('')
  const [showGithubInput, setShowGithubInput] = useState(false)
  const [analyzingGithub, setAnalyzingGithub] = useState(false)

  const handleGithubAnalyze = useCallback(async (url) => {
    const match = url.trim().match(/github\.com\/([^/]+)\/([^/\s?#]+)/)
    if (!match) {
      addToast('URL GitHub tidak valid. Format: https://github.com/owner/repo', 'error')
      return
    }
    const owner = match[1]
    const repo = match[2].replace(/\.git$/, '')

    setAnalyzingGithub(true)
    try {
      const resContents = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`)
      if (!resContents.ok) {
        throw new Error(`Gagal memuat repositori: ${resContents.statusText}`)
      }
      const contents = await resContents.json()

      const keyFiles = ['README.md', 'package.json', 'index.js', 'index.ts', 'main.py', 'requirements.txt', 'go.mod']
      const fetched = []

      const filesToFetch = contents.filter((item) =>
        item.type === 'file' &&
        keyFiles.some((k) => item.name.toLowerCase() === k.toLowerCase())
      ).slice(0, 5)

      for (const item of filesToFetch) {
        try {
          const r = await fetch(item.download_url)
          if (r.ok) {
            const text = await r.text()
            fetched.push({
              type: 'text',
              name: item.path,
              content: text.slice(0, 4000),
            })
          }
        } catch (e) {
          // Silently skip failed file fetches
        }
      }

      if (fetched.length === 0) {
        fetched.push({
          type: 'text',
          name: `${owner}-${repo}-reference.txt`,
          content: `Referensi Repositori GitHub: https://github.com/${owner}/${repo}`,
        })
      }

      setAttachments((prev) => [...prev, ...fetched].slice(0, 6))
      addToast(`Repositori ${owner}/${repo} berhasil ditambahkan (${fetched.length} file).`, 'success')
      setGithubUrl('')
      setShowGithubInput(false)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setAnalyzingGithub(false)
    }
  }, [setAttachments, addToast])

  return {
    githubUrl,
    setGithubUrl,
    showGithubInput,
    setShowGithubInput,
    analyzingGithub,
    handleGithubAnalyze,
  }
}
