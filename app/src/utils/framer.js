/**
 * Shared framer-motion animation presets.
 * Centralizes common fade/slide patterns used across pages.
 */

/**
 * Fade-in animation for mount transitions (used with motion.div).
 * @param {number} [delay=0] - Stagger delay in seconds
 */
export function fadeIn(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay },
  }
}

/**
 * Fade-in animation triggered when element scrolls into view.
 * @param {number} [delay=0] - Stagger delay in seconds
 */
export function fadeInView(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5, delay },
  }
}
