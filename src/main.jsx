import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/Toast'
import { DataProvider } from './contexts/DataContext'
import './index.css'

// ─── PWA AUTO-UPDATE + KILL SWITCH ──────────────────────────────────────────
// Service Workers podem prender consultores em bundle antigo. Estratégia:
// 1. Quando um novo SW assume controle (via skipWaiting/clientsClaim configurado
//    no vite.config.js), forçamos um reload one-shot da aba.
// 2. Detectamos chunks 404 (bundle antigo pedindo asset que não existe mais)
//    e disparamos limpeza + reload nesse caso também.
if ('serviceWorker' in navigator) {
  // Reload quando o SW novo assumir (skipWaiting + clientsClaim ativos).
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    console.info('[BX Hub] Nova versão detectada, recarregando.')
    window.location.reload()
  })
  // Cheque manual: se o SW está controlando mas há um waiting, pede skip.
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    // Poll de update a cada 60s para puxar releases novas sem F5.
    setInterval(() => reg?.update().catch(() => {}), 60_000)
  }).catch(() => {})
}

// Captura erros de carregamento de chunk/asset (bundle antigo + asset deletado).
// Sintoma: bundle apontando para /assets/index-HASH.js que retorna 404 ou HTML.
window.addEventListener('error', async (e) => {
  const msg = e?.message || ''
  const src = e?.target?.src || e?.target?.href || ''
  const looksLikeStaleAsset =
    /Loading chunk \d+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Unexpected token '<'/i.test(msg) ||  // HTML servido onde se esperava JS
    /Failed to fetch dynamically imported/i.test(msg) ||
    (src.includes('/assets/') && (src.endsWith('.js') || src.endsWith('.css')) && (e?.target?.tagName === 'SCRIPT' || e?.target?.tagName === 'LINK'))
  if (!looksLikeStaleAsset) return
  if (sessionStorage.getItem('__bx_recovered__')) return  // anti-loop
  sessionStorage.setItem('__bx_recovered__', '1')
  console.warn('[BX Hub] Bundle antigo detectado, limpando caches e recarregando.', msg, src)
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch (_) {}
  window.location.reload()
}, true)

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
