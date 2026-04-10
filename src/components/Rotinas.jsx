import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, X, Check, Clock, Building2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from './Toast'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'

const VL    = '#5452C1'
const CH    = '#2D2E39'
const GREEN = '#10B981'
const AMBER = '#F59E0B'
const RED   = '#EF4444'

const FREQ = {
  diaria:  { label: 'Diária',  color: VL,    bg: '#EEF2FF', days: 1  },
  semanal: { label: 'Semanal', color: CH,     bg: '#F2F2F2', days: 7  },
  mensal:  { label: 'Mensal',  color: GREEN,  bg: '#F0FDF4', days: 30 },
}

function todayISO() { return new Date().toISOString().split('T')[0] }

function Avatar({ prof, size = 6 }) {
  if (!prof) return null
  const initials = prof.initials || prof.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: prof.avatar_color || VL, fontSize: size <= 6 ? 10 : 12 }}
      title={prof.full_name}
    >
      {initials}
    </div>
  )
}

function FreqBadge({ frequency }) {
  const f = FREQ[frequency] || { label: frequency, color: '#9CA3AF', bg: '#F9FAFB' }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: f.bg, color: f.color }}>
      {f.label}
    </span>
  )
}

function ProgressBar({ done, total }) {
  const pct = total > 0 ? Math.round(done / total * 100) : 0
  const color = pct === 100 ? GREEN : pct >= 60 ? AMBER : pct > 0 ? VL : '#E5E7EB'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
        {done}/{total}
      </span>
    </div>
  )
}

