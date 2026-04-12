import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Search, Filter, ExternalLink, AlertCircle,
  ChevronRight, Briefcase, TrendingUp, Loader2, FolderOpen,
  Grid3x3, List as ListIcon, X,
} from 'lucide-react'

// ── criticality config ───────────────────────────────────────────────────────
const CRIT_CONFIG = {
  critico: { border: '#EF4444', bg: '#FEF2F2', text: '#B91C1C', badge: '#FEE2E2', badgeText: '#991B1B', label: 'Crítico' },
  alto:    { border: '#F59E0B', bg: '#FFFBEB', text: '#92400E', badge: '#FEF3C7', badgeText: '#78350F', label: 'Alto'    },
  medio:   { border: '#6366F1', bg: '#EEF2FF', text: '#4338CA', badge: '#E0E7FF', badgeText: '#3730A3', label: 'Médio'   },
  baixo:   { border: '#10B981', bg: '#ECFDF5', text: '#065F46', badge: '#D1FAE5', badgeText: '#064E3B', label: 'Baixo'   },
  normal:  { border: '#9CA3AF', bg: '#F9FAFB', text: '#374151', badge: '#F3F4F6', badgeText: '#4B5563', label: 'Normal'  },
}

function getCrit(c) { return CRIT_CONFIG[c] || CRIT_CONFIG.normal }

// project colors deterministic from id
const PROJ_COLORS = ['#F59E0B','#EF4444','#6366F1','#10B981','#EC4899','#8B5CF6','#3B82F6','#14B8A6','#F97316']
function projColor(id) {
  if (!id) return '#9CA3AF'
  let h = 0
  for (const ch of String(id)) h = (h << 5) - h + ch.charCodeAt(0)
  return PROJ_COLORS[Math.abs(h) % PROJ_COLORS.length]
}

