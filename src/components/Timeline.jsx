import React, { useState, useEffect, useCallback } from 'react'
import { GitBranch, Building2, History, Layers, CheckSquare, Clock3, X } from 'lucide-react'
import { toast } from './Toast'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { NovoProjetoModal } from './CadastroModal'

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


// ─── Templates de projeto BX Finance ────────────────────────────────────────
const PROJECT_TEMPLATES = {
  'Diagnóstico': {
    label: 'Diagnóstico Financeiro',
    tasks: [
      { title: 'Coleta de documentos (BP, DRE, Balanço)', priority: 'high',   column_id: 'todo' },
      { title: 'Análise Horizontal e Vertical',           priority: 'high',   column_id: 'todo' },
      { title: 'Análise Fleuriet (NCG, CDG, ST)',         priority: 'high',   column_id: 'todo' },
      { title: 'Análise DuPont',                          priority: 'medium', column_id: 'todo' },
      { title: 'Indicadores de liquidez e rentabilidade', priority: 'medium', column_id: 'todo' },
      { title: 'Ciclos operacional e financeiro (PMR, PME, PMP)', priority: 'medium', column_id: 'todo' },
      { title: 'Análise de endividamento e DSCR',         priority: 'medium', column_id: 'todo' },
      { title: 'Elaboração do relatório final',           priority: 'high',   column_id: 'todo' },
      { title: 'Apresentação ao cliente',                 priority: 'medium', column_id: 'todo' },
    ]
  },
  'RJ': {
    label: 'Recuperação Judicial',
    tasks: [
      { title: 'Levantamento de passivos e credores',          priority: 'high',   column_id: 'todo' },
      { title: 'Análise de viabilidade econômica',             priority: 'high',   column_id: 'todo' },
      { title: 'Elaboração do plano de recuperação judicial',  priority: 'high',   column_id: 'todo' },
      { title: 'Submissão do PRJ ao administrador judicial',   priority: 'high',   column_id: 'todo' },
      { title: 'Acompanhamento da AGC',                        priority: 'high',   column_id: 'todo' },
      { title: 'Negociação com credores classe I, II, III, IV',priority: 'medium', column_id: 'todo' },
      { title: 'Monitoramento de compliance pós-aprovação',    priority: 'medium', column_id: 'todo' },
      { title: 'Relatórios mensais ao Juízo',                  priority: 'medium', column_id: 'todo' },
    ]
  },
  'Reestruturação': {
    label: 'Reestruturação de Passivo',
    tasks: [
      { title: 'Mapeamento da dívida bancária (Curva ABC)',  priority: 'high',   column_id: 'todo' },
      { title: 'Contato e negociação com bancos credores',   priority: 'high',   column_id: 'todo' },
      { title: 'Elaboração de proposta de renegociação',     priority: 'high',   column_id: 'todo' },
      { title: 'Análise de DSCR com novo perfil de dívida',  priority: 'medium', column_id: 'todo' },
      { title: 'Formalização de acordos e CCB',              priority: 'high',   column_id: 'todo' },
      { title: 'Monitoramento do cumprimento dos acordos',   priority: 'medium', column_id: 'todo' },
    ]
  },
  'M&A': {
    label: 'M&A / Assessoria',
    tasks: [
      { title: 'NDA e documentação inicial',               priority: 'high',   column_id: 'todo' },
      { title: 'Due diligence financeira',                  priority: 'high',   column_id: 'todo' },
      { title: 'Valuation da empresa-alvo',                 priority: 'high',   column_id: 'todo' },
      { title: 'Estruturação da oferta e term sheet',       priority: 'high',   column_id: 'todo' },
      { title: 'Negociação e fechamento',                   priority: 'medium', column_id: 'todo' },
      { title: 'Pós-fechamento e integração',               priority: 'medium', column_id: 'todo' },
    ]
  },
}


// Deterministic project color for Gantt bars
const GANTT_COLORS = ['#F59E0B','#EF4444','#6366F1','#10B981','#EC4899','#8B5CF6','#3B82F6','#14B8A6','#F97316','#06B6D4']
function ganttColor(id) {
  if (!id) return '#5452C1'
  let h = 0
  for (const c of String(id)) h = (h << 5) - h + c.charCodeAt(0)
  return GANTT_COLORS[Math.abs(h) % GANTT_COLORS.length]
}