export default function Rotinas() {
  const { profile } = useData()
  usePageTitle('Rotinas')

  const [routines,    setRoutines]     = useState([])
  const [completions, setCompletions]  = useState([])
  const [projects,    setProjects]     = useState([])
  const [companies,   setCompanies]    = useState([])
  const [profiles,    setProfilesList] = useState([])
  const [loading,     setLoading]      = useState(true)
  const [saving,      setSaving]       = useState(null)
  const [showForm,    setShowForm]     = useState(false)
  const [collapsed,   setCollapsed]    = useState({})

  const [form, setForm] = useState({
    title: '', frequency: 'semanal', assigned_to: '',
    company_id: '', project_id: '', description: '',
  })

  const [filterFreq,    setFilterFreq]    = useState('all')
  const [filterProject, setFilterProject] = useState('all')
  const [search,        setSearch]        = useState('')

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const [routR, compR, projR, profR, coR] = await Promise.allSettled([
      supabase.from('routines').select('*').eq('org_id', profile.org_id).eq('is_active', true).order('title'),
      supabase.from('routine_completions').select('*').eq('org_id', profile.org_id)
        .or(`reference_date.gte.${since},completed_at.gte.${new Date(Date.now() - 30 * 86400000).toISOString()}`)
        .limit(500),
      supabase.from('projects').select('id,name,company_id,status').eq('org_id', profile.org_id).order('name'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('companies').select('id,name').eq('org_id', profile.org_id).order('name'),
    ])
    if (routR.status === 'fulfilled' && !routR.value.error) setRoutines(routR.value.data || [])
    if (compR.status === 'fulfilled' && !compR.value.error) setCompletions(compR.value.data || [])
    if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
    if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    if (coR.status  === 'fulfilled' && !coR.value.error)   setCompanies(coR.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const todayStr = todayISO()

  function isDoneToday(id) {
    return completions.some(c => {
      if (c.routine_id !== id) return false
      if (c.reference_date) return c.reference_date === todayStr
      return c.completed_at?.startsWith(todayStr)
    })
  }
  function lastDone(id) {
    const done = completions.filter(c => c.routine_id === id)
    if (!done.length) return null
    done.sort((a, b) => {
      const da = a.reference_date || a.completed_at?.slice(0, 10) || ''
      const db = b.reference_date || b.completed_at?.slice(0, 10) || ''
      return db.localeCompare(da)
    })
    return done[0].reference_date || done[0].completed_at?.slice(0, 10) || null
  }
  function isOverdue(r) {
    const last = lastDone(r.id)
    if (!last) return true
    const days = FREQ[r.frequency]?.days || 7
    return Math.floor((new Date(todayStr) - new Date(last)) / 86400000) >= days
  }

  const profMap = Object.fromEntries(profiles.map(p => [p.id, p]))
  const projMap = Object.fromEntries(projects.map(p => [p.id, p]))
  const compMap = Object.fromEntries(companies.map(c => [c.id, c]))

  async function toggle(r) {
    const done = isDoneToday(r.id)
    setSaving(r.id)
    try {
      if (done) {
        const comp = completions.find(c => c.routine_id === r.id && c.reference_date === todayStr)
        if (comp) {
          const { error } = await supabase.from('routine_completions')
            .delete().eq('id', comp.id).eq('org_id', profile.org_id)
          if (error) throw error
        }
      } else {
        const { error } = await supabase.from('routine_completions').insert({
          routine_id: r.id, completed_by: profile.id,
          reference_date: todayStr, org_id: profile.org_id,
        })
        if (error) throw error
        const freqLabel = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' }
        const { error: tErr } = await supabase.from('tasks').insert({
          org_id: profile.org_id,
          title: `[Rotina ${freqLabel[r.frequency] || r.frequency}] ${r.title}`,
          description: r.description || `Gerada automaticamente pela rotina "${r.title}"`,
          column_id: 'doing', priority: 'media',
          project_id: r.project_id || null,
          assigned_to: r.assigned_to || profile.id,
          due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          created_by: profile.id,
        })
        if (tErr) console.warn('Task automática não criada:', tErr.message)
        else toast.success('✅ Rotina registrada — task criada no Kanban')
      }
      await load()
    } catch (err) {
      toast.error('Erro ao registrar rotina: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  async function createRoutine() {
    if (!form.title.trim()) return
    const { error } = await supabase.from('routines').insert({
      org_id: profile.org_id, title: form.title.trim(),
      description: form.description.trim() || null,
      frequency: form.frequency,
      assigned_to: form.assigned_to || null,
      project_id: form.project_id || null,
      is_active: true,
    })
    if (error) { toast.error('Erro ao criar rotina: ' + error.message); return }
    setShowForm(false)
    setForm({ title: '', frequency: 'semanal', assigned_to: '', company_id: '', project_id: '', description: '' })
    await load()
    toast.success('Rotina criada')
  }

  async function archive(id) {
    const { error } = await supabase.from('routines')
      .update({ is_active: false }).eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao arquivar rotina: ' + error.message); return }
    await load()
  }

  const filtered = routines.filter(r => {
    const matchFreq    = filterFreq    === 'all' || r.frequency  === filterFreq
    const matchProject = filterProject === 'all' || r.project_id === filterProject ||
                         (filterProject === '__sem_projeto__' && !r.project_id)
    const matchSearch  = !search.trim() ||
      (r.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase())
    return matchFreq && matchProject && matchSearch
  })

  const doneToday  = filtered.filter(r =>  isDoneToday(r.id)).length
  const overdue    = filtered.filter(r => !isDoneToday(r.id) && isOverdue(r)).length
  const compliance = filtered.length > 0 ? Math.round(doneToday / filtered.length * 100) : 0

  // Agrupamento Empresa → Projeto
  const grouped = {}
  for (const r of filtered) {
    const proj      = projMap[r.project_id]
    const companyId = proj?.company_id || '__sem_empresa__'
    const projectId = r.project_id    || '__sem_projeto__'
    if (!grouped[companyId]) grouped[companyId] = {}
    if (!grouped[companyId][projectId]) grouped[companyId][projectId] = []
    grouped[companyId][projectId].push(r)
  }

  const companyKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '__sem_empresa__') return 1
    if (b === '__sem_empresa__') return -1
    return (compMap[a]?.name || '').localeCompare(compMap[b]?.name || '')
  })

  const projectsForForm = form.company_id
    ? projects.filter(p => p.company_id === form.company_id)
    : projects

  function toggleCollapse(id) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Card de rotina
  function RoutineCard({ r }) {
    const done      = isDoneToday(r.id)
    const overdueFl = !done && isOverdue(r)
    const last      = lastDone(r.id)
    const prof      = profMap[r.assigned_to]
    const leftColor = done ? GREEN : overdueFl ? RED : VL
    const borderColor = done ? '#BBF7D0' : overdueFl ? '#FECACA' : '#E5E7EB'
    const bgColor     = done ? '#F0FDF4' : overdueFl ? '#FFF5F5' : '#FFFFFF'

    return (
      <div className="rounded-xl flex items-stretch overflow-hidden transition-all duration-200"
        style={{ border: `1px solid ${borderColor}`, background: bgColor }}>
        <div className="w-1 shrink-0" style={{ background: leftColor }} />
        <div className="flex-1 flex items-center gap-4 px-4 py-3">
          <button
            onClick={() => toggle(r)} disabled={saving === r.id}
            title={done ? 'Desfazer' : 'Concluir'}
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all hover:scale-110"
            style={done
              ? { background: GREEN, borderColor: GREEN, color: '#fff' }
              : overdueFl
                ? { borderColor: RED, color: RED }
                : { borderColor: '#D1D5DB', color: '#9CA3AF' }
            }
          >
            {saving === r.id
              ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              : done ? <Check className="w-3.5 h-3.5" /> : null
            }
          </button>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold ${done ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
              {r.title}
            </div>
            {r.description && <div className="text-xs text-zinc-400 mt-0.5 truncate">{r.description}</div>}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <FreqBadge frequency={r.frequency} />
              {prof && (
                <div className="flex items-center gap-1">
                  <Avatar prof={prof} size={5} />
                  <span className="text-xs text-zinc-500">{prof.full_name.split(' ')[0]}</span>
                </div>
              )}
              {last && (
                <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(last + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              )}
              {overdueFl && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: RED }}>
                  Em atraso
                </span>
              )}
              {done && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: GREEN }}>
                  ✓ Hoje
                </span>
              )}
            </div>
          </div>
          <button onClick={() => archive(r.id)} title="Arquivar"
            className="text-zinc-300 hover:text-zinc-500 transition-colors shrink-0 p-1 rounded hover:bg-zinc-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: CH }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2" style={{ color: '#A5B4FC' }}>
              <RefreshCw className="w-3 h-3" /> Compliance Operacional
            </div>
            <h1 className="text-2xl font-bold mb-1">Rotinas</h1>
            <p className="text-sm text-zinc-400">{routines.length} rotina{routines.length !== 1 ? 's' : ''} ativas</p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            {[
              { label: 'Compliance hoje', value: `${compliance}%`, color: compliance >= 80 ? '#4ADE80' : compliance >= 50 ? AMBER : '#F87171' },
              { label: 'Concluídas',      value: doneToday,        color: '#A5B4FC' },
              { label: 'Em atraso',       value: overdue,          color: overdue > 0 ? '#F87171' : '#4ADE80' },
            ].map(k => (
              <div key={k.label} className="rounded-xl px-4 py-3 text-center min-w-[90px]"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-full h-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-2 rounded-full transition-all duration-700"
            style={{ width: `${compliance}%`, background: compliance >= 80 ? GREEN : compliance >= 50 ? AMBER : VL }} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input type="text" placeholder="Buscar rotina…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-violet-500 w-48" />
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white"
          value={filterFreq} onChange={e => setFilterFreq(e.target.value)}>
          <option value="all">Todas as frequências</option>
          {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white max-w-[280px]"
          value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="all">Todos os projetos</option>
          <option value="__sem_projeto__">Sem projeto</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setShowForm(v => !v)}
          className="ml-auto flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded-xl hover:opacity-90 transition-all"
          style={{ background: VL }}>
          <Plus className="w-4 h-4" /> Nova rotina
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white border-2 rounded-2xl p-5 mb-6 shadow-lg" style={{ borderColor: `${VL}50` }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-800">Nova Rotina</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Associe a uma empresa e projeto para organizar sua equipe</p>
            </div>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Título */}
            <div className="md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Título *</label>
              <input
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Envio de relatório semanal ao cliente" autoFocus />
            </div>

            {/* Empresa */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Empresa
              </label>
              <select
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 bg-white"
                value={form.company_id}
                onChange={e => setForm(p => ({ ...p, company_id: e.target.value, project_id: '' }))}>
                <option value="">— nenhuma —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Projeto */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">
                Projeto {form.company_id && projectsForForm.length > 0 && `(${projectsForForm.length})`}
              </label>
              <select
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 bg-white"
                value={form.project_id}
                onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}>
                <option value="">— sem projeto —</option>
                {projectsForForm.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Frequência */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Frequência</label>
              <div className="flex gap-2">
                {Object.entries(FREQ).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setForm(p => ({ ...p, frequency: k }))}
                    className="flex-1 py-2.5 text-xs font-bold rounded-xl border-2 transition-all"
                    style={form.frequency === k
                      ? { background: v.bg, color: v.color, borderColor: v.color }
                      : { background: '#F9FAFB', color: '#9CA3AF', borderColor: '#E5E7EB' }
                    }>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Responsável */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Responsável</label>
              <select
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 bg-white"
                value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                <option value="">— nenhum —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>

            {/* Descrição */}
            <div className="md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">
                Descrição <span className="font-normal text-zinc-400">(opcional)</span>
              </label>
              <textarea
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none"
                rows={2} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Instruções, contexto ou checklist da rotina…" />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)}
              className="text-sm text-zinc-500 px-4 py-2 rounded-xl hover:bg-zinc-100 transition-colors">
              Cancelar
            </button>
            <button onClick={createRoutine} disabled={!form.title.trim()}
              className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-40 transition-all"
              style={{ background: VL }}>
              <Plus className="w-4 h-4" /> Criar rotina
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="bg-white border border-zinc-100 rounded-2xl p-10 text-center text-sm text-zinc-400">
          <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-zinc-300" />Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-100 rounded-2xl p-14 text-center">
          <RefreshCw className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <div className="text-sm text-zinc-500 font-medium">Nenhuma rotina encontrada</div>
          <div className="text-xs text-zinc-400 mt-1">Ajuste os filtros ou crie uma nova rotina</div>
        </div>
      ) : (
        <div className="space-y-5">
          {companyKeys.map(companyId => {
            const company     = compMap[companyId]
            const isCollapsed = collapsed[companyId]
            const compRoutines = Object.values(grouped[companyId]).flat()
            const compDone    = compRoutines.filter(r => isDoneToday(r.id)).length
            const compName    = companyId === '__sem_empresa__' ? 'Sem empresa' : (company?.name || companyId)
            const projectKeys = Object.keys(grouped[companyId]).sort((a, b) => {
              if (a === '__sem_projeto__') return 1
              if (b === '__sem_projeto__') return -1
              return (projMap[a]?.name || '').localeCompare(projMap[b]?.name || '')
            })
            const isDark = companyId !== '__sem_empresa__'

            return (
              <div key={companyId} className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #E5E7EB' }}>

                {/* Header empresa */}
                <button
                  onClick={() => toggleCollapse(companyId)}
                  className="w-full flex items-center justify-between px-5 py-4 transition-colors"
                  style={{ background: isDark ? CH : '#FAFAFA' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: isDark ? VL : '#D1D5DB' }}>
                      {companyId === '__sem_empresa__' ? '?' : compName.split(' ').filter(w => w).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold" style={{ color: isDark ? '#FFFFFF' : '#374151' }}>
                        {compName}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF' }}>
                        {compRoutines.length} rotina{compRoutines.length !== 1 ? 's' : ''} · {projectKeys.length} projeto{projectKeys.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-28 hidden md:block">
                      <ProgressBar done={compDone} total={compRoutines.length} />
                    </div>
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }} />
                      : <ChevronDown  className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }} />
                    }
                  </div>
                </button>

                {/* Projetos */}
                {!isCollapsed && (
                  <div className="divide-y divide-zinc-100">
                    {projectKeys.map(projKey => {
                      const proj      = projMap[projKey]
                      const projName  = projKey === '__sem_projeto__' ? 'Sem projeto' : (proj?.name || projKey)
                      const projRouts = grouped[companyId][projKey]
                      const projDone  = projRouts.filter(r => isDoneToday(r.id)).length

                      return (
                        <div key={projKey}>
                          {/* Sub-header projeto */}
                          <div className="flex items-center justify-between px-5 py-2.5 bg-zinc-50">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full"
                                style={{ background: projKey === '__sem_projeto__' ? '#D1D5DB' : VL }} />
                              <span className="text-[11px] font-bold uppercase tracking-wider"
                                style={{ color: projKey === '__sem_projeto__' ? '#9CA3AF' : '#4B5563' }}>
                                {projName}
                              </span>
                              <span className="text-[10px] text-zinc-400">({projRouts.length})</span>
                            </div>
                            <div className="w-24">
                              <ProgressBar done={projDone} total={projRouts.length} />
                            </div>
                          </div>

                          {/* Cards */}
                          <div className="px-4 py-3 space-y-2">
                            {projRouts.map(r => <RoutineCard key={r.id} r={r} />)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
