import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import {
  BarChart3,
  Users,
  ListChecks,
  AlertTriangle,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
} from 'lucide-react'

// ============================================================================
// Dashboard.jsx — Round 6 · Visão consolidada BX Group
// ----------------------------------------------------------------------------
// KPIs executivos em tempo real a partir das 47 tabelas Supabase.
// Schema validado 2026-04-08. Multi-tenant via org_id.
// ============================================================================

export default function Dashboard() {
  const { profile } = useData()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const [companies, setCompanies] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [pipeline, setPipeline] = useState([])
  const [proposals, setProposals] = useState([])
  const [activity, setActivity] = useState([])
  const [checkIns, setCheckIns] = useState([])

  useEffect(function () {
    if (profile?.org_id) loadAll(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id])

  async function loadAll(isRefresh) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('Perfil sem org_id')

      const [cRes, prRes, tRes, profRes, pipRes, propRes, actRes, ciRes] = await Promise.all([
        supabase.from('companies').select('*').eq('org_id', orgId),
        supabase.from('projects').select('*').eq('org_id', orgId),
        supabase.from('tasks').select('*').eq('org_id', orgId),
        supabase.from('profiles').select('*').eq('org_id', orgId).order('full_name', { ascending: true }),
        supabase.from('pipeline_items').select('*').eq('org_id', orgId),
        supabase.from('proposals').select('*').eq('org_id', orgId),
        supabase.from('activity_log').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(20),
        supabase.from('check_ins').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
      ])

      if (cRes.error) throw cRes.error
      if (prRes.error) throw prRes.error
      if (tRes.error) throw tRes.error
      if (profRes.error) throw profRes.error
      if (pipRes.error) throw pipRes.error
      if (propRes.error) throw propRes.error
      if (actRes.error) throw actRes.error
      if (ciRes.error) throw ciRes.error

      setCompanies(cRes.data || [])
      setProjects(prRes.data || [])
      setTasks(tRes.data || [])
      setProfiles(profRes.data || [])
      setPipeline(pipRes.data || [])
      setProposals(propRes.data || [])
      setActivity(actRes.data || [])
      setCheckIns(ciRes.data || [])
    } catch (err) {
      console.error('Dashboard loadAll error:', err)
      setError(err.message || 'Erro ao carregar dados do Dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const kpis = useMemo(function () {
    const totalCompanies = companies.length
    const criticalCompanies = companies.filter(function (c) {
      return c.criticality === 'critico' || c.criticality === 'alto'
    }).length

    const activeProjects = projects.filter(function (p) {
      const s = (p.status || '').toLowerCase()
      return s === 'active' || s === 'em andamento' || s === 'andamento'
    }).length
    const totalProjects = projects.length

    const todoTasks = tasks.filter(function (t) { return t.column_id === 'todo' }).length
    const doingTasks = tasks.filter(function (t) { return t.column_id === 'doing' }).length
    const doneTasks = tasks.filter(function (t) { return t.column_id === 'done' }).length
    const urgentTasks = tasks.filter(function (t) { return t.priority === 'urgent' }).length

    const totalTeam = profiles.length

    const pipelineByStage = {
      indicacao: pipeline.filter(function (p) { return p.stage === 'indicacao' }).length,
      comite: pipeline.filter(function (p) { return p.stage === 'comite' }).length,
      liberado: pipeline.filter(function (p) { return p.stage === 'liberado' }).length,
    }
    const totalPipeline = pipeline.length

    const sentProposals = proposals.filter(function (p) { return p.status === 'enviada' }).length
    const totalProposals = proposals.length

    const today = new Date().toISOString().slice(0, 10)
    const checkInsToday = checkIns.filter(function (ci) {
      return (ci.created_at || '').slice(0, 10) === today
    }).length

    return {
      totalCompanies,
      criticalCompanies,
      activeProjects,
      totalProjects,
      todoTasks,
      doingTasks,
      doneTasks,
      urgentTasks,
      totalTasks: tasks.length,
      totalTeam,
      pipelineByStage,
      totalPipeline,
      sentProposals,
      totalProposals,
      checkInsToday,
    }
  }, [companies, projects, tasks, profiles, pipeline, proposals, checkIns])

  const completionRate = kpis.totalTasks > 0
    ? Math.round((kpis.doneTasks / kpis.totalTasks) * 100)
    : 0

  const projectsAtRisk = useMemo(function () {
    return projects.filter(function (p) {
      const s = (p.priority || '').toLowerCase()
      return s === 'alta' || s === 'critica'
    }).slice(0, 5)
  }, [projects])

  const recentActivity = useMemo(function () {
    return activity.slice(0, 8)
  }, [activity])

  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-violet animate-spin" />
          <span className="ml-3 text-sm text-zinc-500">Carregando indicadores...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-red-900">Erro ao carregar Dashboard</div>
              <div className="text-sm text-red-700 mt-1">{error}</div>
              <button
                onClick={function () { loadAll(true) }}
                className="mt-3 text-xs font-semibold text-red-700 hover:text-red-900 underline"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* HERO */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
                <BarChart3 className="w-3 h-3" />
                Visão Consolidada BX Group
              </div>
              <h1 className="text-2xl font-bold mb-1">
                Olá, {profile?.full_name ? profile.full_name.split(' ')[0] : 'Gabriel'} 👋
              </h1>
              <p className="text-sm text-zinc-300">
                Indicadores executivos em tempo real — {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={function () { loadAll(true) }}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={'w-3 h-3 ' + (refreshing ? 'animate-spin' : '')} />
              Atualizar
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Empresas</div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-white">{kpis.totalCompanies}</div>
                {kpis.criticalCompanies > 0 && (
                  <div className="text-[10px] text-red-300 font-semibold">{kpis.criticalCompanies} críticas</div>
                )}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Projetos Ativos</div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-white">{kpis.activeProjects}</div>
                <div className="text-[10px] text-zinc-400">/ {kpis.totalProjects}</div>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Tarefas em Execução</div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-violet-300">{kpis.doingTasks}</div>
                {kpis.urgentTasks > 0 && (
                  <div className="text-[10px] text-orange-300 font-semibold">{kpis.urgentTasks} urgentes</div>
                )}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Pipeline Comercial</div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-white">{kpis.totalPipeline}</div>
                <div className="text-[10px] text-emerald-300 font-semibold">{kpis.pipelineByStage.liberado} liberados</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-6">

          {/* Tarefas */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-violet" />
                <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Tarefas · Visão Geral</h2>
              </div>
              <div className="text-xs text-zinc-500">{kpis.totalTasks} total</div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                <div className="flex items-center gap-2 mb-1">
                  <Circle className="w-3 h-3 text-zinc-400" />
                  <div className="text-[10px] font-bold uppercase text-zinc-500">A Fazer</div>
                </div>
                <div className="text-xl font-bold text-zinc-800">{kpis.todoTasks}</div>
              </div>
              <div className="bg-violet/5 rounded-lg p-3 border border-violet/20">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-violet" />
                  <div className="text-[10px] font-bold uppercase text-violet">Em Execução</div>
                </div>
                <div className="text-xl font-bold text-violet">{kpis.doingTasks}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Concluídas</div>
                </div>
                <div className="text-xl font-bold text-emerald-700">{kpis.doneTasks}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-zinc-600">Taxa de conclusão</span>
                <span className="font-bold text-zinc-800">{completionRate}%</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet to-violet/70 transition-all duration-500"
                  style={{ width: completionRate + '%' }}
                />
              </div>
            </div>
          </div>

          {/* Pipeline */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet" />
                <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Pipeline Comercial</h2>
              </div>
              <div className="text-xs text-zinc-500">{kpis.totalPipeline} deals</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 bg-zinc-50 rounded-lg border border-zinc-100">
                <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Indicação</div>
                <div className="text-3xl font-bold text-zinc-800">{kpis.pipelineByStage.indicacao}</div>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-100">
                <div className="text-[10px] font-bold uppercase text-amber-700 mb-1">Comitê</div>
                <div className="text-3xl font-bold text-amber-700">{kpis.pipelineByStage.comite}</div>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="text-[10px] font-bold uppercase text-emerald-700 mb-1">Liberado</div>
                <div className="text-3xl font-bold text-emerald-700">{kpis.pipelineByStage.liberado}</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
              <div className="text-zinc-500">
                Propostas enviadas: <span className="font-bold text-zinc-800">{kpis.sentProposals}</span> / {kpis.totalProposals}
              </div>
              <a href="/crm" className="text-violet font-semibold hover:underline flex items-center gap-1">
                Ver CRM completo
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Projetos em atenção */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Projetos em Atenção</h2>
              </div>
              <div className="text-xs text-zinc-500">{projectsAtRisk.length}</div>
            </div>

            {projectsAtRisk.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                <div className="text-sm text-zinc-600">Nenhum projeto de alta prioridade no momento</div>
              </div>
            ) : (
              <div className="space-y-2">
                {projectsAtRisk.map(function (p) {
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100 hover:border-violet/30 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-zinc-800 truncate">{p.name || 'Sem nome'}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{p.status || 'Sem status'}</div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 bg-orange-100 text-orange-700 rounded">
                        {p.priority || 'Alta'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="space-y-6">

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-violet" />
                <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Time</h2>
              </div>
              <div className="text-xs text-zinc-500">{kpis.totalTeam}</div>
            </div>

            <div className="mb-4 p-3 bg-violet/5 rounded-lg border border-violet/10">
              <div className="text-[10px] font-bold uppercase text-violet mb-1">Check-ins Hoje</div>
              <div className="text-2xl font-bold text-violet">{kpis.checkInsToday}</div>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {profiles.slice(0, 8).map(function (p) {
                const initials = (p.full_name || '?')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(function (s) { return s[0] })
                  .join('')
                  .toUpperCase()
                return (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-zinc-50">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet to-violet/70 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-zinc-800 truncate">{p.full_name || 'Sem nome'}</div>
                      <div className="text-[10px] text-zinc-500 truncate">{p.role || '—'}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <a href="/time" className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-center gap-1 text-xs font-semibold text-violet hover:underline">
              Ver time completo
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-violet" />
              <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Atividade Recente</h2>
            </div>

            {recentActivity.length === 0 ? (
              <div className="text-center py-6">
                <Activity className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <div className="text-xs text-zinc-500">Nenhuma atividade registrada</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recentActivity.map(function (a) {
                  const when = a.created_at
                    ? new Date(a.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''
                  return (
                    <div key={a.id} className="flex gap-2 pb-2 border-b border-zinc-50 last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-700 leading-tight">
                          {a.action || 'Ação'}
                          {a.entity_type ? (
                            <span className="text-zinc-400"> · {a.entity_type}</span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{when}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-violet to-violet/80 rounded-xl p-5 text-white">
            <div className="text-xs font-bold uppercase tracking-wider mb-3 opacity-80">Atalhos</div>
            <div className="space-y-2">
              <a href="/kanban" className="block p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition-all">
                📋 Abrir Kanban
              </a>
              <a href="/captacao" className="block p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition-all">
                🎯 Captação ativa
              </a>
              <a href="/notas" className="block p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition-all">
                📒 Nova nota / reunião
              </a>
              <a href="/calendario" className="block p-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition-all">
                📅 Agenda do dia
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
        BX Hub v3 · Dashboard · Dados em tempo real do Supabase
      </div>
    </div>
  )
}
