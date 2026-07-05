import { Component } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import * as Sentry from '@sentry/react'

/**
 * App-wide error boundary. Catches render/runtime errors in the subtree and
 * shows a dark fallback UI instead of a blank white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
    Sentry.captureException(error, { contexts: { react: info } })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="errb">
        <div className="errb-card">
          <span className="errb-ic"><AlertTriangle size={28} /></span>
          <h1 className="display errb-title">Terjadi kesalahan</h1>
          <p className="errb-sub">
            Maaf, ada yang tidak beres saat menampilkan halaman ini. Coba muat ulang —
            datamu tetap aman.
          </p>
          {this.state.error?.message && (
            <pre className="errb-detail">{String(this.state.error.message).slice(0, 240)}</pre>
          )}
          <div className="errb-actions">
            <button className="pill pill-indigo" onClick={this.handleReload}>
              <RotateCcw size={16} /> Muat Ulang
            </button>
            <button className="pill" onClick={this.handleHome}>
              <Home size={16} /> Ke Beranda
            </button>
          </div>
        </div>
      </div>
    )
  }
}
