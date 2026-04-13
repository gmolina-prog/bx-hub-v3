import React, { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCheck, X, AlertCircle, Clock, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { useNavigate } from 'react-router-dom'
import { toast, confirm } from './Toast'

const VL = '#5452C1'
const TYPE_MAP = {
  task:          { icon: CheckCircle,   color: '#10B981', bg: '#ECFDF5', label: 'Tarefa' },
  task_assigned: { icon: CheckCircle,   color: '#5452C1', bg: '#EEF2FF', label: 'Atribuição' },
  alert:         { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB', label: 'Alerta' },
  mention:       { icon: Bell,          color: VL,        bg: '#EEF2FF', label: 'Menção' },
  emergency:     { icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2', label: '🚨 Emergência' },
  system:        { icon: Info,          color: '#3B82F6', bg: '#EFF6FF', label: 'Sistema' },
  deadline:      { icon: Clock,         color: '#EF4444', bg: '#FEF2F2', label: 'Prazo' },
}

// Mapa entity_type → rota de navegação
const ENTITY_ROUTES = {
  task:          '/kanban',
  task_assigned: '/kanban',
  project:       '/timeline',
  pipeline_item: '/captacao',
  chat_channel:  '/chat',
  company:       '/cadastro',
  note:          '/notas',
}

function relTime(d) {
  if (!d) return ''
  const diff = Math.floor((Date.now() - new Date(d)) / 1000)
  if (diff < 60) return 'Agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d atrás`
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function Notificacoes() {
  const { profile } = useData()
  usePageTitle('Notificações')
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase.from('notifications').select('*').eq('org_id', profile.org_id).eq('user_id', profile.id).order('created_at', { ascending: false }).limit(100)
      const raw = data || []
      const seen = new Map()
      const deduped = []
      for (const n of raw) {
        const key = `${n.entity_id || n.id}-${n.type || 'default'}`
        if (!seen.has(key)) { seen.set(key, true); deduped.push(n) }
      }
      setNotifs(deduped)
    } catch (err) { console.error('[Notificacoes] load:', err.message) }
    finally { setLoading(false) }
  }, [profile])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!profile) return
    const ch = supabase.channel('notif-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, p => setNotifs(prev => [p.new, ...prev]))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [profile])

  async function markRead(id) {
    const { error } = await supabase.from('notifications')
      .update({ is_read: true }).eq('id', id).eq('user_id', profile.id)
    if (!error) setNotifs(prev => prev.map(n => n.id === id ? {...n, is_read: true} : n))
  }

  async function markAllRead() {
    setActing(true)
    try {
      if (notifs.some(n => !n.is_read)) {
        const { error } = await supabase.from('notifications')
          .update({ is_read: true }).eq('user_id', profile.id).eq('org_id', profile.org_id)
        if (!error) setNotifs(prev => prev.map(n => ({...n, is_read: true})))
        else toast.error('Erro ao marcar: ' + error.message)
      }
    } finally { setActing(false) }
  }

  async function deleteNotif(id) {
    const { error } = await supabase.from('notifications')
      .delete().eq('id', id).eq('user_id', profile.id)
    if (error) { toast.error('Erro ao remover notificação: ' + error.message); return }
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function clearAll() {
    if (!await confirm('Limpar todas as notificações?', { danger: true, confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return
    setActing(true)
    try {
      const { error } = await supabase.from('notifications')
        .delete().eq('user_id', profile.id).eq('org_id', profile.org_id)
      if (error) throw error
      setNotifs([])
    } catch (err) {
      toast.error('Erro ao limpar notificações: ' + err.message)
    } finally {
      setActing(false)
    }
  }

  const filtered = notifs.filter(n => {
    const mf = filter === 'all' || (filter === 'unread' && !n.is_read) || (filter === 'read' && n.is_read)
    const mt = typeFilter === 'all' || n.type === typeFilter
    return mf && mt
  })
  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: '#2D2E39' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2"><Bell className="w-3 h-3" /> Central</div>
            <h1 className="text-2xl font-bold mb-1">Notificações</h1>
            <p className="text-sm text-zinc-400">
              {unread > 0 ? <span className="text-violet-300 font-semibold">{unread} não lida{unread !== 1 ? 's' : ''}</span> : 'Tudo em dia'} · {notifs.length} total
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(TYPE_MAP).map(([key, t]) => {
              const count = notifs.filter(n => n.type === key && !n.is_read).length
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

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {[['all','Todas'],['unread',`Não lidas${unread>0?` (${unread})`:''}`],['read','Lidas']].map(([val,label]) => (
            <button key={val} onClick={() => setFilter(val)} className={`px-4 py-2 text-sm font-semibold transition-colors ${filter === val ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>{label}</button>
          ))}
        </div>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Todos os tipos</option>
          {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {unread > 0 && (
          <button onClick={markAllRead} disabled={acting} className="flex items-center gap-1.5 text-sm font-semibold border px-3 py-2 rounded-lg transition-colors hover:bg-violet-50" style={{ color: VL, borderColor: `${VL}40` }}>
            <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
          </button>
        )}
        {notifs.length > 0 && (
          <button onClick={clearAll} disabled={acting} className="ml-auto flex items-center gap-1.5 text-sm text-zinc-400 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" /> Limpar tudo
          </button>
        )}
      </div>

      {loading ? <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-400">Carregando…</div>
       : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <Bell className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <div className="text-sm text-zinc-500">{filter === 'unread' ? 'Nenhuma não lida' : 'Nenhuma notificação'}</div>
        </div>
      ) : (() => {
        // Agrupar por criticidade: emergency → alert/deadline → resto
        const groups = [
          { key: 'critico',     label: '🚨 Crítico',     types: ['emergency'],          color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
          { key: 'alerta',      label: '⚠️ Atenção',      types: ['alert','deadline'],   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
          { key: 'atribuicoes', label: '📋 Atribuições',  types: ['task_assigned','task'],color: '#5452C1', bg: '#EEF2FF', border: '#C7D2FE' },
          { key: 'outros',      label: '💬 Informativo',  types: [],                     color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
        ]

        const getGroup = (n) => {
          for (const g of groups.slice(0, -1))
            if (g.types.includes(n.type)) return g.key
          return 'outros'
        }

        const grouped = {}
        for (const g of groups) grouped[g.key] = []
        for (const n of filtered) grouped[getGroup(n)].push(n)

        return (
          <div className="space-y-4">
            {groups.map(g => {
              const items = grouped[g.key]
              if (items.length === 0) return null
              return (
                <div key={g.key}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: g.color }}>{g.label}</span>
                    <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full font-bold">{items.length}</span>
                  </div>
                  <div className="bg-white rounded-xl overflow-hidden divide-y divide-zinc-100"
                    style={{ border: `1.5px solid ${g.border}` }}>
                    {items.map(n => {
                      const t = TYPE_MAP[n.type] || TYPE_MAP.system
                      const Icon = t.icon
                      const route = ENTITY_ROUTES[n.entity_type] || ENTITY_ROUTES[n.type]
                      return (
                        <div key={n.id}
                          onClick={() => { if (!n.is_read) markRead(n.id); if (route) navigate(route) }}
                          className={`flex items-start gap-4 px-5 py-4 transition-colors ${route ? 'cursor-pointer hover:bg-violet-50' : 'hover:bg-zinc-50'} ${!n.is_read ? 'bg-violet-50/30' : ''}`}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: t.bg }}>
                            <Icon className="w-4 h-4" style={{ color: t.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className={`text-sm font-semibold ${n.is_read ? 'text-zinc-700' : 'text-zinc-900'}`}>{n.title}</div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-zinc-400 whitespace-nowrap">{relTime(n.created_at)}</span>
                                {!n.is_read && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: VL }} />}
                              </div>
                            </div>
                            {n.message && <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{n.message}</div>}
                            <div className="flex items-center gap-2 mt-2">
                              {route && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); if (!n.is_read) markRead(n.id); navigate(route) }}
                                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors"
                                  style={{ background: g.bg, color: g.color, border: `1px solid ${g.border}` }}>
                                  → Ver agora
                                </button>
                              )}
                              {!n.is_read && (
                                <button onClick={(e) => { e.stopPropagation(); markRead(n.id) }}
                                  className="flex items-center gap-1 text-[10px] font-semibold transition-colors" style={{ color: '#6B7280' }}>
                                  <Check className="w-3 h-3" /> Lida
                                </button>
                              )}
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); deleteNotif(n.id) }}
                            className="text-zinc-300 hover:text-zinc-500 transition-colors shrink-0 mt-0.5">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
