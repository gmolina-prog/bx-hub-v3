import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/Toast'
import { DataProvider } from './contexts/DataContext'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[BX Hub] Runtime error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'Montserrat, sans-serif', maxWidth: 600, margin: '80px auto' }}>
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 24 }}>
            <h2 style={{ color: '#DC2626', margin: '0 0 8px' }}>⚠️ Erro no BX Hub</h2>
            <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 16px' }}>
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <pre style={{ background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 12, fontSize: 11, color: '#374151', overflow: 'auto' }}>
              {this.state.error?.message || 'Erro desconhecido'}
              {'\n'}
              {this.state.error?.stack?.split('\n').slice(0, 5).join('\n')}
            </pre>
            <button onClick={() => window.location.reload()}
              style={{ marginTop: 16, background: '#5452C1', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: 'Montserrat', fontWeight: 600 }}>
              Recarregar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <DataProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </DataProvider>
    </BrowserRouter>
  </ErrorBoundary>
)
