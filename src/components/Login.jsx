import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,    setError]    = useState(null)
  const [mode,     setMode]     = useState('login')  // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false)

  async function handleReset(e) {
    if (e) e.preventDefault()
    if (!email.trim()) { setError('Informe seu e-mail para recuperação.'); return }
    setLoading(true); setError(null)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/',
      })
      if (err) throw err
      setResetSent(true)
    } catch (err) {
      setError('Não foi possível enviar o link. Verifique o e-mail informado.')
    } finally {
      setLoading(false)
    }
  }

  // Tradução de erros do Supabase para pt-BR
  function translateAuthError(msg) {
    const m = (msg || '').toLowerCase()
    if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password'))
      return 'E-mail ou senha incorretos. Verifique os dados e tente novamente.'
    if (m.includes('email not confirmed'))
      return 'E-mail não confirmado. Verifique sua caixa de entrada.'
    if (m.includes('user not found'))
      return 'Nenhuma conta encontrada com este e-mail.'
    if (m.includes('too many requests') || m.includes('rate limit'))
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
    if (m.includes('network') || m.includes('fetch'))
      return 'Erro de conexão. Verifique sua internet e tente novamente.'
    return 'Erro ao fazer login. Tente novamente.'
  }

  async function handleLogin(e) {
    if (e) e.preventDefault()
    // B-117: validação prévia
    if (!email.trim()) { setError('Informe seu e-mail.'); return }
    if (!password)     { setError('Informe sua senha.'); return }
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) throw err
    } catch (err) {
      setError(translateAuthError(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-charcoal to-violet-900 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-charcoal">BX Hub</h1>
          <p className="text-sm text-zinc-500 mt-1">Sistema interno BX Group</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
              placeholder="seu@email.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">
              {error}
            </div>
          )}
          {mode === 'login' ? (
            <>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-violet text-white font-bold py-2.5 rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
              <button type="button" onClick={() => { setMode('reset'); setError(null) }}
                className="w-full text-xs text-zinc-400 hover:text-violet-600 py-1 transition-colors text-center">
                Esqueci minha senha
              </button>
            </>
          ) : resetSent ? (
            <div className="text-center py-2">
              <div className="text-3xl mb-2">📬</div>
              <p className="text-sm font-semibold text-zinc-700">Link enviado!</p>
              <p className="text-xs text-zinc-500 mt-1">Verifique seu e-mail e clique no link para redefinir a senha.</p>
              <button type="button" onClick={() => { setMode('login'); setResetSent(false); setError(null) }}
                className="mt-3 text-xs text-violet-600 hover:text-violet-700 font-semibold">
                ← Voltar para o login
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-500 mb-1">Informe seu e-mail para receber o link de recuperação de senha.</p>
              <button
                onClick={handleReset}
                disabled={loading}
                className="w-full bg-violet text-white font-bold py-2.5 rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Enviando…' : 'Enviar link de recuperação'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(null) }}
                className="w-full text-xs text-zinc-400 hover:text-violet-600 py-1 transition-colors text-center">
                ← Voltar para o login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
