import React, { useState, useEffect } from 'react'
import { Settings, User, Bell, Palette, Shield, Save, Eye, EyeOff, CheckCircle, AlertCircle, X, Key } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

const CH = '#2D2E39', VL = '#5452C1'
const TABS = [
  { id: 'perfil',       label: 'Perfil',       icon: User },
  { id: 'notificacoes', label: 'Notificações',  icon: Bell },
  { id: 'aparencia',    label: 'Aparência',     icon: Palette },
  { id: 'seguranca',    label: 'Segurança',     icon: Shield },
]
const AVATAR_COLORS = ['#5452C1','#2D2E39','#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316']
const LOCATIONS = [
  { value: 'escritorio', label: '🏢 Escritório' },
  { value: 'remoto',     label: '🏠 Remoto' },
  { value: 'cliente',    label: '🤝 Cliente' },
  { value: 'viagem',     label: '✈️ Viagem' },
]

export default function Configuracoes() {
  const { profile, refreshProfile } = useData()
  const [tab, setTab] = useState('perfil')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [fullName, setFullName] = useState('')
  const [initials, setInitials] = useState('')
  const [email, setEmail] = useState('')
  const [avatarColor, setAvatarColor] = useState(VL)
  const [location, setLocation] = useState('escritorio')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [notifTask, setNotifTask] = useState(true)
  const [notifDeadline, setNotifDeadline] = useState(true)
  const [notifMention, setNotifMention] = useState(true)
  const [notifSystem, setNotifSystem] = useState(false)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name || '')
    setInitials(profile.initials || '')
    setEmail(profile.email || '')
    setAvatarColor(profile.avatar_color || VL)
    setLocation(profile.location || 'escritorio')
  }, [profile])

  function feedback(msg, isError = false) {
    if (isError) { setError(msg); setSuccess(null) } else { setSuccess(msg); setError(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 3500)
  }

  function autoInitials(name) { return (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }

  async function savePerfil() {
    setSaving(true)
    const { error: err } = await supabase.from('profiles').update({
      full_name: fullName,
      initials: initials || autoInitials(fullName),
      // 'role' removido: apenas admin pode alterar via /admin
      avatar_color: avatarColor, location,
    }).eq('id', profile.id)
    if (err) { feedback(err.message, true) } else { await refreshProfile(); feedback('Perfil atualizado com sucesso.') }
    setSaving(false)
  }

  async function savePassword() {
    if (!newPass || newPass.length < 6) { feedback('Senha deve ter pelo menos 6 caracteres.', true); return }
    if (newPass !== confirmPass) { feedback('As senhas não coincidem.', true); return }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPass })
    if (err) { feedback(err.message, true) } else { setNewPass(''); setConfirmPass(''); feedback('Senha alterada com sucesso.') }
    setSaving(false)
  }

  const previewInitials = initials || autoInitials(fullName) || '?'

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      {/* Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: CH }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ background: avatarColor }}>
            {previewInitials}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-0.5 flex items-center gap-2"><Settings className="w-3 h-3" /> Configurações</div>
            <h1 className="text-2xl font-bold">{fullName || 'Minha conta'}</h1>
            <p className="text-sm text-zinc-400">{role} · {email}</p>
          </div>
        </div>
      </div>

      {success && <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700"><CheckCircle className="w-4 h-4 shrink-0" />{success}</div>}
      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}<button className="ml-auto" onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>}

      <div className="flex gap-4">
        {/* Nav */}
        <div className="w-48 shrink-0 space-y-1">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={tab === t.id ? { background: CH, color: '#fff' } : { color: '#6B7280' }}
                onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.background = '#F2F2F2' }}
                onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.background = '' }}>
                <Icon className="w-4 h-4 shrink-0" />{t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white border border-zinc-200 rounded-xl p-6">

          {tab === 'perfil' && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Dados do Perfil</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nome completo</label>
                  <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Iniciais</label>
                  <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 uppercase" maxLength={2} value={initials} onChange={e => setInitials(e.target.value.toUpperCase())} placeholder={autoInitials(fullName)} />
                </div>
                <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nível de acesso</label>
                <div className="w-full border border-zinc-100 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 text-zinc-500 flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: '#EEF2FF', color: '#5452C1' }}>{profile?.role || '—'}</span>
                  <span className="text-xs text-zinc-400">Só admin pode alterar</span>
                </div>
              </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">E-mail</label>
                  <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 text-zinc-500" value={email} readOnly />
                  <div className="text-[10px] text-zinc-400 mt-1">Não pode ser alterado aqui.</div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Localização padrão</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500" value={location} onChange={e => setLocation(e.target.value)}>
                    {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Cor do avatar</label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} onClick={() => setAvatarColor(c)} className="w-8 h-8 rounded-full flex items-center justify-center transition-all" style={{ background: c, outline: avatarColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }}>
                      {avatarColor === c && <span className="text-white text-sm font-bold">✓</span>}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: avatarColor }}>{previewInitials}</div>
                  <span className="text-xs text-zinc-500">Pré-visualização</span>
                </div>
              </div>
              <button onClick={savePerfil} disabled={saving} className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors" style={{ background: VL }}>
                <Save className="w-4 h-4" />{saving ? 'Salvando…' : 'Salvar perfil'}
              </button>
            </div>
          )}

          {tab === 'notificacoes' && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Preferências de Notificação</h2>
              {[
                [notifTask, setNotifTask, 'Tarefas', 'Atualizações de tarefas atribuídas a você'],
                [notifDeadline, setNotifDeadline, 'Prazos', 'Alertas de projetos e tarefas vencendo'],
                [notifMention, setNotifMention, 'Menções', 'Quando alguém te mencionar no Chat'],
                [notifSystem, setNotifSystem, 'Sistema', 'Atualizações e avisos do BX Hub'],
              ].map(([val, setter, label, desc]) => (
                <div key={label} className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">{label}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{desc}</div>
                  </div>
                  <button onClick={() => setter(v => !v)} className="w-12 h-6 rounded-full transition-colors relative" style={{ background: val ? VL : '#D1D5DB' }}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${val ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
              <div className="text-xs text-zinc-400">Preferências salvas localmente nesta sessão.</div>
            </div>
          )}

          {tab === 'aparencia' && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Aparência</h2>
              <div className="p-4 bg-zinc-50 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-800">Tema</div>
                  <div className="text-xs text-zinc-500 mt-0.5">BX Hub usa o tema Charcoal/Violet como padrão da marca.</div>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full ring-2 ring-offset-2" style={{ background: CH, ringColor: VL }} title="Charcoal (padrão)" />
                  <div className="w-8 h-8 rounded-full" style={{ background: VL }} title="Violet" />
                </div>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl">
                <div className="text-sm font-semibold text-zinc-800 mb-1">Tipografia</div>
                <div className="text-xs text-zinc-500">Montserrat · exclusiva BX Group</div>
                <div className="mt-3 font-semibold text-zinc-800" style={{ fontFamily: 'Montserrat' }}>AaBbCc 0123456789</div>
              </div>
              <div className="text-xs text-zinc-400">Customizações adicionais disponíveis em versões futuras.</div>
            </div>
          )}

          {tab === 'seguranca' && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Segurança da Conta</h2>
              <div className="space-y-4 max-w-sm">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nova senha</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 pr-10" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Confirmar senha</label>
                  <input type={showPass ? 'text' : 'password'} className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repita a nova senha" />
                </div>
                {newPass && confirmPass && (
                  <div className={`text-xs font-semibold flex items-center gap-1 ${newPass === confirmPass ? 'text-green-600' : 'text-red-500'}`}>
                    {newPass === confirmPass ? <><CheckCircle className="w-3 h-3" /> Senhas coincidem</> : <><X className="w-3 h-3" /> Senhas não coincidem</>}
                  </div>
                )}
                <button onClick={savePassword} disabled={saving || !newPass || !confirmPass} className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors" style={{ background: CH }}>
                  <Key className="w-4 h-4" />{saving ? 'Alterando…' : 'Alterar senha'}
                </button>
              </div>
              <div className="border-t border-zinc-100 pt-5">
                <h3 className="text-sm font-bold text-zinc-700 mb-3">Sessão</h3>
                <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">
                  <Shield className="w-4 h-4" /> Encerrar sessão
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
