import React, { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

// ─── Toast Store (singleton, sem context overhead) ──────────────────────────
let _setToasts = null

export function toast(message, type = 'success', duration = 3500) {
  if (!_setToasts) return
  const id = Date.now() + Math.random()
  _setToasts(prev => [...prev.slice(-4), { id, message, type, duration }])
}
toast.success = (msg, dur)  => toast(msg, 'success', dur)
toast.error   = (msg, dur)  => toast(msg, 'error',   dur || 5000)
toast.warning = (msg, dur)  => toast(msg, 'warning', dur)
toast.info    = (msg, dur)  => toast(msg, 'info',    dur)

// ─── Confirm Store ───────────────────────────────────────────────────────────
let _showConfirm = null

export function confirm(message, options = {}) {
  return new Promise(resolve => {
    if (!_showConfirm) { resolve(window.confirm(message)); return }
    _showConfirm({
      message,
      title: options.title || 'Confirmar ação',
      confirmLabel: options.confirmLabel || 'Confirmar',
      cancelLabel: options.cancelLabel || 'Cancelar',
      danger: options.danger !== false,
      resolve,
    })
  })
}

// ─── Toast Component ─────────────────────────────────────────────────────────
const ICONS = {
  success: { Icon: CheckCircle, color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  error:   { Icon: AlertCircle, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  warning: { Icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  info:    { Icon: Info, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
}

function ToastItem({ toast: t, onRemove }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(t.id), 300)
    }, t.duration || 3500)
    return () => clearTimeout(timer)
  }, [])

  const cfg = ICONS[t.type] || ICONS.success
  const { Icon } = cfg

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm w-full transition-all duration-300"
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(24px)',
        fontFamily: 'Montserrat, system-ui, sans-serif',
      }}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: cfg.color }} />
      <p className="flex-1 text-sm font-semibold" style={{ color: '#2D2E39' }}>{t.message}</p>
      <button onClick={() => { setVisible(false); setTimeout(() => onRemove(t.id), 300) }}
        className="shrink-0 hover:opacity-70 transition-opacity">
        <X className="w-3.5 h-3.5 text-zinc-400" />
      </button>
    </div>
  )
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────
function ConfirmDialog({ state, onClose }) {
  if (!state) return null
  const { message, title, confirmLabel, cancelLabel, danger, resolve } = state

  function handle(result) { resolve(result); onClose() }

  // ESC = cancelar (false)
  React.useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handle(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', fontFamily: 'Montserrat, system-ui, sans-serif' }}
      onClick={e => e.target === e.currentTarget && handle(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
        {danger && (
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
        )}
        <h3 className="text-sm font-bold text-zinc-800 text-center mb-2">{title}</h3>
        <p className="text-sm text-zinc-500 text-center mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={() => handle(false)}
            className="flex-1 py-2.5 text-sm font-semibold border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors">
            {cancelLabel}
          </button>
          <button onClick={() => handle(true)}
            className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white transition-colors"
            style={{ background: danger ? '#EF4444' : '#5452C1' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Provider — montar uma vez em main.jsx / Layout ──────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)

  // Registrar singletons
  useEffect(() => {
    _setToasts = setToasts
    _showConfirm = setConfirmState
    return () => { _setToasts = null; _showConfirm = null }
  }, [])

  function remove(id) { setToasts(prev => prev.filter(t => t.id !== id)) }

  return (
    <>
      {children}
      {/* Toasts — canto inferior direito */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[9998] pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
      {/* Confirm dialog */}
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </>
  )
}
