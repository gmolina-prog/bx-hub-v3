import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import {
  Building2,
  Search,
  Filter,
  ExternalLink,
  AlertCircle,
  ChevronRight,
  Briefcase,
  Users,
  TrendingUp,
  Loader2,
  FolderOpen,
  Grid3x3,
  List as ListIcon,
} from 'lucide-react'

// ============================================================================
// Portfolio.jsx — Round 6 · Visão consolidada de empresas e projetos
// ----------------------------------------------------------------------------
// Lista hierárquica: Empresa → Projetos → Tarefas count.
// Filtros por criticidade, busca textual, 2 modos de view (grid/list).
// ============================================================================

export default function Portfolio() {
  const { profile } = useData()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [companies, setCompanies] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])

  // UI state
  const [search, setSearch] = useState('')
  const [critFilter, setCritFilter] = useState('todos')
  const [viewMode, setViewMode] = useState('grid')
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)

  useEffect(function () {
    if (profile?.org_id) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('Perfil sem org_id')

      const [cRes, prRes, tRes] = await Promise.all([
        supabase.from('companies').select('*').eq('org_id', orgId),
        supabase.from('projects').select('*').eq('org_id', orgId),
        supabase.from('tasks').select('*').eq('org_id', orgId),
      ])

      if (cRes.error) throw cRes.error
      if (prRes.error) throw prRes.error
      if (tRes.error) throw tRes.error

      setCompanies(cRes.data || [])
      setProjects(prRes.data || [])
      setTasks(tRes.data || [])
    } catch (err) {
      console.error('Portfolio loadAll error:', err)
      setError(err.message || 'Erro ao carregar portfólio')
    } finally {
      setLoading(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Empresas enriquecidas (com contagem de projetos/tarefas)
  // ──────────────────────────────────────────────────────────────────────
  const enrichedCompanies = useMemo(function () {
    return companies.map(function (c) {
      const companyProjects = projects.filter(function (p) { return p.company_id === c.id })
      const projectIds = companyProjects.map(function (p) { return p.id })
      const companyTasks = tasks.filter(function (t) { return projectIds.indexOf(t.project_id) !== -1 })

      const activeProjects = companyProjects.filter(function (p) {
        const s = (p.status || '').toLowerCase()
        return s === 'active' || s === 'em andamento' || s === 'andamento'
      }).length

      const doneTasks = companyTasks.filter(function (t) { return t.column_id === 'done' }).length
      const progress = companyTasks.length > 0
        ? Math.round((doneTasks / companyTasks.length) * 100)
        : 0

      return {
        ...c,
        projectCount: companyProjects.length,
        activeProjectCount: activeProjects,
        taskCount: companyTasks.length,
        doneTaskCount: doneTasks,
        progress,
        projects: companyProjects,
      }
    })
  }, [companies, projects, tasks])

  // Filtros
  const filteredCompanies = useMemo(function () {
    return enrichedCompanies.filter(function (c) {
      if (critFilter !== 'todos' && c.criticality !== critFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const name = (c.name || '').toLowerCase()
        const desc = (c.description || '').toLowerCase()
        if (name.indexOf(q) === -1 && desc.indexOf(q) === -1) return false
      }
      return true
    })
  }, [enrichedCompanies, search, critFilter])

  const selectedCompany = useMemo(function () {
    if (!selectedCompanyId) return null
    return enrichedCompanies.find(function (c) { return c.id === selectedCompanyId }) || null
  }, [selectedCompanyId, enrichedCompanies])

  // Contadores globais
  const totals = useMemo(function () {
    return {
      companies: enrichedCompanies.length,
      critical: enrichedCompanies.filter(function (c) { return c.criticality === 'critico' }).length,
      high: enrichedCompanies.filter(function (c) { return c.criticality === 'alto' }).length,
      projects: projects.length,
      activeProjects: projects.filter(function (p) {
        const s = (p.status || '').toLowerCase()
        return s === 'active' || s === 'em andamento' || s === 'andamento'
      }).length,
    }
  }, [enrichedCompanies, projects])

  // Badge de criticidade
  function CritBadge(props) {
    const crit = props.crit || 'normal'
    const map = {
      critico: 'bg-red-100 text-red-700 border-red-200',
      alto: 'bg-orange-100 text-orange-700 border-orange-200',
      medio: 'bg-amber-100 text-amber-700 border-amber-200',
      baixo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      normal: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    }
    const cls = map[crit] || map.normal
    const label = crit.charAt(0).toUpperCase() + crit.slice(1)
    return (
      <span className={'text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ' + cls}>
        {label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-violet animate-spin" />
          <span className="ml-3 text-sm text-zinc-500">Carregando portfólio...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-red-900">Erro ao carregar Portfólio</div>
              <div className="text-sm text-red-700 mt-1">{error}</div>
              <button onClick={loadAll} className="mt-3 text-xs font-semibold text-red-700 underline">
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
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <Building2 className="w-3 h-3" />
              Portfólio Consolidado
            </div>
            <h1 className="text-2xl font-bold mb-1">Empresas & Projetos</h1>
            <p className="text-sm text-zinc-300">Visão hierárquica de toda a carteira sob gestão</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Empresas</div>
            <div className="text-2xl font-bold">{totals.companies}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Criticidade</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-300">{totals.critical}</span>
              <span className="text-xs text-zinc-500">/ {totals.high} altas</span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Projetos</div>
            <div className="text-2xl font-bold">{totals.projects}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Projetos Ativos</div>
            <div className="text-2xl font-bold text-violet-300">{totals.activeProjects}</div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={function (e) { setSearch(e.target.value) }}
            placeholder="Buscar por empresa ou descrição..."
            className="w-full pl-10 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-violet focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={critFilter}
            onChange={function (e) { setCritFilter(e.target.value) }}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-700 focus:outline-none focus:border-violet"
          >
            <option value="todos">Todas criticidades</option>
            <option value="critico">Crítico</option>
            <option value="alto">Alto</option>
            <option value="medio">Médio</option>
            <option value="baixo">Baixo</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          <button
            onClick={function () { setViewMode('grid') }}
            className={'p-1.5 rounded transition-all ' + (viewMode === 'grid' ? 'bg-white shadow-sm text-violet' : 'text-zinc-500 hover:text-zinc-800')}
            title="Grid"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={function () { setViewMode('list') }}
            className={'p-1.5 rounded transition-all ' + (viewMode === 'list' ? 'bg-white shadow-sm text-violet' : 'text-zinc-500 hover:text-zinc-800')}
            title="Lista"
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* LAYOUT 2 COLUNAS: LISTA + DETALHE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LISTA DE EMPRESAS */}
        <div className={selectedCompany ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {filteredCompanies.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
              <Building2 className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <div className="text-sm font-bold text-zinc-700">Nenhuma empresa encontrada</div>
              <div className="text-xs text-zinc-500 mt-1">
                {search || critFilter !== 'todos' ? 'Ajuste os filtros para ver mais resultados' : 'Cadastre empresas na seção Cadastro'}
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCompanies.map(function (c) {
                const isSelected = selectedCompanyId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={function () { setSelectedCompanyId(isSelected ? null : c.id) }}
                    className={'text-left bg-white border rounded-xl p-5 transition-all hover:shadow-md ' + (isSelected ? 'border-violet shadow-md ring-2 ring-violet/20' : 'border-zinc-200')}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet to-violet/70 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <CritBadge crit={c.criticality} />
                    </div>

                    <div className="text-sm font-bold text-zinc-800 truncate mb-1">{c.name || 'Sem nome'}</div>
                    <div className="text-xs text-zinc-500 line-clamp-2 mb-4 min-h-[2rem]">
                      {c.description || 'Sem descrição'}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-100">
                      <div>
                        <div className="text-[9px] font-bold uppercase text-zinc-400">Projetos</div>
                        <div className="text-sm font-bold text-zinc-800">{c.projectCount}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase text-zinc-400">Ativos</div>
                        <div className="text-sm font-bold text-violet">{c.activeProjectCount}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase text-zinc-400">Progresso</div>
                        <div className="text-sm font-bold text-emerald-600">{c.progress}%</div>
                      </div>
                    </div>

                    <div className="mt-3 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet to-violet/70 transition-all"
                        style={{ width: c.progress + '%' }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800 text-white">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide">Empresa</th>
                    <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide">Criticidade</th>
                    <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide">Projetos</th>
                    <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide">Ativos</th>
                    <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide">Progresso</th>
                    <th className="w-10 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredCompanies.map(function (c) {
                    const isSelected = selectedCompanyId === c.id
                    return (
                      <tr
                        key={c.id}
                        onClick={function () { setSelectedCompanyId(isSelected ? null : c.id) }}
                        className={'cursor-pointer transition-colors ' + (isSelected ? 'bg-violet/5' : 'hover:bg-zinc-50')}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-800">{c.name || 'Sem nome'}</div>
                          <div className="text-xs text-zinc-500 truncate max-w-md">{c.description || '—'}</div>
                        </td>
                        <td className="px-4 py-3"><CritBadge crit={c.criticality} /></td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-800">{c.projectCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-violet">{c.activeProjectCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{c.progress}%</td>
                        <td className="px-4 py-3 text-zinc-400"><ChevronRight className="w-4 h-4" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* DETALHE DA EMPRESA SELECIONADA */}
        {selectedCompany && (
          <div className="lg:col-span-1">
            <div className="bg-white border border-zinc-200 rounded-xl p-5 sticky top-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet to-violet/70 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-800">{selectedCompany.name}</div>
                    <CritBadge crit={selectedCompany.criticality} />
                  </div>
                </div>
                <button
                  onClick={function () { setSelectedCompanyId(null) }}
                  className="text-xs text-zinc-400 hover:text-zinc-800"
                >
                  ✕
                </button>
              </div>

              {selectedCompany.description && (
                <div className="mb-4 p-3 bg-zinc-50 rounded-lg text-xs text-zinc-600 leading-relaxed">
                  {selectedCompany.description}
                </div>
              )}

              {selectedCompany.powerbi_link && (
                <a
                  href={selectedCompany.powerbi_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 flex items-center gap-2 p-3 bg-violet/5 border border-violet/20 rounded-lg text-xs font-semibold text-violet hover:bg-violet/10 transition-all"
                >
                  <TrendingUp className="w-3 h-3" />
                  Abrir dashboard Power BI
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </a>
              )}

              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-zinc-600">Progresso geral</span>
                  <span className="font-bold text-zinc-800">{selectedCompany.progress}%</span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet to-violet/70"
                    style={{ width: selectedCompany.progress + '%' }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1">
                  <span>{selectedCompany.doneTaskCount} concluídas</span>
                  <span>{selectedCompany.taskCount} tarefas totais</span>
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="w-4 h-4 text-violet" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-700">
                    Projetos ({selectedCompany.projects.length})
                  </h3>
                </div>

                {selectedCompany.projects.length === 0 ? (
                  <div className="text-xs text-zinc-500 text-center py-4">
                    Nenhum projeto cadastrado
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCompany.projects.map(function (p) {
                      return (
                        <div key={p.id} className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="text-xs font-semibold text-zinc-800 flex-1 min-w-0 truncate">
                              {p.name || 'Sem nome'}
                            </div>
                            {p.priority && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-white text-zinc-600 rounded">
                                {p.priority}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {p.status || 'Sem status'}
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
      </div>

      <div className="mt-8 text-center text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
        BX Hub v3 · Portfólio · {filteredCompanies.length} de {enrichedCompanies.length} empresas
      </div>
    </div>
  )
}
