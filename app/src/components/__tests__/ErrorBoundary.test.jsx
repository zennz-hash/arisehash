import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ErrorBoundary from '../ErrorBoundary.jsx'

function ThrowError({ message }) {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ErrorBoundary>
          <div>Hello World</div>
        </ErrorBoundary>
      </MemoryRouter>
    )
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ErrorBoundary>
          <ThrowError message="test error" />
        </ErrorBoundary>
      </MemoryRouter>
    )
    consoleSpy.mockRestore()
    const body = document.body.textContent
    expect(body.length).toBeGreaterThan(0)
  })
})
