import React, { useState, useEffect, useCallback } from 'react'
import { GitBranch, Building2 } from 'lucide-react'
import { toast } from './Toast'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'

const CH = '#2D2E39', VL = '#5452C1'
const GREEN = '#10B981', AMBER = '#F59E0B', RED = '#EF4444', BLUE = '#3B82F6'

function normStatus(s) {
  const m = {
    'active': { label: 'Ativo', color: GREEN }, 'Em andamento': { label: 'Em andamento', color: BLUE },
    'Planejamento': { label: 'Planejamento', color: AMBER }, 'concluido': { label: 'Concluído', color: '#9CA3AF' },
    'pausado': { label: 'Pausado', color: RED },
  }
  return m[s] || { label: s || 'N/D', color: '#9CA3AF' }
}

function pct(n) { return Math.min(100, Math.max(0, parseInt(n, 10) || 0)) }

function daysUntil(d) {
  if (!d) return null
  return Math.ceil((new Date(d) - new Date()) / 86400000)
}

function daysLabel(d) {
  const n = daysUntil(d)
  if (n === null) return ''
  if (n < 0) return `${Math.abs(n)}d atraso`
  if (n === 0) return 'Hoje'
  return `${n}d restantes`
}

function daysColor(d) {
  const n = daysUntil(d)
  if (n === null) return 'text-zinc-400'
  if (n < 0) return 'text-red-600'
  if (n <= 7) return 'text-amber-600'
  return 'text-green-600'
}

