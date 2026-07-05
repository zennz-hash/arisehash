import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null) // { title, message, confirmText, cancelText, danger }
  const resolver = useRef(null)

  const confirm = useCallback((opts = {}) => {
    setState({
      title: opts.title || 'Konfirmasi',
      message: opts.message || 'Apakah kamu yakin?',
      confirmText: opts.confirmText || 'Ya, lanjutkan',
      cancelText: opts.cancelText || 'Batal',
      danger: opts.danger ?? false,
    })
    return new Promise((resolve) => { resolver.current = resolve })
  }, [])

  const close = useCallback((result) => {
    resolver.current?.(result)
    resolver.current = null
    setState(null)
  }, [])

  // Safety net: if the provider unmounts with a dialog still open, resolve the
  // pending promise as "cancelled" so any awaiting caller isn't left hanging.
  useEffect(() => () => { resolver.current?.(false); resolver.current = null }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div className="confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="confirm-dismiss" aria-label="Batalkan konfirmasi" onClick={() => close(false)} />
            <motion.div
              className="confirm-card"
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby="confirm-message"
            >
              {state.danger && <span className="confirm-ic"><AlertTriangle size={22} /></span>}
              <h3 id="confirm-title" className="display confirm-title">{state.title}</h3>
              <p id="confirm-message" className="confirm-msg">{state.message}</p>
              <div className="confirm-actions">
                <button className="pill" onClick={() => close(false)} autoFocus>{state.cancelText}</button>
                <button
                  className="pill"
                  style={state.danger
                    ? { background: '#b3261e', color: '#fff', borderColor: '#b3261e' }
                    : { background: 'var(--ink)', color: 'var(--surface)', borderColor: 'var(--ink)' }}
                  onClick={() => close(true)}
                >
                  {state.confirmText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}
