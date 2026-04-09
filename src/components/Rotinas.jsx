import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, X, Check, AlertCircle, User, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

const VL = '#5452C1'
const GREEN = '#10B981', AMBER = '#F59E0B', RED = '#EF4444'

const FREQ = {
  diaria:  { label: 'Diária',   color: VL,   bg: '#EEF2FF', days: 1 },
  semanal: { label: 'Semanal',  color: '#2D2E39', bg: '#F2F2F2', days: 7 },
  mensal:  { label: 'Mensal',   color: GREEN, bg: '#F0FDF4', days: 30 },
}

function today() { return new Date().toISOString().split('T')[0] }

export default function Rotinas() {
  const { profile } = useData()
  const [routines, setRoutines] = useState([])
  const [completions, setCompletions] = useState([])
  const [projects, setProjects] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', frequency: 'semanal', assigned_to: '', project_id: '' })
  const [filterFreq, setFilterFreq] = useState('all')
  const [viewDashboard, setViewDashboard] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const [routR, compR, projR, profR] = await Promise.allSettled([
      supabase.from('routines').select('*').eq('org_id', profile.org_id).eq('is_active', true).order('title'),
      supabase.from('routine_completions').select('*').eq('org_id', profile.org_id).or(`reference_date.gte.${since},completed_at.gte.${new Date(Date.now() - 30 * 86400000).toISOString()}`),
      supabase.from('projects').select('id,name').eq('org_id', profile.org_id).order('name'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
    ])
    if (routR.status === 'fulfilled' && !routR.value.error) setRoutines(routR.value.data || [])
    if (compR.status === 'fulfilled' && !compR.value.error) setCompletions(compR.value.data || [])
    if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
    if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const todayStr = today()

  function isDoneToday(id) {
    return completions.some(c => {
      if (c.routine_id !== id) return false
      if (c.reference_date) return c.reference_date === todayStr
      // fallback: verificar completed_at se reference_date for null
      return c.completed_at && c.completed_at.startsWith(todayStr)
    })
  }
  function lastDone(id) {
    const done = completions.filter(c => c.routine_id === id)
    if (!done.length) return null
    // Usar reference_date se disponível, senão extrair data de completed_at
    done.sort((a, b) => {
      const da = a.reference_date || (a.completed_at ? a.completed_at.slice(0, 10) : '')
      const db = b.reference_date || (b.completed_at ? b.completed_at.slice(0, 10) : '')
      return db.localeCompare(da)
    })
    return done[0].reference_date || (done[0].completed_at ? done[0].completed_at.slice(0, 10) : null)
  }
  function isOverdue(r) {
    const last = lastDone(r.id)
    if (!last) return true
    const days = FREQ[r.frequency]?.days || 7
    return Math.floor((new Date(todayStr) - new Date(last)) / 86400000) >= days
  }

  async function toggle(r) {
    const done = isDoneToday(r.id)
    setSaving(r.id)
    if (done) {
      const comp = completions.find(c => c.routine_id === r.id && c.reference_date === todayStr)
      if (comp) await supabase.from('routine_completions').delete().eq('id', comp.id)
    } else {
      await supabase.from('routine_completions').insert({ routine_id: r.id, completed_by: profile.id, reference_date: todayStr, org_id: profile.org_id })
    }
    await load(); setSaving(null)
  }

  async function createRoutine() {
    if (!form.title.trim()) return
    await supabase.from('routines').insert({ org_id: profile.org_id, title: form.title, frequency: form.frequency, assigned_to: form.assigned_to || null, project_id: form.project_id || null, is_active: true })
    setShowForm(false); setForm({ title: '', frequency: 'semanal', assigned_to: '', project_id: '' }); await load()
  }

  async function archive(id) {
    await supabase.from('routines').update({ is_active: false }).eq('id', id); await load()
  }

  const filtered = filterFreq === 'all' ? routines : routines.filter(r => r.frequency === filterFreq)
  const doneToday = filtered.filter(r => isDoneToday(r.id)).length
  const overdue = filtered.filter(r => !isDoneToday(r.id) && isOverdue(r)).length
  const compliance = filtered.length > 0 ? Math.round(doneToday / filtered.length * 100) : 0
  const profMap = {}; profiles.forEach(p => { profMap[p.id] = p })
  const projMap = {}; projects.forEach(p => { projMap[p.id] = p })

  // Dashboard Rotinas (ativado pelo botão, fiel ao original)
  function DashboardRotinas() {
    const byFreq = {}
    routines.forEach(r => { byFreq[r.frequency] = (byFreq[r.frequency] || 0) + 1 })
    const byAssignee = {}
    routines.forEach(r => {
      if (r.assigned_to) { const n = profMap[r.assigned_to]?.full_name || '?'; byAssignee[n] = (byAssignee[n] || 0) + 1 }
    })
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">⏱️ Dashboard Rotinas</h2>
          <button onClick={() => setViewDashboard(false)} className="text-xs text-zinc-500 hover:text-zinc-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { l: 'Total Rotinas', v: routines.length, color: VL },
            { l: 'Diárias', v: byFreq.diaria || 0, color: AMBER },
            { l: 'Compliance hoje', v: `${compliance}%`, color: compliance >= 80 ? GREEN : compliance >= 50 ? AMBER : RED },
            { l: 'Em atraso', v: overdue, color: overdue > 0 ? RED : GREEN },
          ].map(k => (
            <div key={k.l} className="p-4 rounded-xl border border-zinc-100">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{k.l}</div>
              <div className="text-2xl font-bold" style={{ color: k.color }}>{k.v}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-bold text-zinc-600 mb-3 uppercase tracking-wider">Por Frequência</div>
            {Object.entries(byFreq).map(([freq, count]) => {
              const f = FREQ[freq] || { label: freq, color: '#9CA3AF', bg: '#F9FAFB' }
              return (
                <div key={freq} className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: f.bg, color: f.color }}>{f.label}</span>
                  <div className="flex-1 bg-zinc-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ width: `${count / routines.length * 100}%`, background: f.color }} /></div>
                  <span className="text-xs font-bold text-zinc-600">{count}</span>
                </div>
              )
            })}
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-600 mb-3 uppercase tracking-wider">Por Responsável</div>
            {Object.entries(byAssignee).slice(0, 5).map(([name, count]) => (
              <div key={name} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-zinc-600 w-24 truncate">{name.split(' ')[0]}</span>
                <div className="flex-1 bg-zinc-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ width: `${count / routines.length * 100}%`, background: VL }} /></div>
                <span className="text-xs font-bold text-zinc-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: '#2D2E39' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2"><RefreshCw className="w-3 h-3" /> Compliance Operacional</div>
            <h1 className="text-2xl font-bold mb-1">Rotinas</h1>
            <p className="text-sm text-zinc-400">{routines.length} rotina{routines.length !== 1 ? 's' : ''} ativas</p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-green-400">{compliance}%</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Compliance hoje</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-violet-300">{doneToday}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Concluídas</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-red-400">{overdue}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Em atraso</div>
            </div>
          </div>
        </div>
        <div className="mt-4 bg-white/10 rounded-full h-2">
          <div className="h-2 rounded-full transition-all" style={{ width: `${compliance}%`, background: VL }} />
        </div>
      </div>

      {viewDashboard && <DashboardRotinas />}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterFreq} onChange={e => setFilterFreq(e.target.value)}>
          <option value="all">Todas as frequências</option>
          {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setViewDashboard(v => !v)} className="text-sm font-semibold border border-zinc-200 rounded-lg px-4 py-2 bg-white hover:bg-zinc-50 transition-colors">
          ⏱️ Dashboard Rotinas
        </button>
        <button onClick={() => setShowForm(true)} className="ml-auto flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-colors" style={{ background: VL }}>
          <Plus className="w-4 h-4" /> Nova rotina
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-violet-200 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-800">Nova Rotina</h3>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Título *</label>
              <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Nome da rotina" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Frequência</label>
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.frequency} onChange={e => setForm(p => ({...p, frequency: e.target.value}))}>
                {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
            <button onClick={createRoutine} disabled={!form.title.trim()} className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors" style={{ background: VL }}>
              <Plus className="w-4 h-4" /> Criar
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-zinc-500 px-4 py-2">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-400">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <RefreshCw className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <div className="text-sm text-zinc-500">Nenhuma rotina encontrada</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const done = isDoneToday(r.id)
            const overdueFl = !done && isOverdue(r)
            const last = lastDone(r.id)
            const f = FREQ[r.frequency] || { label: r.frequency, color: '#9CA3AF', bg: '#F9FAFB' }
            const prof = profMap[r.assigned_to]
            const proj = projMap[r.project_id]
            return (
              <div key={r.id} className={`bg-white border rounded-xl px-5 py-4 flex items-center gap-4 transition-all ${done ? 'border-green-200 bg-green-50' : overdueFl ? 'border-red-200' : 'border-zinc-200'}`}>
                <button onClick={() => toggle(r)} disabled={saving === r.id}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${done ? 'text-white' : overdueFl ? 'border-red-400 hover:border-green-400' : 'border-zinc-300 hover:border-green-400'}`}
                  style={done ? { background: GREEN, borderColor: GREEN } : {}}>
                  {saving === r.id ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : done ? <Check className="w-4 h-4" /> : null}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${done ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>{r.title}</div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: f.bg, color: f.color }}>{f.label}</span>
                    {prof && <span className="text-xs text-zinc-500 flex items-center gap-1"><User className="w-3 h-3" />{prof.full_name.split(' ')[0]}</span>}
                    {proj && <span className="text-xs text-zinc-500">{proj.name}</span>}
                    {last && <span className="text-xs text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3" />Última: {new Date(last).toLocaleDateString('pt-BR')}</span>}
                    {overdueFl && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">Em atraso</span>}
                  </div>
                </div>
                <button onClick={() => archive(r.id)} className="text-zinc-300 hover:text-zinc-500 transition-colors shrink-0"><X className="w-4 h-4" /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
