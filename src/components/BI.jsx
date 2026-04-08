// src/components/BI.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import {
  BarChart3,
  ExternalLink,
  Search,
  Building2,
  TrendingUp,
  Briefcase,
  Target,
  CheckCircle,
  AlertTriangle,
  Activity,
  DollarSign,
  RefreshCw,
  AlertCircle,
  PieChart,
  Layers,
} from 'lucide-react'

// ============================================================================
// BI.jsx v2 — Business Intelligence
// ----------------------------------------------------------------------------
// PRESERVA o /bi atual (master/detail PowerBI embed) e ADICIONA aba nova
// "Dashboard Interno" com KPIs em tempo real do proprio Supabase.
//
// Tabelas Supabase reais (validadas):
//   companies (4): id, name, powerbi_link, criticality, status
//   proposals (1): id, status, value, service_type
//   pipeline_items (3): id, name, stage, value, probability, expected_close
//   projects (6): id, name, status, progress, priority, deadline
//   tasks (8): id, column_id, priority, assigned_to
//   profiles (10): id, full_name
//   activity_log (33): created_at, action, actor_id
// ============================================================================

const TABS = [
  { id: 'powerbi',  label: 'PowerBI',           icon: BarChart3 },
  { id: 'internal', label: 'Dashboard Interno', icon: Activity },
]