export default function Timeline() {
  const { profile } = useData()
  usePageTitle('Projetos')

  function openEdit(p) {
    setEditingProject(p)
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

  async function loadProjectLog(projId) {
    setLoadingLog(true)
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('id,actor_id,action,metadata,created_at,module,entity_type')
        .eq('org_id', profile.org_id)
        .eq('project_id', projId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setProjectLog(data || [])
    } catch (err) {
      toast.error('Erro ao carregar histórico')
    } finally {
      setLoadingLog(false)
    }
  }

  async function applyTemplate(projId, type) {
    const tmpl = PROJECT_TEMPLATES[type]
    if (!tmpl || !projId) return
    try {
      const inserts = tmpl.tasks.map(t => ({
        org_id:     profile.org_id,
        project_id: projId,
        title:      t.title,
        priority:   t.priority,
        column_id:  t.column_id,
        created_by: profile.id,
      }))
      const { error } = await supabase.from('tasks').insert(inserts)
      if (error) throw error
      toast.success(`${tmpl.tasks.length} tarefas criadas a partir do template "${tmpl.label}"`)
    } catch (err) {
      toast.error('Erro ao aplicar template: ' + err.message)
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
    const { data, error } = await supabase.from('projects').insert({
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
    }).select('id')
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
  const [histProject,    setHistProject]    = useState(null)
  const [projectLog,     setProjectLog]     = useState([])
  const [loadingLog,     setLoadingLog]     = useState(false)
  const [editingProject,  setEditingProject]  = useState(null)   // projeto sendo editado
  const [editForm,        setEditForm]        = useState({})
  const [newProj, setNewProj] = useState({ name:'', type:'Diagnóstico', status:'Planejamento', company_id:'', analyst_id:'', associate_id:'', executive_id:'', deadline:'', priority:'medium', budget:'', observacoes:'', historico:'' })
  const [savingProj, setSavingProj] = useState(false)

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    setLoading(true)
    try {
      const [projR, compR, profR, taskR] = await Promise.allSettled([
        supabase.from('projects').select('*').eq('org_id', profile.org_id).order('deadline', { ascending: true, nullsFirst: false }),
        supabase.from('companies').select('id,name,color').eq('org_id', profile.org_id),
        supabase.from('profiles').select('id,full_name,initials').eq('org_id', profile.org_id).order('full_name'),
        supabase.from('tasks').select('id,column_id,project_id,due_date,created_at').eq('org_id', profile.org_id).is('deleted_at', null),
      ])
      if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
      if (compR.status === 'fulfilled' && !compR.value.error) setCompanies(compR.value.data || [])
      if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
      if (taskR.status === 'fulfilled' && !taskR.value.error) setTasks(taskR.value.data || [])
    } catch (err) { console.error('[Timeline] load:', err.message) }
    finally { setLoading(false) }
  }, [profile])

  useEscapeKey(() => { setShowNewProject(false); setEditingProject(null) }, showNewProject || !!editingProject)
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

  // Gantt date range — baseado nas TAREFAS do Kanban, nao no prazo do projeto
  const now = new Date()

  function getProjectTaskRange(projectId) {
    const projTasks = tasks.filter(t => t.project_id === projectId)
    if (!projTasks.length) return null
    const starts = projTasks.map(t => t.created_at ? new Date(t.created_at) : null).filter(Boolean)
    const ends   = projTasks.map(t => t.due_date    ? new Date(t.due_date)   : null).filter(Boolean)
    const start  = starts.length ? new Date(Math.min(...starts)) : null
    const end    = ends.length   ? new Date(Math.max(...ends))   : null
    return { start, end }
  }

  const allTaskStarts = filtered.flatMap(p => {
    const r = getProjectTaskRange(p.id)
    return r && r.start ? [r.start] : [p.created_at ? new Date(p.created_at) : now]
  })
  const allTaskEnds = filtered.flatMap(p => {
    const r = getProjectTaskRange(p.id)
    return r && r.end ? [r.end] : [new Date(now.getTime() + 30 * 86400000)]
  })
  const earliestStart = allTaskStarts.length ? new Date(Math.min(...allTaskStarts)) : now
  const latestEnd     = allTaskEnds.length   ? new Date(Math.max(...allTaskEnds))   : new Date(now.getTime() + 90 * 86400000)

  const minDate   = new Date(earliestStart.getFullYear(), earliestStart.getMonth() - 1, 1)
  const maxDate   = new Date(latestEnd.getFullYear(),     latestEnd.getMonth()   + 2, 1)
  const totalDays = Math.max(30, Math.ceil((maxDate - minDate) / 86400000))

  const months = []
  const mdd = new Date(minDate)
  while (mdd < maxDate) {
    months.push({ label: mdd.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(), pct: Math.round((mdd - minDate) / 86400000 / totalDays * 100) })
    mdd.setMonth(mdd.getMonth() + 1)
  }

  function ganttBar(project) {
    const range = getProjectTaskRange(project.id)
    const start = (range && range.start) || (project.created_at ? new Date(project.created_at) : now)
    const end   = (range && range.end)   || new Date(start.getTime() + 60 * 86400000)
    const left  = Math.max(0, Math.min(98, Math.round((start - minDate) / 86400000 / totalDays * 100)))
    const right = Math.min(100, Math.round((end - minDate) / 86400000 / totalDays * 100))
    const width = Math.max(2, right - left)
    return { left, width, hasTaskDates: !!(range && (range.start || range.end)) }
  }
  const statuses = [...new Set(projects.map(p => p.status).filter(Boolean))]

  return (
    <>
    {/* Painel de Histórico do Projeto */}
    {histProject && (
      <div className="fixed inset-0 z-50 flex items-start justify-end p-4"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={e => e.target === e.currentTarget && setHistProject(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-full max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" /> Histórico do Projeto
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[250px]">{histProject.name}</p>
            </div>
            <button onClick={() => setHistProject(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loadingLog ? (
              <div className="text-center text-xs text-zinc-400 py-8">Carregando…</div>
            ) : projectLog.length === 0 ? (
              <div className="text-center text-xs text-zinc-400 py-8">
                <Clock3 className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                Nenhuma atividade registrada ainda
              </div>
            ) : (
              <div className="space-y-3">
                {projectLog.map((ev, i) => {
                  const actor = profMap[ev.actor_id]
                  const initials = actor?.initials || actor?.full_name?.slice(0,2) || '?'
                  const title = ev.metadata?.title || ev.entity_id || ev.entity_type
                  const actionLabels = {
                    created:'criou', updated:'atualizou', completed:'concluiu',
                    moved:'moveu', deleted:'removeu', archived:'arquivou',
                    stage_changed:'mudou estágio', published:'publicou',
                  }
                  const actionLabel = actionLabels[ev.action] || ev.action
                  return (
                    <div key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ background: actor?.avatar_color || '#5452C1' }}>
                          {initials}
                        </div>
                        {i < projectLog.length - 1 && <div className="w-px flex-1 bg-zinc-100 mt-1 mb-0" style={{ minHeight: 12 }} />}
                      </div>
                      <div className="pb-3 flex-1 min-w-0">
                        <div className="text-xs text-zinc-700">
                          <span className="font-semibold">{actor?.full_name?.split(' ')[0] || 'Sistema'}</span>
                          {' '}{actionLabel}
                          {title && <span className="text-zinc-500"> "{title.slice(0,40)}"</span>}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {new Date(ev.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                          {ev.module && <span className="ml-1 capitalize">· {ev.module}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
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
                <div key={p.id} className="px-4 py-2.5 border-b border-zinc-100 h-14 flex flex-col justify-center">
                  <div className="flex items-center gap-1 group">
                    <div className="text-xs font-bold text-zinc-800 truncate flex-1">{p.name}</div>
                    <button onClick={e => { e.stopPropagation(); setHistProject(p); loadProjectLog(p.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-amber-500 shrink-0 mr-0.5"
                      title="Histórico">
                      <History className="w-3 h-3" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); openEdit(p) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-violet-600 shrink-0"
                      title="Editar projeto">
                      ✏️
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {compMap[p.company_id] && <span className="text-[10px] text-zinc-400 truncate max-w-[120px]">{compMap[p.company_id].name}</span>}
                    {p.associate_id && profMap[p.associate_id] && <span className="text-[9px] font-semibold text-violet-500 shrink-0">{profMap[p.associate_id].full_name?.split(' ')[0]}</span>}
                  </div>
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
                  <div key={p.id} className="relative h-14 border-b border-zinc-100 flex items-center">
                    {months.map((m, i) => <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-100" style={{ left: `${m.pct}%` }} />)}
                    <div className="absolute top-0 bottom-0 border-l border-violet-300 border-dashed z-10" style={{ left: `${Math.round((now - minDate) / 86400000 / totalDays * 100)}%` }} />
                    <div className="absolute h-8 rounded-lg overflow-hidden z-20"
                      style={{ left: `${left}%`, width: `${Math.max(width, 3)}%`, minWidth: 48 }}
                      title={(() => {
                        const range = getProjectTaskRange(p.id)
                        const projTasks = tasks.filter(t => t.project_id === p.id)
                        const done = projTasks.filter(t => t.column_id === 'done').length
                        if (range && (range.start || range.end)) {
                          const s = range.start ? range.start.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit'}) : '?'
                          const e = range.end   ? range.end.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit'})   : '?'
                          return `${p.name} · ${done}/${projTasks.length} tarefas · ${s} → ${e}`
                        }
                        return `${p.name} · Sem tarefas com prazo definido`
                      })()}
                    >
                      <div className="absolute inset-0 rounded-lg" style={{ background: ganttColor(p.id), opacity: .88 }} />
                      <div className="absolute inset-y-0 left-0 rounded-lg transition-all" style={{ width: `${taskPct >= 0 ? taskPct : 0}%`, background: 'rgba(255,255,255,.28)' }} />
                      <div className="absolute inset-0 flex items-center px-2 gap-1.5">
                        <span className="text-white text-[10px] font-bold drop-shadow-sm shrink-0">{taskPct >= 0 ? taskPct + '%' : '—'}</span>
                        <span className="text-white/80 text-[9px] truncate">{p.name}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Progresso de Tarefas (substituindo Prazo) */}
            <div className="w-28 shrink-0 border-l border-zinc-200">
              <div className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: CH }}>Tarefas</div>
              {filtered.map(p => {
                const projTasks = tasks.filter(t => t.project_id === p.id)
                const done  = projTasks.filter(t => t.column_id === 'done').length
                const total = projTasks.length
                const pct   = total > 0 ? Math.round(done / total * 100) : null
                const color = pct === null ? '#9CA3AF' : pct === 100 ? GREEN : pct >= 50 ? AMBER : RED
                return (
                  <div key={p.id} className="px-3 border-b border-zinc-100 h-14 flex flex-col justify-center">
                    {total > 0 ? (
                      <>
                        <div className="text-xs font-bold" style={{ color }}>{pct}%</div>
                        <div className="text-[10px] text-zinc-400">{done}/{total} feitas</div>
                        <div className="mt-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </>
                    ) : <span className="text-[10px] text-zinc-400">Sem tasks</span>}
                  </div>
                )
              })}
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
    {/* ── NovoProjetoModal para EDIÇÃO (formulário completo com IA) ── */}
    {editingProject && (
      <NovoProjetoModal
        initialData={editingProject}
        companies={companies}
        profiles={profiles}
        onClose={() => setEditingProject(null)}
        onSave={async (updatedProj) => {
          setEditingProject(null)
          await load()
        }}
      />
    )}

    {/* ── Modal Novo Projeto (criar) ── */}
    {showNewProject && (
      <NovoProjetoModal
        companies={companies}
        profiles={profiles}
        onClose={() => setShowNewProject(false)}
        onSave={async (newProj) => {
          setShowNewProject(false)
          await load()
        }}
      />
    )}
    </div>
    </>
  )
}