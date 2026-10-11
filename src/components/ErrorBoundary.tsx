import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an unhandled render error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4 py-12">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-sage-200/80 shadow-card text-center">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle size={28} />
            </div>

            <h1 className="font-serif text-2xl font-bold text-sage-900 mb-2">
              Something went wrong
            </h1>

            <p className="text-sm text-sage-600 mb-6 leading-relaxed">
              An unexpected error occurred while displaying this page. You can try refreshing the view or returning to the home page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 text-left p-3 rounded-xl bg-sage-50 border border-sage-200 text-xs text-sage-700 overflow-x-auto max-h-32">
                <p className="font-semibold text-red-600 mb-1">Dev Error:</p>
                <code className="break-all">{this.state.error.message}</code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 btn-primary py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={15} />
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 btn-secondary py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Home size={15} />
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
