import { motion } from 'framer-motion'
import { useLang } from '../context/LanguageContext.jsx'

export default function FullscreenLoader() {
  const { t } = useLang()

  return (
    <div className="fullscreen-loader">
      <motion.div
        className="loader-content"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="loader-logo-wrap">
          <div className="loader-logo-ring" />
          <img src="/logo.png" alt="AriseHash" className="loader-logo" width="96" height="96" />
        </div>
        <h2 className="loader-text">AriseHash</h2>
        <p className="loader-subtext">{t('common.loading')}</p>
      </motion.div>
    </div>
  )
}
