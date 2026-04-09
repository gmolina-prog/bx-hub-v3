import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, X, Check, AlertCircle, User, FolderOpen, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

const FREQ_MAP = {
  diaria: { label: 'Diária', color: 'bg-violet-100 text-violet-700', daysInterval: 1 },
  semanal: { label: 'Semanal', color: 'bg-blue-100 text-blue-700', daysInterval: 7 },
  mensal: { label: 'Mensal', color: 'bg-amber-100 text-amber-700', daysInterval: 30 },
}

function FreqBadge({ freq }) {
  const f = FREQ_MAP[freq] || { label: freq, color: 'bg-zinc-100 text-zinc-600' }
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${f.color}`}>{f.label}</span>
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function Rotinas() {
  const { profile } = useData()
  const [routines, setRoutines] = useState([])
  const [completions, setCompletions] = useState([])
  const [projects, setProjects] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', frequency: 'semanal', assigned_to: '', project_id: '', is_active: true })
  const [filterFreq, setFilterFreq] = useState('all')
  const [filterAssigned, setFilterAssigned] = useState('all')

  const today = todayStr()

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [routRes, compRes, projRes, profRes] = await Promise.allSettled([
      supabase.from('routines').select('*').eq('org_id', profile.org_id).eq('is_active', true).order('title'),
      supabase.from('routine_completions').select('*').eq('org_id', profile.org_id).gte('reference_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]),
      supabase.from('projects').select('id,name').eq('org_id', profile.org_id).order('name'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
    ])
    if (routRes.status === 'fulfilled' && !routRes.value.error) setRoutines(routRes.value.data || [])
    if (compRes.status === 'fulfilled' && !compRes.value.error) setCompletions(compRes.value.data || [])
    if (projRes.status === 'fulfilled' && !projRes.value.error) setProjects(projRes.value.data || [])
    if (profRes.status === 'fulfilled' && !profRes.value.error) setProfilesList(profRes.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  function isDoneToday(routineId) {
    return completions.some(c => c.routine_id === routineId && c.reference_date === today)
  }

  function lastDone(routineId) {
    const done = completions.filter(c => c.routine_id === routineId).sort((a, b) => b.reference_date.localeCompare(a.reference_date))
    if (!done.length) return null
    return done[0].reference_date
  }

  function isOverdue(routine) {
    const last = lastDone(routine.id)
    if (!last) return true
    const interval = FREQ_MAP[routine.frequency]?.daysInterval || 7
    const daysSince = Math.floor((new Date(today) - new Date(last)) / 86400000)
    return daysSince >= interval
  }

  async function toggleDone(routine) {
    const done = isDoneToday(routine.id)
    setSaving(routine.id)
    if (done) {
      const comp = completions.find(c => c.routine_id === routine.id && c.reference_date === today)
      if (comp) await supabase.from('routine_completions').delete().eq('id', comp.id)
    } else {
      await supabase.from('routine_completions').insert({
        routine_id: routine.id, completed_by: profile.id, reference_date: today, org_id: profile.org_id,
      })
    }
    await load(); setSaving(null)
  }

  async function createRoutine() {
    if (!form.title.trim()) return
    const { error: err } = await supabase.from('routines').insert({
      org_id: profile.org_id, title: form.title, frequency: form.frequency,
      assigned_to: form.assigned_to || null, project_id: form.project_id || null, is_active: true,
    })
    if (err) { setError(err.message); return }
    setShowForm(false); setForm({ title: '', frequency: 'semanal', assigned_to: '', project_id: '', is_active: true })
    await load()
  }

  async function archiveRoutine(id) {
    await supabase.from('routines').update({ is_active: false }).eq('id', id)
    await load()
  }

  const filtered = routines.filter(r => {
    const matchFreq = filterFreq === 'all' || r.frequency === filterFreq
    const matchAssigned = filterAssigned === 'all' || r.assigned_to === filterAssigned
    return matchFreq && matchAssigned
  })

  const doneToday = filtered.filter(r => isDoneToday(r.id)).length
  const overdue = filtered.filter(r => !isDoneToday(r.id) && isOverdue(r)).length
  const compliance = filtered.length > 0 ? Math.round(doneToday / filtered.length * 100) : 0

  const profileName = (id) => profiles.find(p => p.id === id)?.full_name || '—'
  const projectName = (id) => projects.find(p => p.id === id)?.name || '—'

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> Compliance Operacional
            </div>
            <h1 className="text-2xl font-bold mb-1">Rotinas</h1>
            <p className="text-sm text-zinc-400">{routines.length} rotina{routines.length !== 1 ? 's' : ''} ativas</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-green-400">{compliance}%</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Compliance hoje</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-violet-300">{doneToday}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Concluídas hoje</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-red-400">{overdue}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Em atraso</div>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 bg-white/10 rounded-full h-2">
          <div className="bg-violet-400 h-2 rounded-full transition-all" style={{ width: `${compliance}%` }} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterFreq} onChange={e => setFilterFreq(e.target.value)}>
          <option value="all">Todas as frequências</option>
          {Object.entries(FREQ_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)}>
          <option value="all">Todos os responsáveis</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <button onClick={() => setShowForm(true)} className="ml-auto flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" /> Nova rotina
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-violet-200 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-800">Nova Rotina</h3>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Título *</label>
              <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Nome da rotina" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Frequência</label>
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.frequency} onChange={e => setForm(p => ({...p, frequency: e.target.value}))}>
                {Object.entries(FREQ_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Responsável</label>
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.assigned_to} onChange={e => setForm(p => ({...p, assigned_to: e.target.value}))}>
                <option value="">— nenhum —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createRoutine} disabled={!form.title.trim()} className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
              <Plus className="w-4 h-4" /> Criar
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-zinc-500 px-4 py-2">Cancelar</button>
          </div>
        </div>
      )}

      {/* Routines list */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-400">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <RefreshCw className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <div className="text-sm font-semibold text-zinc-500">Nenhuma rotina encontrada</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const done = isDoneToday(r.id)
            const overdueFl = !done && isOverdue(r)
            const last = lastDone(r.id)
            return (
              <div key={r.id} className={`bg-white border rounded-xl px-5 py-4 flex items-center gap-4 transition-all ${done ? 'border-green-200 bg-green-50' : overdueFl ? 'border-red-200' : 'border-zinc-200'}`}>
                <button
                  onClick={() => toggleDone(r)}
                  disabled={saving === r.id}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${done ? 'bg-green-500 border-green-500 text-white' : overdueFl ? 'border-red-400 hover:border-green-400' : 'border-zinc-300 hover:border-green-400'}`}
                >
                  {saving === r.id ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : done ? <Check className="w-4 h-4" /> : null}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${done ? 'text-green-800 line-through' : 'text-zinc-800'}`}>{r.title}</div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <FreqBadge freq={r.frequency} />
                    {r.assigned_to && <span className="text-xs text-zinc-500 flex items-center gap-1"><User className="w-3 h-3" />{profileName(r.assigned_to)}</span>}
                    {r.project_id && <span className="text-xs text-zinc-500 flex items-center gap-1"><FolderOpen className="w-3 h-3" />{projectName(r.project_id)}</span>}
                    {last && <span className="text-xs text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3" />Última: {new Date(last).toLocaleDateString('pt-BR')}</span>}
                    {overdueFl && <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">Em atraso</span>}
                  </div>
                </div>
                <button onClick={() => archiveRoutine(r.id)} className="text-zinc-300 hover:text-zinc-500 transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