export default function Timeline() {
  const { profile } = useData()
  usePageTitle('Projetos')
  useEscapeKey(() => { setShowNewProject(false); setEditingProject(null) }, showNewProject || !!editingProject)

  async function openEdit(p) {
    setEditingProject(p)
    setEditForm({
      name:          p.name || '',
      type:          p.type || 'Diagnóstico',
      status:        p.status || 'Planejamento',
      company_id:    p.company_id || '',
      analyst_id:    p.analyst_id || '',
      associate_id:  p.associate_id || '',
      executive_id:  p.executive_id || '',
      deadline:      p.deadline ? p.deadline.slice(0, 10) : '',
      priority:      p.priority || 'medium',
      progress:      p.progress ?? 0,
      budget:        p.budget || '',
      observacoes:   p.observacoes || '',
      historico:     p.historico || '',
    })
  }

  async function deleteProject(projId) {
    if (!await confirm('Excluir este projeto? Todas as tarefas associadas permanecerão mas perderão o vínculo com o projeto.', {
      danger: true, confirmLabel: 'Excluir', cancelLabel: 'Cancelar'
    })) return
    try {
      const { error } = await supabase.from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', projId).eq('org_id', profile.org_id)
      if (error) throw error
      await load()
      toast.success('Projeto excluído')
    } catch (err) {
      toast.error('Erro ao excluir: ' + err.message)
    }
  }

  async function updateProject() {
    if (!editForm.name?.trim()) { toast.warning('Nome obrigatório'); return }
    setSavingProj(true)
    const { error } = await supabase.from('projects').update({
      name:          editForm.name.trim(),
      type:          editForm.type,
      status:        editForm.status,
      company_id:    editForm.company_id || null,
      analyst_id:    editForm.analyst_id || null,
      associate_id:  editForm.associate_id || null,
      executive_id:  editForm.executive_id || null,
      deadline:      editForm.deadline || null,
      priority:      editForm.priority,
      progress:      parseInt(editForm.progress) || 0,
      budget:        parseFloat(editForm.budget) || null,
      observacoes:   editForm.observacoes?.trim() || null,
      historico:     editForm.historico?.trim() || null,
    }).eq('id', editingProject.id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao atualizar: ' + error.message); setSavingProj(false); return }
    setEditingProject(null)
    await load()
    toast.success('Projeto atualizado')
    setSavingProj(false)
  }

  async function createProject() {
    if (!newProj.name.trim()) { toast.warning('Preencha o nome do projeto'); return }
    setSavingProj(true)
    const { error } = await supabase.from('projects').insert({
      org_id: profile.org_id,
      name:         newProj.name.trim(),
      type:         newProj.type,
      status:       newProj.status,
      company_id:   newProj.company_id   || null,
      analyst_id:   newProj.analyst_id   || null,
      associate_id: newProj.associate_id || null,
      executive_id: newProj.executive_id || null,
      deadline:     newProj.deadline     || null,
      priority:     newProj.priority,
      progress:     0,
      budget:       parseFloat(newProj.budget) || null,
      observacoes:  newProj.observacoes?.trim() || null,
      historico:    newProj.historico?.trim()   || null,
    })
    if (error) { toast.error('Erro ao criar projeto: ' + error.message); setSavingProj(false); return }
    setShowNewProject(false)
    setNewProj({ name:'', type:'Diagnóstico', status:'Planejamento', company_id:'', analyst_id:'', associate_id:'', executive_id:'', deadline:'', priority:'medium', budget:'', observacoes:'', historico:'' })
    await load()
    logActivity(supabase, { org_id: profile.org_id, actor_id: profile.id, entity_type: 'project', entity_id: newProj.name, action: 'created', module: 'timeline', metadata: { name: newProj.name, type: newProj.type } })
    toast.success('Projeto criado')
    setSavingProj(false)
  }
  const [projects, setProjects] = useState([])
  const [companies, setCompanies] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [view, setView] = useState('gantt')
  const [showNewProject,  setShowNewProject]  = useState(false)
  const [editingProject,  setEditingProject]  = useState(null)   // projeto sendo editado
  const [editForm,        setEditForm]        = useState({})
  const [newProj, setNewProj] = useState({ name:'', type:'Diagnóstico', status:'Planejamento', company_id:'', analyst_id:'', associate_id:'', executive_id:'', deadline:'', priority:'medium', budget:'', observacoes:'', historico:'' })
  const [savingProj, setSavingProj] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [projR, compR, profR, taskR] = await Promise.allSettled([
      supabase.from('projects').select('*').eq('org_id', profile.org_id).order('deadline', { ascending: true, nullsFirst: false }),
      supabase.from('companies').select('id,name,color').eq('org_id', profile.org_id),
      supabase.from('profiles').select('id,full_name,initials').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('tasks').select('id,column_id,project_id,due_date').eq('org_id', profile.org_id).is('deleted_at', null),
    ])
    if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
    if (compR.status === 'fulfilled' && !compR.value.error) setCompanies(compR.value.data || [])
    if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    if (taskR.status === 'fulfilled' && !taskR.value.error) setTasks(taskR.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const compMap = {}; companies.forEach(c => { compMap[c.id] = c })
  const profMap = {}; profiles.forEach(p => { profMap[p.id] = p })

  const filtered = projects.filter(p => {
    const matchStatus = filterStatus === 'all' ||
      p.status === filterStatus ||
      // B-111: backward compat — 'active' = 'Em andamento'
      (filterStatus === 'Em andamento' && p.status === 'active') ||
      (filterStatus === 'active'       && p.status === 'Em andamento')
    const matchComp = filterCompany === 'all' || p.company_id === filterCompany
    return matchStatus && matchComp
  })

  // Gantt date range
  const now = new Date()
  const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 5, 1)
  const totalDays = Math.ceil((maxDate - minDate) / 86400000)

  const months = []
  const md = new Date(minDate)
  while (md < maxDate) {
    months.push({ label: md.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), pct: Math.round((md - minDate) / 86400000 / totalDays * 100) })
    md.setMonth(md.getMonth() + 1)
  }

  function ganttBar(project) {
    const deadline = project.deadline ? new Date(project.deadline) : null
    const start = deadline ? new Date(deadline.getTime() - 90 * 86400000) : new Date()
    const end = deadline || new Date(start.getTime() + 90 * 86400000)
    const left = Math.max(0, Math.round((start - minDate) / 86400000 / totalDays * 100))
    const width = Math.max(2, Math.min(100 - left, Math.round((end - start) / 86400000 / totalDays * 100)))
    return { left, width }
  }

  const statuses = [...new Set(projects.map(p => p.status).filter(Boolean))]

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: CH }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2"><GitBranch className="w-3 h-3" /> Gestão de Projetos</div>
            <h1 className="text-2xl font-bold mb-1">Timeline</h1>
            <p className="text-sm text-zinc-400">{projects.length} projeto{projects.length !== 1 ? 's' : ''} · visão temporal</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[['active','Em andamento'],['Planejamento','Planejamento'],['concluido','Concluído']].map(([key,label]) => (
              <div key={key} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[70px]">
                <div className="text-lg font-bold text-violet-300">{projects.filter(p => p.status === key || p.status === label).length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{label}</div>
              </div>
            ))}
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[70px]">
              <div className="text-lg font-bold text-red-400">{projects.filter(p => daysUntil(p.deadline) !== null && daysUntil(p.deadline) < 0).length}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Atrasados</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {[['gantt','Gantt'],['list','Lista']].map(([id,label]) => (
            <button key={id} onClick={() => setView(id)} className={`px-4 py-2 text-sm font-semibold transition-colors ${view === id ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>{label}</button>
          ))}
        </div>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todos os status</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="all">Todas as empresas</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(filterStatus !== 'all' || filterCompany !== 'all') && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterCompany('all') }}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 border border-rose-200 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 transition-all"
          >
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>

      {loading ? <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-400">Carregando…</div>
       : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <GitBranch className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <div className="text-sm text-zinc-500">Nenhum projeto encontrado</div>
        </div>
      ) : view === 'gantt' ? (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="flex">
            {/* Project names */}
            <div className="w-64 shrink-0 border-r border-zinc-200">
              <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: CH }}>Projeto</div>
              {filtered.map(p => (
                <div key={p.id} className="px-4 py-3 border-b border-zinc-100 h-14 flex flex-col justify-center">
                  <div className="flex items-center gap-1 group">
                    <div className="text-xs font-bold text-zinc-800 truncate flex-1">{p.name}</div>
                    <button onClick={e => { e.stopPropagation(); openEdit(p) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-violet-600 shrink-0"
                      title="Editar projeto">
                      ✏️
                    </button>
                  </div>
                  {compMap[p.company_id] && <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5"><Building2 className="w-2.5 h-2.5" />{compMap[p.company_id].name}</div>}
                </div>
              ))}
            </div>
            {/* Gantt bars */}
            <div className="flex-1 overflow-x-auto">
              <div className="relative h-9 border-b border-zinc-200 bg-zinc-50">
                {months.map((m, i) => (
                  <div key={i} className="absolute top-0 bottom-0 flex items-center" style={{ left: `${m.pct}%` }}>
                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider pl-2">{m.label}</div>
                    <div className="absolute left-0 top-0 bottom-0 border-l border-zinc-200" />
                  </div>
                ))}
                <div className="absolute top-0 bottom-0 border-l-2 border-violet-500 z-10" style={{ left: `${Math.round((now - minDate) / 86400000 / totalDays * 100)}%` }}>
                  <div className="absolute -top-0 -left-5 text-[9px] font-bold text-violet-600 bg-violet-100 px-1 rounded">Hoje</div>
                </div>
              </div>
              {filtered.map(p => {
                const { left, width } = ganttBar(p)
                const st = normStatus(p.status)
                const progress = pct(p.progress)
                const projTasks = tasks.filter(t => t.project_id === p.id)
                const doneTasks = projTasks.filter(t => t.column_id === 'done').length
                const taskPct = projTasks.length > 0 ? Math.round(doneTasks / projTasks.length * 100) : (progress > 0 ? progress : -1)
                return (
                  <div key={p.id} className="relative h-14 border-b border-zinc-100 flex items-center px-2">
                    {months.map((m, i) => <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-100" style={{ left: `${m.pct}%` }} />)}
                    <div className="absolute top-0 bottom-0 border-l border-violet-300 border-dashed z-10" style={{ left: `${Math.round((now - minDate) / 86400000 / totalDays * 100)}%` }} />
                    <div className="absolute h-7 rounded-lg overflow-hidden z-20 min-w-[60px]" style={{ left: `${left}%`, width: `${width}%` }}>
                      <div className="absolute inset-0 rounded-lg opacity-90" style={{ background: CH }} />
                      <div className="absolute inset-y-0 left-0 rounded-lg opacity-60" style={{ width: `${taskPct}%`, background: st.color }} />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-white text-[10px] font-bold">{taskPct}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Deadline */}
            <div className="w-28 shrink-0 border-l border-zinc-200">
              <div className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: CH }}>Prazo</div>
              {filtered.map(p => (
                <div key={p.id} className="px-3 py-3 border-b border-zinc-100 h-14 flex flex-col justify-center">
                  {p.deadline ? (
                    <>
                      <div className="text-xs font-semibold text-zinc-700">{new Date(p.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
                      <div className={`text-[10px] font-semibold ${daysColor(p.deadline)}`}>{daysLabel(p.deadline)}</div>
                    </>
                  ) : <span className="text-[10px] text-zinc-400">—</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-white" style={{ background: CH }}>
              <th className="text-left px-5 py-3 font-bold">Projeto</th>
              <th className="text-left px-4 py-3 font-bold">Empresa</th>
              <th className="text-left px-4 py-3 font-bold">Analista</th>
              <th className="text-left px-4 py-3 font-bold">Sócio</th>
              <th className="text-left px-4 py-3 font-bold">Status</th>
              <th className="text-left px-4 py-3 font-bold w-40">Progresso</th>
              <th className="text-left px-4 py-3 font-bold">Prazo</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(p => {
                const st = normStatus(p.status)
                const projTasks = tasks.filter(t => t.project_id === p.id)
                const doneTasks = projTasks.filter(t => t.column_id === 'done').length
                const progress = projTasks.length > 0 ? Math.round(doneTasks / projTasks.length * 100) : pct(p.progress)
                const hasNoTasks = projTasks.length === 0
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-zinc-800">
                      <div className="flex items-center gap-2 group">
                        <span>{p.name}</span>
                        <button onClick={e => { e.stopPropagation(); openEdit(p) }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-violet-600 p-0.5 rounded">
                          ✏️
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{compMap[p.company_id]?.name || '—'}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{profMap[p.analyst_id]?.full_name || '—'}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{profMap[p.associate_id]?.full_name?.split(' ')[0] || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${st.color}18`, color: st.color }}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {hasNoTasks ? (
                        <span className="text-[10px] text-zinc-400 italic">Sem tarefas</span>
                      ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-zinc-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${progress}%`, background: st.color }} />
                        </div>
                        <span className="text-xs text-zinc-500 w-8 text-right">{progress}%</span>
                      </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.deadline ? (
                        <div>
                          <div className="text-xs font-semibold text-zinc-700">{new Date(p.deadline).toLocaleDateString('pt-BR')}</div>
                          <div className={`text-[10px] font-semibold ${daysColor(p.deadline)}`}>{daysLabel(p.deadline)}</div>
                        </div>
                      ) : <span className="text-xs text-zinc-400">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    {/* ── Modal Criar / Editar Projeto (unificado) ── */}
    {(showNewProject || editingProject) && (() => {
      const isEdit  = !!editingProject
      const form    = isEdit ? editForm    : newProj
      const setForm = isEdit ? setEditForm : setNewProj
      const onSave  = isEdit ? updateProject : createProject
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => e.target === e.currentTarget && (isEdit ? setEditingProject(null) : setShowNewProject(false))}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-zinc-800">
                {isEdit ? 'Editar Projeto' : 'Novo Projeto'}
              </h3>
              <button onClick={() => isEdit ? setEditingProject(null) : setShowNewProject(false)}
                className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nome *</label>
                <input autoFocus className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={form.name || ''} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  placeholder="Ex: Diagnóstico Financeiro — Empresa X..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tipo</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={form.type || 'Diagnóstico'} onChange={e => setForm(p => ({...p, type: e.target.value}))}>
                    <option>Diagnóstico</option><option>RJ</option><option>M&A</option>
                    <option>Reestruturação</option><option>Assessoria</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Status</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={form.status || 'Planejamento'} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                    <option>Planejamento</option>
                    <option value="Em andamento">Em andamento</option>
                    <option>Concluído</option><option>Pausado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Empresa</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={form.company_id || ''} onChange={e => setForm(p => ({...p, company_id: e.target.value}))}>
                    <option value="">— nenhuma —</option>
                    {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Analista</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={form.analyst_id || ''} onChange={e => setForm(p => ({...p, analyst_id: e.target.value}))}>
                    <option value="">— nenhum —</option>
                    {profilesList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Prazo</label>
                <input type="date" className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={form.deadline || ''} onChange={e => setForm(p => ({...p, deadline: e.target.value}))} />
              </div>

              {/* Sócio Responsável + Executivo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Sócio Responsável</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={form.associate_id || ''} onChange={e => setForm(p => ({...p, associate_id: e.target.value}))}>
                    <option value="">— nenhum —</option>
                    {profilesList.filter(p => ['owner','gerente','Gerente'].includes(p.role)).map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Executivo</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={form.executive_id || ''} onChange={e => setForm(p => ({...p, executive_id: e.target.value}))}>
                    <option value="">— nenhum —</option>
                    {profilesList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Orçamento */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Orçamento (R$)</label>
                <input type="number" min="0" step="1000" className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Ex: 50000"
                  value={form.budget || ''} onChange={e => setForm(p => ({...p, budget: e.target.value}))} />
              </div>

              {/* Observações */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Observações</label>
                <textarea rows={2} className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="Contexto, condições especiais, riscos..."
                  value={form.observacoes || ''} onChange={e => setForm(p => ({...p, observacoes: e.target.value}))} />
              </div>

              {/* Histórico */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Histórico / Timeline de eventos</label>
                <textarea rows={3} className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="Registro cronológico de eventos, decisões, marcos do projeto..."
                  value={form.historico || ''} onChange={e => setForm(p => ({...p, historico: e.target.value}))} />
              </div>

              {isEdit && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">
                    Progresso manual — {form.progress ?? 0}%
                  </label>
                  <input type="range" min="0" max="100" step="5"
                    className="w-full accent-violet-600"
                    value={form.progress ?? 0}
                    onChange={e => setForm(p => ({...p, progress: parseInt(e.target.value)}))} />
                  <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Sobrescrito automaticamente pelo % de tarefas concluídas se houver tasks no projeto.
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={onSave}
                  disabled={savingProj || !(isEdit ? form.name?.trim() : form.name.trim())}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#5452C1' }}>
                  {savingProj ? (isEdit ? 'Salvando…' : 'Criando…') : (isEdit ? 'Salvar Alterações' : 'Criar Projeto')}
                </button>
                <button
                  onClick={() => isEdit ? setEditingProject(null) : setShowNewProject(false)}
                  className="px-4 text-sm text-zinc-500 hover:text-zinc-700">
                  Cancelar
                </button>
                {isEdit && (
                  <button onClick={() => { deleteProject(editingProject.id); setEditingProject(null) }}
                    className="px-4 text-sm font-semibold text-red-500 hover:text-red-700 ml-auto">
                    Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    })()}
    </div>
  )
}
