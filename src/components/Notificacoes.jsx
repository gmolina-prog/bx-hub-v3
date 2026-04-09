import React, { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCheck, X, Filter, Clock, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

const TYPE_MAP = {
  task:       { icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50',  label: 'Tarefa' },
  alert:      { icon: AlertTriangle,color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'Alerta' },
  mention:    { icon: Bell,         color: 'text-violet-600', bg: 'bg-violet-50', label: 'Menção' },
  system:     { icon: Info,         color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Sistema' },
  deadline:   { icon: Clock,        color: 'text-red-600',    bg: 'bg-red-50',    label: 'Prazo' },
}

function NotifIcon({ type }) {
  const t = TYPE_MAP[type] || TYPE_MAP.system
  const Icon = t.icon
  return (
    <div className={`w-9 h-9 rounded-full ${t.bg} flex items-center justify-center shrink-0`}>
      <Icon className={`w-4 h-4 ${t.color}`} />
    </div>
  )
}

function fmtRelative(d) {
  const diff = Math.floor((Date.now() - new Date(d)) / 1000)
  if (diff < 60) return 'Agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d atrás`
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function Notificacoes() {
  const { profile } = useData()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')   // all | unread | read
  const [typeFilter, setTypeFilter] = useState('all')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error) setNotifs(data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  // Realtime: novas notificações chegando
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('notif-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        setNotifs(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    setActing(true)
    const unreadIds = notifs.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length > 0) {
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    }
    setActing(false)
  }

  async function deleteNotif(id) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function clearAll() {
    if (!window.confirm('Limpar todas as notificações?')) return
    setActing(true)
    await supabase.from('notifications').delete().eq('user_id', profile.id).eq('org_id', profile.org_id)
    setNotifs([])
    setActing(false)
  }

  const filtered = notifs.filter(n => {
    const matchFilter = filter === 'all' || (filter === 'unread' && !n.read) || (filter === 'read' && n.read)
    const matchType = typeFilter === 'all' || n.type === typeFilter
    return matchFilter && matchType
  })

  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <Bell className="w-3 h-3" /> Central
            </div>
            <h1 className="text-2xl font-bold mb-1">Notificações</h1>
            <p className="text-sm text-zinc-400">
              {unreadCount > 0 ? <span className="text-violet-300 font-semibold">{unreadCount} não lida{unreadCount !== 1 ? 's' : ''}</span> : 'Tudo em dia'} · {notifs.length} total
            </p>
          </div>
          <div className="flex gap-3">
            {Object.entries(TYPE_MAP).map(([key, t]) => {
              const count = notifs.filter(n => n.type === key && !n.read).length
              if (count === 0) return null
              return (
                <div key={key} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[60px]">
                  <div className="text-lg font-bold text-violet-300">{count}</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{t.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {[['all', 'Todas'], ['unread', 'Não lidas'], ['read', 'Lidas']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${filter === val ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>
              {label}{val === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          ))}
        </div>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Todos os tipos</option>
          {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {unreadCount > 0 && (
          <button onClick={markAllRead} disabled={acting} className="flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 border border-violet-200 hover:border-violet-400 px-3 py-2 rounded-lg transition-colors">
            <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
          </button>
        )}
        {notifs.length > 0 && (
          <button onClick={clearAll} disabled={acting} className="ml-auto flex items-center gap-1.5 text-sm text-zinc-400 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" /> Limpar tudo
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-400">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <Bell className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <div className="text-sm font-semibold text-zinc-500">
            {filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
          </div>
          <div className="text-xs text-zinc-400 mt-1">Você está em dia.</div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100">
          {filtered.map(n => (
            <div key={n.id} className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-zinc-50 ${!n.read ? 'bg-violet-50/40' : ''}`}>
              <NotifIcon type={n.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className={`text-sm font-semibold ${n.read ? 'text-zinc-700' : 'text-zinc-900'}`}>{n.title}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-zinc-400 whitespace-nowrap">{fmtRelative(n.created_at)}</span>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" title="Não lida" />
                    )}
                  </div>
                </div>
                {n.message && <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{n.message}</div>}
                {!n.read && (
                  <button onClick={() => markRead(n.id)} className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-700 mt-1.5 transition-colors">
                    <Check className="w-3 h-3" /> Marcar como lida
                  </button>
                )}
              </div>
              <button onClick={() => deleteNotif(n.id)} className="text-zinc-300 hover:text-zinc-500 transition-colors shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
