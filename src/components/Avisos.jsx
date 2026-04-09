import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { toast, confirm } from './Toast'
import { isLeaderRole } from '../lib/roles'
import { logActivity } from '../lib/activityLog'
import { Bell, Plus, X, Pin, Trash2, AlertCircle, Info, CheckCircle, Megaphone } from 'lucide-react'

const VL = '#5452C1'
const CH = '#2D2E39'

const TYPES = {
  info:    { label: 'Informativo', icon: Info,        color: '#3B82F6', bg: '#EFF6FF' },
  alerta:  { label: 'Alerta',      icon: AlertCircle, color: '#F59E0B', bg: '#FFFBEB' },
  urgente: { label: 'Urgente',     icon: AlertCircle, color: '#EF4444', bg: '#FEF2F2' },
  aviso:   { label: 'Aviso Geral', icon: Megaphone,   color: '#8B5CF6', bg: '#F5F3FF' },
  ok:      { label: 'Resolvido',   icon: CheckCircle, color: '#10B981', bg: '#ECFDF5' },
}

// Avisos são armazenados em activity_log como entity_type='announcement'
// metadata: { title, message, type, pinned, author_name }

export default function Avisos() {
  usePageTitle('Avisos da Equipe')
  const { profile } = useData()
  const isLeader = isLeaderRole(profile?.role)

  const [avisos, setAvisos]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterType, setFilter] = useState('all')
  const [form, setForm]         = useState({ title: '', message: '', type: 'info', pinned: false })

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('id,actor_id,metadata,created_at')
        .eq('org_id', profile.org_id)
        .eq('entity_type', 'announcement')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      // Ordenar: fixados primeiro, depois por data
      const all = (data || []).map(r => ({
        id:         r.id,
        actor_id:   r.actor_id,
        created_at: r.created_at,
        title:      r.metadata?.title   || '',
        message:    r.metadata?.message || '',
        type:       r.metadata?.type    || 'info',
        pinned:     r.metadata?.pinned  || false,
        author:     r.metadata?.author  || '',
      }))
      const sorted = [
        ...all.filter(a => a.pinned).sort((x,y) => new Date(y.created_at) - new Date(x.created_at)),
        ...all.filter(a => !a.pinned).sort((x,y) => new Date(y.created_at) - new Date(x.created_at)),
      ]
      setAvisos(sorted)
    } catch (err) {
      toast.error('Erro ao carregar avisos: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { load() }, [load])

  async function createAviso() {
    if (!form.title.trim() || !form.message.trim()) {
      toast.warning('Título e mensagem são obrigatórios')
      return
    }
    try {
      const { error } = await supabase.from('activity_log').insert({
        org_id:      profile.org_id,
        actor_id:    profile.id,
        entity_type: 'announcement',
        entity_id:   crypto.randomUUID(),
        action:      'published',
        module:      'avisos',
        metadata: {
          title:   form.title.trim(),
          message: form.message.trim(),
          type:    form.type,
          pinned:  form.pinned,
          author:  profile.full_name,
        },
      })
      if (error) throw error
      setForm({ title: '', message: '', type: 'info', pinned: false })
      setShowForm(false)
      await load()
      toast.success('Aviso publicado para a equipe')
    } catch (err) {
      toast.error('Erro ao publicar: ' + err.message)
    }
  }

  async function togglePin(av) {
    try {
      const newMeta = {
        title: av.title, message: av.message,
        type: av.type, pinned: !av.pinned, author: av.author
      }
      const { error } = await supabase.from('activity_log')
        .update({ metadata: newMeta })
        .eq('id', av.id).eq('org_id', profile.org_id)
      if (error) throw error
      setAvisos(prev => {
        const updated = prev.map(a => a.id === av.id ? { ...a, pinned: !a.pinned } : a)
        return [
          ...updated.filter(a => a.pinned).sort((x,y) => new Date(y.created_at) - new Date(x.created_at)),
          ...updated.filter(a => !a.pinned).sort((x,y) => new Date(y.created_at) - new Date(x.created_at)),
        ]
      })
    } catch (err) {
      toast.error('Erro ao fixar: ' + err.message)
    }
  }

  async function deleteAviso(id) {
    if (!await confirm('Remover este aviso?', { danger: true, confirmLabel: 'Remover' })) return
    try {
      const { error } = await supabase.from('activity_log')
        .delete().eq('id', id).eq('org_id', profile.org_id)
      if (error) throw error
      setAvisos(prev => prev.filter(a => a.id !== id))
      toast.success('Aviso removido')
    } catch (err) {
      toast.error('Erro ao remover: ' + err.message)
    }
  }

  const filtered = filterType === 'all' ? avisos : avisos.filter(a => a.type === filterType)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: CH }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-bold">Avisos da Equipe</h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                {avisos.length} aviso{avisos.length !== 1 ? 's' : ''}
                {avisos.filter(a => a.pinned).length > 0 && ` · ${avisos.filter(a => a.pinned).length} fixado${avisos.filter(a => a.pinned).length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {isLeader && (
            <button onClick={() => setShowForm(s => !s)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
              style={{ background: VL }}>
              <Plus className="w-4 h-4" /> Novo Aviso
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && isLeader && (
        <div className="bg-white border border-violet-200 rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-800">Publicar Aviso para a Equipe</h3>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <input
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 font-semibold"
              placeholder="Título do aviso *"
              value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <textarea rows={4}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none"
              placeholder="Mensagem *"
              value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
            <div className="flex gap-3 items-center flex-wrap">
              <select
                className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                <input type="checkbox" checked={form.pinned}
                  onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))}
                  className="accent-violet-600" />
                📌 Fixar no topo
              </label>
              <button onClick={createAviso}
                disabled={!form.title.trim() || !form.message.trim()}
                className="ml-auto px-5 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                style={{ background: VL }}>
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${filterType === 'all' ? 'text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
          style={filterType === 'all' ? { background: VL } : {}}>
          Todos ({avisos.length})
        </button>
        {Object.entries(TYPES).map(([k, v]) => {
          const count = avisos.filter(a => a.type === k).length
          if (!count) return null
          return (
            <button key={k} onClick={() => setFilter(k)}
              className="px-3 py-1.5 text-xs font-bold rounded-full transition-all"
              style={filterType === k ? { background: v.color, color: '#fff' } : { background: v.bg, color: v.color }}>
              {v.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-400">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center">
          <Bell className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Nenhum aviso publicado ainda.</p>
          {isLeader && <button onClick={() => setShowForm(true)} className="mt-3 text-xs font-semibold text-violet-600 hover:text-violet-700">+ Publicar primeiro aviso</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(av => {
            const T = TYPES[av.type] || TYPES.info
            const Icon = T.icon
            return (
              <div key={av.id} className={`bg-white border rounded-2xl p-5 transition-all ${av.pinned ? 'border-violet-300 shadow-sm' : 'border-zinc-200'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: T.bg }}>
                    <Icon className="w-4 h-4" style={{ color: T.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {av.pinned && <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">📌 Fixado</span>}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: T.bg, color: T.color }}>{T.label}</span>
                      {av.author && <span className="text-[10px] text-zinc-500">por {av.author}</span>}
                      <span className="text-[10px] text-zinc-400">
                        {new Date(av.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-zinc-800 mb-1">{av.title}</h3>
                    <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">{av.message}</p>
                  </div>
                  {isLeader && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => togglePin(av)} title={av.pinned ? 'Desafixar' : 'Fixar'}
                        className={`p-1.5 rounded-lg transition-colors ${av.pinned ? 'text-violet-600 bg-violet-50' : 'text-zinc-400 hover:text-violet-600 hover:bg-violet-50'}`}>
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteAviso(av.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