export default function BI() {
  const { profile } = useData()
  const [activeTab, setActiveTab] = useState('powerbi')
  const [companies, setCompanies] = useState([])
  const [proposals, setProposals] = useState([])
  const [pipelineItems, setPipelineItems] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)

  useEffect(() => {
    if (profile?.org_id) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id])

  // Auto-select first company with PowerBI link
  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      const withBI = companies.find(c => c.powerbi_link)
      setSelectedCompanyId(withBI ? withBI.id : companies[0].id)
    }
  }, [companies, selectedCompanyId])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        loadTable('companies', setCompanies, q => q.order('name', { ascending: true })),
        loadTable('proposals', setProposals),
        loadTable('pipeline_items', setPipelineItems, q => q.eq('is_archived', false)),
        loadTable('projects', setProjects),
        loadTable('tasks', setTasks, q => q.is('deleted_at', null)),
        loadTable('profiles', setProfiles),
        loadActivityLog(),
      ])
    } catch (err) {
      console.error('Error loading BI:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadTable(tableName, setter, modifier) {
    try {
      let q = supabase.from(tableName).select('*').eq('org_id', profile?.org_id)
      if (modifier) q = modifier(q)
      const { data, error: qErr } = await q
      if (qErr) {
        console.warn(`Tabela ${tableName}:`, qErr.message)
        setter([])
        return
      }
      setter(data || [])
    } catch (err) {
      console.warn(`Tabela ${tableName} nao acessivel:`, err.message)
      setter([])
    }
  }

  async function loadActivityLog() {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
      const { data, error: qErr } = await supabase
        .from('activity_log')
        .select('*')
        .eq('org_id', profile?.org_id)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(100)
      if (qErr) {
        console.warn('activity_log:', qErr.message)
        setActivityLog([])
        return
      }
      setActivityLog(data || [])
    } catch (err) {
      setActivityLog([])
    }
  }

  // ============================================================
  // Filtragem de empresas (PowerBI sidebar)
  // ============================================================
  const filteredCompanies = useMemo(() => {
    if (!search) return companies
    const s = search.toLowerCase()
    return companies.filter(c => (c.name || '').toLowerCase().includes(s))
  }, [companies, search])

  const companiesWithBI = useMemo(() => filteredCompanies.filter(c => c.powerbi_link), [filteredCompanies])
  const companiesWithoutBI = useMemo(() => filteredCompanies.filter(c => !c.powerbi_link), [filteredCompanies])

  const selectedCompany = useMemo(() => companies.find(c => c.id === selectedCompanyId), [companies, selectedCompanyId])

  // ============================================================
  // KPIs do Dashboard Interno (calculados do Supabase real)
  // ============================================================
  const internalKpis = useMemo(() => {
    // Pipeline total = proposals abertas + pipeline_items ativos
    const activeProposals = proposals.filter(p => !['aceita', 'perdida'].includes(p.status))
    const proposalValue = activeProposals.reduce((s, p) => s + (parseFloat(p.value) || 0), 0)
    const pipelineValue = pipelineItems.reduce((s, p) => s + (parseFloat(p.value) || 0), 0)
    const totalPipeline = proposalValue + pipelineValue

    // Projetos ativos
    const activeProjects = projects.filter(p =>
      p.status === 'active' || p.status === 'Em andamento' || p.status === 'Planejamento'
    )
    const avgProgress = activeProjects.length > 0
      ? activeProjects.reduce((s, p) => s + (parseFloat(p.progress) || 0), 0) / activeProjects.length
      : 0

    // Tasks por status
    const tasksDone = tasks.filter(t => t.column_id === 'done').length
    const tasksDoing = tasks.filter(t => t.column_id === 'doing').length
    const tasksTodo = tasks.filter(t => t.column_id === 'todo').length

    // Captação por estágio (pipeline_items.stage: comite, indicacao, liberado)
    const captacaoByStage = { indicacao: 0, comite: 0, liberado: 0 }
    pipelineItems.forEach(p => {
      if (captacaoByStage[p.stage] !== undefined) captacaoByStage[p.stage]++
    })
    const captacaoValueByStage = { indicacao: 0, comite: 0, liberado: 0 }
    pipelineItems.forEach(p => {
      if (captacaoValueByStage[p.stage] !== undefined) {
        captacaoValueByStage[p.stage] += parseFloat(p.value) || 0
      }
    })

    // Atividade ultimos 7 dias
    const activityCount = activityLog.length
    const activeUsers = new Set(activityLog.map(a => a.actor_id).filter(Boolean)).size

    return {
      totalPipeline,
      proposalValue,
      pipelineValue,
      activeProposals: activeProposals.length,
      pipelineItems: pipelineItems.length,
      activeProjects: activeProjects.length,
      totalProjects: projects.length,
      avgProgress,
      tasksDone,
      tasksDoing,
      tasksTodo,
      tasksTotal: tasks.length,
      captacaoByStage,
      captacaoValueByStage,
      activityCount,
      activeUsers,
    }
  }, [proposals, pipelineItems, projects, tasks, activityLog])

  // Top empresas por número de tarefas/projetos
  const topCompanies = useMemo(() => {
    return companies.map(c => {
      const cTasks = tasks.filter(t => t.company_id === c.id).length
      const cProjects = projects.filter(p => p.company_id === c.id).length
      return { ...c, taskCount: cTasks, projectCount: cProjects }
    }).sort((a, b) => (b.taskCount + b.projectCount) - (a.taskCount + a.projectCount)).slice(0, 5)
  }, [companies, tasks, projects])

  function formatCurrency(v) {
    const n = parseFloat(v) || 0
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <BarChart3 className="w-3 h-3" />
              Business Intelligence
            </div>
            <h1 className="text-2xl font-bold mb-1">📉 BI</h1>
            <p className="text-sm text-zinc-300">
              {companiesWithBI.length} empresas com PowerBI · {companies.length} total · dashboard interno em tempo real
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadAll}
              disabled={loading}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="flex gap-1 mt-5 border-b border-white/10 -mb-2">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-violet-400 text-white'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5" />
          <span className="text-sm text-rose-900">{error}</span>
        </div>
      )}

      {loading && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center mb-6">
          <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2 text-zinc-400" />
          <span className="text-sm text-zinc-500">Carregando…</span>
        </div>
      )}

      {/* ============== TAB: POWERBI (preservado) ============== */}
      {!loading && activeTab === 'powerbi' && (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Sidebar de empresas */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden h-fit">
            <div className="p-4 border-b border-zinc-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <div className="font-bold text-zinc-800 text-sm">BI</div>
                  <div className="text-[10px] text-zinc-500">PowerBI Dashboards</div>
                </div>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar empresa…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Empresas COM BI */}
            <div className="px-4 pt-3 pb-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Empresas com BI ({companiesWithBI.length})
              </div>
            </div>
            {companiesWithBI.length === 0 ? (
              <div className="px-4 py-2 text-xs text-zinc-400">Nenhuma</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {companiesWithBI.map(c => {
                  const isSelected = c.id === selectedCompanyId
                  const initials = (c.name || '?').substring(0, 1).toUpperCase()
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCompanyId(c.id)}
                      className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                        isSelected ? 'bg-violet-50 border-l-4 border-violet-500' : 'hover:bg-zinc-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-zinc-800 text-sm truncate">{c.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {c.segment ? c.segment.substring(0, 30) : 'PowerBI ativo'}
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    </div>
                  )
                })}
              </div>
            )}

            {/* Empresas SEM BI */}
            <div className="px-4 pt-3 pb-1 mt-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Sem BI ({companiesWithoutBI.length})
              </div>
            </div>
            {companiesWithoutBI.length === 0 ? (
              <div className="px-4 py-2 text-xs text-zinc-400">Nenhuma</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {companiesWithoutBI.map(c => {
                  const initials = (c.name || '?').substring(0, 1).toUpperCase()
                  return (
                    <div key={c.id} className="px-4 py-2 flex items-center gap-3 opacity-60">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="text-xs text-zinc-600 truncate">{c.name}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Embed do PowerBI */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            {!selectedCompany ? (
              <div className="p-12 text-center text-sm text-zinc-400">
                Selecione uma empresa para ver o dashboard
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                      {(selectedCompany.name || '?').substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-zinc-800">{selectedCompany.name}</div>
                      <div className="text-xs text-zinc-500">Power BI Dashboard</div>
                    </div>
                  </div>
                  {selectedCompany.powerbi_link && (
                    <a
                      href={selectedCompany.powerbi_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg text-xs font-semibold flex items-center gap-2 text-zinc-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir em nova aba
                    </a>
                  )}
                </div>
                {selectedCompany.powerbi_link ? (
                  <div className="aspect-video bg-zinc-100">
                    <iframe
                      src={selectedCompany.powerbi_link}
                      title={`PowerBI - ${selectedCompany.name}`}
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <BarChart3 className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <div className="text-sm font-bold text-zinc-700">Dashboard PowerBI não configurado</div>
                    <div className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                      Adicione um link no campo <code className="bg-zinc-100 px-1 rounded">powerbi_link</code> da empresa para exibir o dashboard aqui.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ============== TAB: DASHBOARD INTERNO (NOVO) ============== */}
      {!loading && activeTab === 'internal' && (
        <div className="space-y-6">
          {/* KPIs Hero */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <BigKpi
              label="Pipeline total"
              value={formatCurrency(internalKpis.totalPipeline)}
              sub={`${internalKpis.activeProposals} propostas + ${internalKpis.pipelineItems} captação`}
              icon={DollarSign}
              accent="violet"
            />
            <BigKpi
              label="Projetos ativos"
              value={internalKpis.activeProjects}
              sub={`de ${internalKpis.totalProjects} · ${internalKpis.avgProgress.toFixed(0)}% médio`}
              icon={Briefcase}
              accent="emerald"
            />
            <BigKpi
              label="Tarefas concluídas"
              value={`${internalKpis.tasksDone} / ${internalKpis.tasksTotal}`}
              sub={`${internalKpis.tasksDoing} em andamento`}
              icon={CheckCircle}
              accent="sky"
            />
            <BigKpi
              label="Atividade 7d"
              value={internalKpis.activityCount}
              sub={`${internalKpis.activeUsers} usuários ativos`}
              icon={Activity}
              accent="amber"
            />
          </div>

          {/* Funil de Captação + Distribuição de Tarefas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-600" />
                Funil de Captação
              </h2>
              <div className="space-y-4">
                {[
                  { id: 'indicacao', label: 'Indicação', color: 'sky' },
                  { id: 'comite',    label: 'Comitê',    color: 'amber' },
                  { id: 'liberado',  label: 'Liberado',  color: 'emerald' },
                ].map(stage => {
                  const count = internalKpis.captacaoByStage[stage.id] || 0
                  const value = internalKpis.captacaoValueByStage[stage.id] || 0
                  const total = internalKpis.pipelineItems
                  const pct = total > 0 ? (count / total) * 100 : 0
                  const colors = {
                    sky: 'bg-sky-500 text-sky-700 bg-sky-50',
                    amber: 'bg-amber-500 text-amber-700 bg-amber-50',
                    emerald: 'bg-emerald-500 text-emerald-700 bg-emerald-50',
                  }
                  const [bar, text, bg] = colors[stage.color].split(' ')
                  return (
                    <div key={stage.id} className={`${bg} rounded-lg p-3`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${bar}`} />
                          <span className={`font-bold text-sm ${text}`}>{stage.label}</span>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${text}`}>{count}</div>
                          <div className="text-[10px] text-zinc-500 font-semibold">{formatCurrency(value)}</div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white rounded-full overflow-hidden">
                        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-violet-600" />
                Distribuição de Tarefas
              </h2>
              {internalKpis.tasksTotal === 0 ? (
                <div className="text-center py-8 text-sm text-zinc-400">Nenhuma tarefa cadastrada</div>
              ) : (
                <div className="space-y-4">
                  {[
                    { id: 'todo',  label: 'A fazer',      count: internalKpis.tasksTodo,  color: 'zinc' },
                    { id: 'doing', label: 'Em andamento', count: internalKpis.tasksDoing, color: 'amber' },
                    { id: 'done',  label: 'Concluídas',   count: internalKpis.tasksDone,  color: 'emerald' },
                  ].map(s => {
                    const pct = (s.count / internalKpis.tasksTotal) * 100
                    const colors = {
                      zinc: 'bg-zinc-400 text-zinc-700 bg-zinc-50',
                      amber: 'bg-amber-500 text-amber-700 bg-amber-50',
                      emerald: 'bg-emerald-500 text-emerald-700 bg-emerald-50',
                    }
                    const [bar, text, bg] = colors[s.color].split(' ')
                    return (
                      <div key={s.id} className={`${bg} rounded-lg p-3`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-bold text-sm ${text}`}>{s.label}</span>
                          <div className="text-right">
                            <div className={`font-bold ${text}`}>{s.count}</div>
                            <div className="text-[10px] text-zinc-500 font-semibold">{pct.toFixed(0)}%</div>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white rounded-full overflow-hidden">
                          <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top Empresas + Projetos por Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-violet-600" />
                Top empresas (por atividade)
              </h2>
              {topCompanies.length === 0 ? (
                <div className="text-center py-6 text-sm text-zinc-400">Nenhuma empresa</div>
              ) : (
                <div className="space-y-2">
                  {topCompanies.map((c, idx) => {
                    const initials = (c.name || '?').substring(0, 1).toUpperCase()
                    return (
                      <div key={c.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 rounded-lg">
                        <div className="text-xs font-bold text-zinc-500 w-6 text-center">#{idx + 1}</div>
                        <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-zinc-800 text-sm truncate">{c.name}</div>
                          {c.segment && <div className="text-[10px] text-zinc-500 truncate">{c.segment}</div>}
                        </div>
                        <div className="text-right text-[10px] font-semibold text-zinc-500">
                          <div>{c.projectCount} projetos</div>
                          <div>{c.taskCount} tarefas</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-600" />
                Projetos por status
              </h2>
              {projects.length === 0 ? (
                <div className="text-center py-6 text-sm text-zinc-400">Nenhum projeto</div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(
                    projects.reduce((acc, p) => {
                      const s = p.status || 'sem status'
                      acc[s] = (acc[s] || 0) + 1
                      return acc
                    }, {})
                  ).map(([status, count]) => {
                    const pct = (count / projects.length) * 100
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-zinc-700">{status}</span>
                          <span className="font-bold text-zinc-900">{count} · {pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Atividade da equipe */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" />
                Atividade da equipe — últimos 7 dias
              </h2>
              <span className="text-xs text-zinc-500 font-semibold">{internalKpis.activityCount} eventos</span>
            </div>
            {activityLog.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-400">
                Nenhum evento registrado nos últimos 7 dias
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {activityLog.slice(0, 15).map(ev => {
                  const actor = profiles.find(p => p.id === ev.actor_id)
                  const initials = actor?.initials || (actor?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  const avatarStyle = actor?.avatar_color ? { background: actor.avatar_color } : {}
                  const avatarClass = actor?.avatar_color
                    ? 'w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0'
                    : 'w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0'
                  return (
                    <div key={ev.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 rounded-lg text-xs">
                      <div className={avatarClass} style={avatarStyle}>{initials}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-zinc-800">{actor?.full_name || '—'}</span>
                        <span className="text-zinc-600"> · {ev.action}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {ev.created_at && new Date(ev.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function BigKpi({ label, value, sub, icon: Icon, accent }) {
  const accents = {
    violet: { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', text: 'text-violet-700' },
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700' },
    sky: { bg: 'bg-sky-50', icon: 'bg-sky-100 text-sky-600', text: 'text-sky-700' },
    amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700' },
  }
  const a = accents[accent] || accents.violet
  return (
    <div className={`${a.bg} border border-zinc-200 rounded-xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${a.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className={`text-2xl font-bold ${a.text} tracking-tight`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  )
}