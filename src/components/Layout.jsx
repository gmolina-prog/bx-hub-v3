import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Settings, Bell, MapPin, X, Check, CheckCheck, LogOut, ChevronRight } from 'lucide-react'
import Sidebar from './Sidebar'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

const CH = '#2D2E39', VL = '#5452C1'

const CHECKIN_TYPES = [
  { value: 'escritorio', label: 'Escritório',  icon: '🏢', color: '#3B82F6' },
  { value: 'cliente',    label: 'No Cliente',  icon: '🤝', color: '#8B5CF6' },
  { value: 'remoto',     label: 'Remoto',      icon: '🏠', color: '#10B981' },
  { value: 'viagem',     label: 'Em Viagem',   icon: '✈️', color: '#F59E0B' },
]

// ─── Painel de Notificações ───────────────────────────────────────────────────
function NotificationPanel({ profile, onClose }) {
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase.from('notifications').select('*').eq('org_id', profile.org_id).eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setNotifs(data || []); setLoading(false) })
  }, [profile])

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAll() {
    const ids = notifs.filter(n => !n.is_read).map(n => n.id)
    if (ids.length > 0) await supabase.from('notifications').update({ is_read: true }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function relTime(d) {
    const s = (Date.now() - new Date(d)) / 1000
    if (s < 60) return 'agora'
    if (s < 3600) return `${Math.floor(s / 60)}min`
    if (s < 86400) return `${Math.floor(s / 3600)}h`
    return `${Math.floor(s / 86400)}d`
  }

  const TYPE_ICONS = { task: '📋', alert: '⚠️', mention: '💬', system: 'ℹ️', deadline: '⏰' }
  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-zinc-200 z-50 overflow-hidden" style={{ maxHeight: '70vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div>
          <h3 className="text-sm font-bold text-zinc-800">Notificações</h3>
          {unread > 0 && <p className="text-xs text-zinc-400">{unread} não lida{unread !== 1 ? 's' : ''}</p>}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={markAll} className="text-xs font-semibold flex items-center gap-1 transition-colors" style={{ color: VL }}>
              <CheckCheck className="w-3 h-3" /> Marcar todas
            </button>
          )}
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 110px)' }}>
        {loading ? (
          <div className="p-6 text-center text-xs text-zinc-400">Carregando…</div>
        ) : notifs.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Nenhuma notificação</p>
          </div>
        ) : notifs.map(n => (
          <div key={n.id} onClick={() => markRead(n.id)}
            className={`flex items-start gap-3 px-4 py-3 border-b border-zinc-50 cursor-pointer hover:bg-zinc-50 transition-colors ${!n.is_read ? 'bg-violet-50/50' : ''}`}>
            <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.type] || 'ℹ️'}</span>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${n.is_read ? 'text-zinc-700' : 'text-zinc-900'} leading-tight`}>{n.title}</div>
              {n.message && <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{n.message}</div>}
              <div className="text-[10px] text-zinc-400 mt-1">{relTime(n.created_at)}</div>
            </div>
            {!n.is_read && <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: VL }} />}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-zinc-100">
        <button onClick={() => { navigate('/notificacoes'); onClose() }}
          className="w-full text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1" style={{ color: VL }}>
          Ver todas as notificações <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Painel de Configurações ──────────────────────────────────────────────────
function SettingsPanel({ profile, onClose }) {
  const navigate = useNavigate()

  const items = [
    { icon: '👤', label: 'Meu Perfil',       path: '/configuracoes', desc: 'Editar dados e avatar' },
    { icon: '🔔', label: 'Notificações',      path: '/notificacoes',  desc: 'Central de notificações' },
    { icon: '⚙️', label: 'Configurações',     path: '/configuracoes', desc: 'Preferências do sistema' },
  ]
  const adminItems = ['owner', 'admin', 'Gerente'].includes(profile?.role) ? [
    { icon: '🔐', label: 'Admin',             path: '/admin',    desc: 'Usuários e permissões' },
    { icon: '📝', label: 'Logs de Atividade', path: '/logs',     desc: 'Auditoria do sistema' },
    { icon: '⚡', label: 'Automações',        path: '/automacoes', desc: 'Regras e workflows' },
  ] : []

  return (
    <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-2xl border border-zinc-200 z-50 overflow-hidden">
      {/* User info */}
      <div className="px-4 py-4 border-b border-zinc-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: profile?.avatar_color || VL }}>
          {profile?.initials || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-zinc-800 truncate">{profile?.full_name}</div>
          <div className="text-xs text-zinc-500 truncate">{profile?.role} · {profile?.email}</div>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 shrink-0"><X className="w-4 h-4" /></button>
      </div>

      {/* Items */}
      <div className="py-1">
        {[...items, ...(adminItems.length > 0 ? [null, ...adminItems] : [])].map((item, i) => {
          if (!item) return <div key={`div-${i}`} className="border-t border-zinc-100 my-1" />
          return (
            <button key={item.path + item.label} onClick={() => { navigate(item.path); onClose() }}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors">
              <span className="text-base w-6 text-center shrink-0">{item.icon}</span>
              <div>
                <div className="text-sm font-semibold text-zinc-700">{item.label}</div>
                <div className="text-[10px] text-zinc-400">{item.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Logout */}
      <div className="border-t border-zinc-100 px-4 py-3">
        <button onClick={() => supabase.auth.signOut()}
          className="w-full flex items-center gap-3 text-sm font-semibold text-red-500 hover:text-red-600 transition-colors">
          <LogOut className="w-4 h-4" /> Encerrar sessão
        </button>
      </div>
    </div>
  )
}

// ─── Painel de Check-in ───────────────────────────────────────────────────────
function CheckInPanel({ profile, onClose }) {
  const [loading, setLoading] = useState(true)
  const [currentCI, setCurrentCI] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [clientName, setClientName] = useState('')
  const [location, setLocation] = useState('')
  const [gps, setGps] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]
    supabase.from('check_ins').select('*').eq('user_id', profile.id).eq('org_id', profile.org_id)
      .eq('date', today).is('check_out_time', null).order('check_in_time', { ascending: false }).limit(1)
      .then(({ data }) => {
        setCurrentCI(data?.[0] || null)
        setLoading(false)
      })
    // GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      )
    }
  }, [profile])

  async function doCheckIn() {
    if (!selectedType) return
    setSaving(true)
    // Fechar check-ins abertos do dia
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('check_ins').update({ check_out_time: new Date().toISOString() })
      .eq('user_id', profile.id).eq('org_id', profile.org_id).eq('date', today).is('check_out_time', null)

    const payload = {
      org_id: profile.org_id,
      user_id: profile.id,
      status: selectedType,
      date: today,
      check_in_time: new Date().toISOString(),
      activity: clientName || null,
      location: location || null,
      latitude: gps?.lat || null,
      longitude: gps?.lng || null,
    }
    const { data } = await supabase.from('check_ins').insert(payload).select().single()
    setCurrentCI(data)
    setSelectedType(null)
    setClientName('')
    setSaving(false)
  }

  async function doCheckOut() {
    if (!currentCI) return
    setSaving(true)
    await supabase.from('check_ins').update({ check_out_time: new Date().toISOString() }).eq('id', currentCI.id)
    setCurrentCI(null)
    setSaving(false)
  }

  function fmtTime(d) {
    return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const currentType = currentCI ? CHECKIN_TYPES.find(t => t.value === currentCI.status) : null

  return (
    <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-zinc-200 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: VL }} /> Check-in Rápido
        </h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center text-xs text-zinc-400 py-4">Carregando…</div>
        ) : currentCI ? (
          /* Status atual */
          <div>
            <div className="flex items-center gap-3 p-3 rounded-xl border-2 mb-4" style={{ borderColor: `${currentType?.color || VL}40`, background: `${currentType?.color || VL}08` }}>
              <span className="text-2xl">{currentType?.icon || '📍'}</span>
              <div>
                <div className="text-sm font-bold text-zinc-800">{currentType?.label || currentCI.status}</div>
                {currentCI.activity && <div className="text-xs text-zinc-500">{currentCI.activity}</div>}
                <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Desde {fmtTime(currentCI.check_in_time)}
                  {currentCI.latitude && <span className="text-green-600 ml-1">· GPS ✓</span>}
                </div>
              </div>
            </div>
            <button onClick={doCheckOut} disabled={saving}
              className="w-full py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
              style={{ background: '#EF4444' }}>
              {saving ? 'Registrando saída…' : '⏹ Registrar Saída'}
            </button>
          </div>
        ) : (
          /* Novo check-in */
          <div>
            <p className="text-xs text-zinc-500 mb-3">Onde você está agora?</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {CHECKIN_TYPES.map(t => (
                <button key={t.value} onClick={() => setSelectedType(t.value)}
                  className="p-3 rounded-xl border-2 text-left transition-all"
                  style={{
                    borderColor: selectedType === t.value ? t.color : '#E5E5E5',
                    background: selectedType === t.value ? `${t.color}10` : 'white',
                  }}>
                  <span className="text-xl block mb-1">{t.icon}</span>
                  <span className="text-xs font-bold" style={{ color: selectedType === t.value ? t.color : '#374151' }}>{t.label}</span>
                </button>
              ))}
            </div>
            {selectedType === 'cliente' && (
              <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-violet-400"
                placeholder="Nome do cliente / empresa…" value={clientName} onChange={e => setClientName(e.target.value)} />
            )}
            <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-violet-400"
              placeholder="Endereço ou observação (opcional)…" value={location} onChange={e => setLocation(e.target.value)} />
            {gps && <div className="text-[10px] text-green-600 mb-3 flex items-center gap-1">✅ GPS disponível · {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</div>}
            <button onClick={doCheckIn} disabled={!selectedType || saving}
              className="w-full py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
              style={{ background: selectedType ? (CHECKIN_TYPES.find(t => t.value === selectedType)?.color || VL) : '#D1D5DB' }}>
              {saving ? 'Registrando…' : '✅ Fazer Check-in'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Layout Principal ─────────────────────────────────────────────────────────
export default function Layout({ children }) {
  const { profile } = useData()
  const location = useLocation()
  const [openPanel, setOpenPanel] = useState(null) // 'notif' | 'settings' | 'checkin'
  const [unreadCount, setUnreadCount] = useState(0)
  const [checkinStatus, setCheckinStatus] = useState(null) // status do check-in ativo
  const headerRef = useRef(null)

  // Carregar estado inicial
  useEffect(() => {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]

    Promise.allSettled([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('user_id', profile.id).eq('is_read', false),
      supabase.from('check_ins').select('status').eq('user_id', profile.id).eq('org_id', profile.org_id).eq('date', today).is('check_out_time', null).limit(1),
    ]).then(([notifR, ciR]) => {
      if (notifR.status === 'fulfilled' && !notifR.value.error) setUnreadCount(notifR.value.count || 0)
      if (ciR.status === 'fulfilled' && !ciR.value.error) {
        setCheckinStatus(ciR.value.data?.[0]?.status || null)
      }
    })

    // Realtime notificações
    const ch = supabase.channel('layout-notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => setUnreadCount(p => p + 1))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('user_id', profile.id).eq('is_read', false).then(({ count }) => setUnreadCount(count || 0)))
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [profile])

  // Fechar painéis ao mudar de rota
  useEffect(() => { setOpenPanel(null) }, [location.pathname])

  // Fechar painéis ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setOpenPanel(null)
      }
    }
    if (openPanel) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openPanel])

  function toggle(panel) {
    setOpenPanel(prev => prev === panel ? null : panel)
  }

  const currentCIType = checkinStatus ? CHECKIN_TYPES.find(t => t.value === checkinStatus) : null

  // Título da página baseado na rota
  const PAGE_TITLES = {
    '/': 'Dashboard', '/portfolio': 'Portfolio', '/produtividade': 'Produtividade',
    '/notas': 'Notas & Reuniões', '/kanban': 'Kanban', '/timeline': 'Timeline',
    '/riscos': 'Riscos', '/captacao': 'Captação', '/bi': 'BI', '/rotinas': 'Rotinas',
    '/crm': 'CRM', '/intakes': 'Intakes', '/chat': 'Chat', '/calendario': 'Calendário',
    '/time': 'Time', '/reembolsos': 'Reembolsos', '/cadastro': 'Cadastro',
    '/automacoes': 'Automações', '/admin': 'Admin', '/logs': 'Logs',
    '/notificacoes': 'Notificações', '/configuracoes': 'Configurações',
  }
  const pageTitle = PAGE_TITLES[location.pathname] || 'BX Hub'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── TOP HEADER ── */}
        <header ref={headerRef} className="h-14 flex items-center justify-between px-5 border-b border-zinc-200 bg-white shrink-0 relative z-30">
          {/* Left: page title */}
          <div>
            <h2 className="text-sm font-bold text-zinc-800">{pageTitle}</h2>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">BX Project Hub</p>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-1">

            {/* CHECK-IN */}
            <div className="relative">
              <button
                onClick={() => toggle('checkin')}
                title={currentCIType ? `Check-in: ${currentCIType.label}` : 'Fazer Check-in'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                style={currentCIType
                  ? { background: `${currentCIType.color}15`, color: currentCIType.color, border: `1px solid ${currentCIType.color}30` }
                  : { background: '#F4F5F7', color: '#6B7280', border: '1px solid #E5E5E5' }}>
                <span className="text-base">{currentCIType?.icon || '📍'}</span>
                <span className="hidden sm:inline">{currentCIType?.label || 'Check-in'}</span>
                {currentCIType && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block ml-0.5" />}
              </button>
              {openPanel === 'checkin' && (
                <CheckInPanel
                  profile={profile}
                  onClose={() => {
                    setOpenPanel(null)
                    // Recarregar status após check-in
                    const today = new Date().toISOString().split('T')[0]
                    supabase.from('check_ins').select('status').eq('user_id', profile.id).eq('org_id', profile.org_id).eq('date', today).is('check_out_time', null).limit(1)
                      .then(({ data }) => setCheckinStatus(data?.[0]?.status || null))
                  }}
                />
              )}
            </div>

            {/* BELL */}
            <div className="relative">
              <button
                onClick={() => toggle('notif')}
                title="Notificações"
                className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors">
                <Bell className="w-4.5 h-4.5 text-zinc-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {openPanel === 'notif' && (
                <NotificationPanel
                  profile={profile}
                  onClose={() => {
                    setOpenPanel(null)
                    setUnreadCount(0)
                  }}
                />
              )}
            </div>

            {/* GEAR */}
            <div className="relative">
              <button
                onClick={() => toggle('settings')}
                title="Configurações"
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${openPanel === 'settings' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-100 text-zinc-500'}`}>
                <Settings className="w-4 h-4" />
              </button>
              {openPanel === 'settings' && (
                <SettingsPanel profile={profile} onClose={() => setOpenPanel(null)} />
              )}
            </div>

            {/* Avatar */}
            {profile && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white ml-1 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ background: profile.avatar_color || VL }}
                title={profile.full_name}
                onClick={() => toggle('settings')}>
                {profile.initials || profile.full_name?.slice(0, 2).toUpperCase() || '?'}
              </div>
            )}
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <main className="flex-1 overflow-y-auto bg-[#F2F2F2]">
          {children}
        </main>
      </div>
    </div>
  )
}