export default function Portfolio() {
  const { profile } = useData()
  usePageTitle('Portfolio')
  const navigate = useNavigate()
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [companies, setCompanies]     = useState([])
  const [projects, setProjects]       = useState([])
  const [tasks, setTasks]             = useState([])
  const [profilesList, setProfilesList] = useState([])
  const [search, setSearch]           = useState('')
  const [critFilter, setCritFilter]   = useState('todos')
  const [viewMode, setViewMode]       = useState('grid')
  const [activeTab, setActiveTab]     = useState('empresas')
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)

  useEffect(() => { if (profile?.org_id) loadAll() }, [profile?.org_id])

  async function loadAll() {
    setLoading(true); setError(null)
    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('Perfil sem org_id')
      const [cRes, prRes, tRes, profRes] = await Promise.allSettled([
        supabase.from('companies').select('*').eq('org_id', orgId),
        supabase.from('projects').select('*').eq('org_id', orgId),
        supabase.from('tasks').select('id,column_id,project_id,due_date,priority').eq('org_id', orgId).is('deleted_at', null).eq('is_archived', false).limit(500),
        supabase.from('profiles').select('id,full_name,initials,avatar_color,role').eq('org_id', orgId),
      ])
      if (cRes.status    === 'fulfilled' && !cRes.value.error)    setCompanies(cRes.value.data || [])
      if (prRes.status   === 'fulfilled' && !prRes.value.error)   setProjects(prRes.value.data || [])
      if (tRes.status    === 'fulfilled' && !tRes.value.error)    setTasks(tRes.value.data || [])
      if (profRes.status === 'fulfilled' && !profRes.value.error) setProfilesList(profRes.value.data || [])
    } catch (err) { setError(err.message || 'Erro ao carregar portfólio') }
    finally { setLoading(false) }
  }

  const profMap = useMemo(() => {
    const m = {}; profilesList.forEach(p => { m[p.id] = p }); return m
  }, [profilesList])

  const INACTIVE = ['Cancelado','Completo','cancelled','complete','Concluído','concluido','Pausado','pausado']

  const enrichedCompanies = useMemo(() => companies.map(c => {
    const cProjects = projects.filter(p => p.company_id === c.id)
    const pIds = new Set(cProjects.map(p => p.id))
    const cTasks = tasks.filter(t => pIds.has(t.project_id))
    const activeProjects = cProjects.filter(p => !INACTIVE.includes(p.status || '')).length
    const doneTasks = cTasks.filter(t => t.column_id === 'done').length
    const overdueTasks = cTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.column_id !== 'done').length
    const totalBudget = cProjects.reduce((s, p) => s + (parseFloat(p.budget) || 0), 0)
    const progress = cTasks.length > 0 ? Math.round((doneTasks / cTasks.length) * 100) : 0
    return { ...c, projectCount: cProjects.length, activeProjectCount: activeProjects, taskCount: cTasks.length, doneTaskCount: doneTasks, overdueTasks, totalBudget, progress, projects: cProjects }
  }), [companies, projects, tasks])

  const filteredCompanies = useMemo(() => enrichedCompanies.filter(c => {
    // Tab filters
    if (activeTab === 'projetos' && c.projectCount === 0)          return false  // only companies with projects
    if (activeTab === 'ativos'   && c.activeProjectCount === 0)    return false  // only companies with active projects
    if (activeTab === 'criticos' && c.criticality !== 'critico' && c.criticality !== 'alto') return false
    // criticidade dropdown filter
    if (critFilter !== 'todos' && c.criticality !== critFilter) return false
    // text search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return (c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
    }
    return true
  }), [enrichedCompanies, search, critFilter, activeTab])

  const selectedCompany = useMemo(() =>
    selectedCompanyId ? enrichedCompanies.find(c => c.id === selectedCompanyId) || null : null,
    [selectedCompanyId, enrichedCompanies])

  const totals = useMemo(() => ({
    companies:      enrichedCompanies.length,
    critical:       enrichedCompanies.filter(c => c.criticality === 'critico').length,
    high:           enrichedCompanies.filter(c => c.criticality === 'alto').length,
    projects:       projects.length,
    activeProjects: projects.filter(p => !INACTIVE.includes(p.status || '')).length,
    withProjects:   enrichedCompanies.filter(c => c.projectCount > 0).length,
  }), [enrichedCompanies, projects])

  const heroTabs = [
    { id: 'empresas', label: 'Empresas',  count: enrichedCompanies.length },
    { id: 'projetos', label: 'C/ Projetos', count: enrichedCompanies.filter(c => c.projectCount > 0).length },
    { id: 'ativos',   label: 'Ativos',    count: enrichedCompanies.filter(c => c.activeProjectCount > 0).length },
    { id: 'criticos', label: 'Críticos',  count: totals.critical + totals.high },
  ]

  // ─── loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
      <span className="ml-3 text-sm text-zinc-500">Carregando portfólio...</span>
    </div>
  )

  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 flex gap-3">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div><div className="font-bold text-red-900">Erro ao carregar Portfólio</div>
        <div className="text-sm text-red-700 mt-1">{error}</div>
        <button onClick={loadAll} className="mt-2 text-xs font-semibold text-red-700 underline">Tentar novamente</button>
      </div>
    </div></div>
  )

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)', background: '#F4F5F8' }}>

      {/* ══ HERO ══ */}
      <div style={{ background: '#2D2E39', flexShrink: 0 }}>
        <div style={{ padding: '20px 24px 0' }}>

          {/* Tag + Título */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Building2 style={{ width: 11, height: 11 }} />
                Portfólio Consolidado
              </div>
              <div style={{ fontSize: 21, fontWeight: 700, color: 'white', marginBottom: 2 }}>Empresas & Projetos</div>
              <div style={{ fontSize: 11.5, color: '#6B7280' }}>Visão hierárquica de toda a carteira sob gestão</div>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Empresas',    value: totals.companies,      color: '#A5B4FC' },
              { label: 'Críticas',    value: totals.critical,       color: '#FCA5A5', sub: `${totals.high} altas` },
              { label: 'Projetos',    value: totals.projects,       color: '#FCD34D' },
              { label: 'Ativos',      value: totals.activeProjects, color: '#6EE7B7' },
              { label: 'C/ Projetos', value: totals.withProjects,   color: '#F9A8D4' },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.09em', color: '#6B7280', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1, color: k.color }}>{k.value}</div>
                {k.sub && <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{k.sub}</div>}
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {heroTabs.map(tab => {
              const on = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px',
                    fontSize: 12, fontWeight: on ? 600 : 500,
                    borderRadius: '8px 8px 0 0', cursor: 'pointer', whiteSpace: 'nowrap',
                    border: '1px solid transparent', borderBottom: 'none', outline: 'none',
                    background: on ? 'white' : 'transparent',
                    color: on ? '#5452C1' : '#6B7280',
                    borderColor: on ? 'rgba(255,255,255,.12)' : 'transparent',
                    transition: 'all .12s',
                  }}>
                  {tab.label}
                  <span style={{
                    fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 99,
                    background: on ? '#EEF2FF' : 'rgba(255,255,255,.1)',
                    color: on ? '#5452C1' : '#9CA3AF',
                  }}>{tab.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══ TOOLBAR ══ */}
      <div style={{ background: 'white', borderBottom: '1px solid #EAECF0', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search style={{ width: 14, height: 14, color: '#9CA3AF', position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar empresa..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 12.5, border: '1px solid #EAECF0', borderRadius: 8, outline: 'none', background: '#FAFBFD', fontFamily: 'inherit', color: '#374151' }}
          />
        </div>
        {/* Criticidade filter */}
        <select value={critFilter} onChange={e => setCritFilter(e.target.value)}
          style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #EAECF0', borderRadius: 8, background: 'white', outline: 'none', color: '#374151', fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="todos">Todas criticidades</option>
          <option value="critico">Crítico</option>
          <option value="alto">Alto</option>
          <option value="medio">Médio</option>
          <option value="baixo">Baixo</option>
        </select>
        {/* View mode */}
        <div style={{ display: 'flex', background: '#F4F5F8', borderRadius: 8, padding: 3, gap: 2 }}>
          {[{ m: 'grid', Icon: Grid3x3 }, { m: 'list', Icon: ListIcon }].map(({ m, Icon }) => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: viewMode === m ? 'white' : 'transparent', boxShadow: viewMode === m ? '0 1px 3px rgba(0,0,0,.1)' : 'none', transition: 'all .12s' }}>
              <Icon style={{ width: 15, height: 15, color: viewMode === m ? '#5452C1' : '#9CA3AF' }} />
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
          {filteredCompanies.length} de {enrichedCompanies.length} empresas
        </span>
      </div>

      {/* ══ CONTENT ══ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: selectedCompany ? '1fr 320px' : '1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Companies grid/list ── */}
          <div>
            {filteredCompanies.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid #EAECF0', borderRadius: 12, padding: 48, textAlign: 'center' }}>
                <Building2 style={{ width: 40, height: 40, color: '#D1D5DB', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nenhuma empresa encontrada</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {search || critFilter !== 'todos' ? 'Ajuste os filtros para ver mais resultados' : 'Cadastre empresas na seção Cadastro'}
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: selectedCompany ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {filteredCompanies.map(c => {
                  const cc = getCrit(c.criticality)
                  const isSel = selectedCompanyId === c.id
                  const initials = (c.name || '??').slice(0, 2).toUpperCase()

                  return (
                    <button key={c.id}
                      onClick={() => setSelectedCompanyId(isSel ? null : c.id)}
                      style={{
                        textAlign: 'left', background: 'white', borderRadius: 12, overflow: 'hidden',
                        borderLeft: `3px solid ${cc.border}`,
                        boxShadow: isSel
                          ? `0 0 0 2px #5452C1, 0 4px 16px rgba(84,82,193,.15)`
                          : '0 1px 3px rgba(0,0,0,.06), 0 0 0 0.5px rgba(0,0,0,.04)',
                        cursor: 'pointer', transition: 'all .15s', outline: 'none',
                        border: isSel ? `2px solid #5452C1` : `1px solid #EAECF0`,
                        borderLeftWidth: 3, borderLeftColor: cc.border,
                      }}
                      onMouseEnter={e => { if (!isSel) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                      onMouseLeave={e => { if (!isSel) { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06), 0 0 0 0.5px rgba(0,0,0,.04)'; e.currentTarget.style.transform = 'none' } }}
                    >
                      <div style={{ padding: 16 }}>
                        {/* Row 1: avatar + name + badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            background: cc.border, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white',
                          }}>{initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                              {c.name || 'Sem nome'}
                            </div>
                            {c.description && (
                              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.description}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: cc.badge, color: cc.badgeText, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                              {cc.label}
                            </span>
                            {c.overdueTasks > 0 && (
                              <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 99, background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA' }}>
                                ⚠ {c.overdueTasks} atraso
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 2: stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                          <div style={{ background: '#F9FAFB', borderRadius: 7, padding: '7px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{c.projectCount}</div>
                            <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Projetos</div>
                          </div>
                          <div style={{ background: cc.bg, borderRadius: 7, padding: '7px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: cc.border, lineHeight: 1 }}>{c.activeProjectCount}</div>
                            <div style={{ fontSize: 9, color: cc.text, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2, opacity: .75 }}>Ativos</div>
                          </div>
                          <div style={{ background: '#F9FAFB', borderRadius: 7, padding: '7px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{c.taskCount}</div>
                            <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Tarefas</div>
                          </div>
                        </div>

                        {/* Row 3: progress bar */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 10.5, color: '#6B7280' }}>Progresso geral</span>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: c.progress === 100 ? '#10B981' : cc.border }}>
                              {c.doneTaskCount}/{c.taskCount} tarefas · {c.progress}%
                            </span>
                          </div>
                          <div style={{ height: 5, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 99, background: c.progress === 100 ? '#10B981' : cc.border, width: c.progress + '%', transition: 'width .4s' }} />
                          </div>
                        </div>

                        {/* Row 4: budget if set */}
                        {c.totalBudget > 0 && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Orçamento</span>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: cc.border }}>
                              {c.totalBudget >= 1000000
                                ? `R$ ${(c.totalBudget / 1000000).toFixed(1)}M`
                                : `R$ ${(c.totalBudget / 1000).toFixed(0)}k`}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              /* LIST MODE */
              <div style={{ background: 'white', border: '1px solid #EAECF0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#2D2E39' }}>
                      {['Empresa', 'Criticidade', 'Projetos', 'Ativos', 'Tarefas', 'Progresso', ''].map((h, i) => (
                        <th key={i} style={{ textAlign: i >= 2 && i <= 5 ? 'right' : 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9CA3AF' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map(c => {
                      const cc = getCrit(c.criticality)
                      const isSel = selectedCompanyId === c.id
                      return (
                        <tr key={c.id}
                          onClick={() => setSelectedCompanyId(isSel ? null : c.id)}
                          style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: isSel ? '#F5F3FF' : 'white', transition: 'background .1s', borderLeft: `3px solid ${cc.border}` }}
                          onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#FAFBFF' }}
                          onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'white' }}
                        >
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 7, background: cc.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                {(c.name || '??').slice(0,2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{c.name || 'Sem nome'}</div>
                                {c.description && <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 1 }}>{c.description.slice(0,50)}{c.description.length > 50 ? '...' : ''}</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: cc.badge, color: cc.badgeText }}>
                              {cc.label}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{c.projectCount}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: cc.border }}>{c.activeProjectCount}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{c.taskCount}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                              <div style={{ width: 60, height: 5, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: c.progress + '%', background: c.progress === 100 ? '#10B981' : cc.border, borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: c.progress === 100 ? '#10B981' : '#374151', minWidth: 32 }}>{c.progress}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <ChevronRight style={{ width: 14, height: 14, color: '#D1D5DB' }} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Detail panel ── */}
          {selectedCompany && (() => {
            const cc = getCrit(selectedCompany.criticality)
            return (
              <div style={{ position: 'sticky', top: 0 }}>
                <div style={{ background: 'white', border: '1px solid #EAECF0', borderRadius: 12, overflow: 'hidden', borderTop: `3px solid ${cc.border}` }}>

                  {/* Header */}
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: cc.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                          {(selectedCompany.name || '??').slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{selectedCompany.name}</div>
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: cc.badge, color: cc.badgeText }}>{cc.label}</span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedCompanyId(null)}
                        style={{ background: '#F4F5F8', border: 'none', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
                        <X style={{ width: 12, height: 12 }} />
                      </button>
                    </div>

                    {selectedCompany.description && (
                      <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.5, background: '#F9FAFB', borderRadius: 7, padding: '7px 9px' }}>
                        {selectedCompany.description}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#F3F4F6' }}>
                    {[
                      { label: 'Projetos', value: selectedCompany.projectCount, color: '#111827' },
                      { label: 'Ativos',   value: selectedCompany.activeProjectCount, color: cc.border },
                      { label: 'Tarefas',  value: selectedCompany.taskCount, color: '#111827' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'white', padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 9.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Progresso geral</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cc.border }}>{selectedCompany.doneTaskCount}/{selectedCompany.taskCount} · {selectedCompany.progress}%</span>
                    </div>
                    <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: selectedCompany.progress + '%', background: selectedCompany.progress === 100 ? '#10B981' : cc.border, borderRadius: 99 }} />
                    </div>
                  </div>

                  {/* PowerBI link */}
                  {selectedCompany.powerbi_link && (
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid #F3F4F6' }}>
                      <a href={selectedCompany.powerbi_link} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: '#EEF2FF', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#5452C1', textDecoration: 'none' }}>
                        <TrendingUp style={{ width: 13, height: 13 }} />
                        Abrir dashboard Power BI
                        <ExternalLink style={{ width: 11, height: 11, marginLeft: 'auto' }} />
                      </a>
                    </div>
                  )}

                  {/* Projects list */}
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <FolderOpen style={{ width: 14, height: 14, color: '#5452C1' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                        Projetos ({selectedCompany.projects.length})
                      </span>
                    </div>
                    {selectedCompany.projects.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#9CA3AF' }}>Nenhum projeto cadastrado</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {selectedCompany.projects.map(p => {
                          const pc = projColor(p.id)
                          const isActive = !INACTIVE.includes(p.status || '')
                          return (
                            <div key={p.id} onClick={() => navigate('/timeline')}
                              style={{ background: '#F9FAFB', border: '1px solid #EAECF0', borderLeft: `3px solid ${pc}`, borderRadius: 8, padding: '9px 10px', cursor: 'pointer', transition: 'all .1s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.borderColor = '#DDD6FE' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#EAECF0'; e.currentTarget.style.borderLeftColor = pc }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.name || 'Sem nome'}
                                </div>
                                <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 99, background: isActive ? '#D1FAE5' : '#F3F4F6', color: isActive ? '#065F46' : '#6B7280', fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>
                                  {isActive ? 'Ativo' : p.status || '—'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {p.deadline && <span style={{ fontSize: 10, color: '#9CA3AF' }}>📅 {new Date(p.deadline).toLocaleDateString('pt-BR')}</span>}
                                {p.budget && <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>R$ {(p.budget/1000).toFixed(0)}k</span>}
                                {profMap[p.associate_id] && <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>{profMap[p.associate_id].full_name?.split(' ')[0]}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 10, color: '#D1D5DB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 24, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
          BX Hub v3 · Portfólio · {filteredCompanies.length} de {enrichedCompanies.length} empresas
        </div>
      </div>

    </div>
  )
}
