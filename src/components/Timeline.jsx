import React, { useState, useEffect, useCallback } from 'react'
import { GitBranch, Calendar, ChevronRight, AlertCircle, Building2, User, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

const STATUS_MAP = {
  'active': { label: 'Ativo', color: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
  'Em andamento': { label: 'Em andamento', color: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' },
  'Planejamento': { label: 'Planejamento', color: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  'concluido': { label: 'Concluído', color: 'bg-zinc-100 text-zinc-600', bar: 'bg-zinc-400' },
  'pausado': { label: 'Pausado', color: 'bg-red-100 text-red-700', bar: 'bg-red-400' },
}

function normStatus(s) {
  return STATUS_MAP[s] || { label: s || 'N/D', color: 'bg-zinc-100 text-zinc-600', bar: 'bg-zinc-400' }
}

function progressPct(p) {
  const n = parseInt(p, 10)
  return isNaN(n) ? 0 : Math.min(100, Math.max(0, n))
}

function daysUntil(d) {
  if (!d) return null
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000)
  return diff
}

function daysLabel(d) {
  const n = daysUntil(d)
  if (n === null) return ''
  if (n < 0) return `${Math.abs(n)}d atrasado`
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

// Gantt bar calculator: given start/end of ALL projects, place each bar
function ganttBar(project, minDate, totalDays) {
  const deadline = project.deadline ? new Date(project.deadline) : null
  // Estimate start = deadline - 90 days if no start field
  const start = deadline ? new Date(deadline.getTime() - 90 * 86400000) : new Date()
  const end = deadline || new Date(start.getTime() + 90 * 86400000)
  const left = Math.max(0, Math.round((start - minDate) / 86400000 / totalDays * 100))
  const width = Math.max(2, Math.min(100 - left, Math.round((end - start) / 86400000 / totalDays * 100)))
  return { left, width }
}

export default function Timeline() {
  const { profile } = useData()
  const [projects, setProjects] = useState([])
  const [companies, setCompanies] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [view, setView] = useState('gantt') // gantt | list

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [projRes, compRes, profRes] = await Promise.allSettled([
      supabase.from('projects').select('*').eq('org_id', profile.org_id).order('deadline', { ascending: true }),
      supabase.from('companies').select('id,name,color').eq('org_id', profile.org_id),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
    ])
    if (projRes.status === 'fulfilled' && !projRes.value.error) setProjects(projRes.value.data || [])
    if (compRes.status === 'fulfilled' && !compRes.value.error) setCompanies(compRes.value.data || [])
    if (profRes.status === 'fulfilled' && !profRes.value.error) setProfilesList(profRes.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const companyName = (id) => companies.find(c => c.id === id)?.name || '—'
  const analystName = (id) => profiles.find(p => p.id === id)?.full_name || '—'

  const filtered = projects.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const matchCompany = filterCompany === 'all' || p.company_id === filterCompany
    return matchStatus && matchCompany
  })

  // Gantt date range
  const now = new Date()
  const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 5, 1)
  const totalDays = Math.ceil((maxDate - minDate) / 86400000)

  // Month labels for Gantt header
  const months = []
  const d = new Date(minDate)
  while (d < maxDate) {
    months.push({ label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), pct: Math.round((d - minDate) / 86400000 / totalDays * 100) })
    d.setMonth(d.getMonth() + 1)
  }

  const statuses = [...new Set(projects.map(p => p.status).filter(Boolean))]

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <GitBranch className="w-3 h-3" /> Gestão de Projetos
            </div>
            <h1 className="text-2xl font-bold mb-1">Timeline</h1>
            <p className="text-sm text-zinc-400">{projects.length} projeto{projects.length !== 1 ? 's' : ''} · visão temporal</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[['active','Em andamento'],['Planejamento','Planejamento'],['concluido','Concluído']].map(([key, label]) => (
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

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <button onClick={() => setView('gantt')} className={`px-4 py-2 text-sm font-semibold transition-colors ${view === 'gantt' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>Gantt</button>
          <button onClick={() => setView('list')} className={`px-4 py-2 text-sm font-semibold transition-colors ${view === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>Lista</button>
        </div>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todos os status</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="all">Todas as empresas</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-400">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <GitBranch className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <div className="text-sm font-semibold text-zinc-500">Nenhum projeto encontrado</div>
        </div>
      ) : view === 'gantt' ? (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {/* Gantt grid */}
          <div className="flex">
            {/* Project list col */}
            <div className="w-72 shrink-0 border-r border-zinc-200">
              <div className="px-4 py-3 bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider">Projeto</div>
              {filtered.map(p => (
                <div key={p.id} className="px-4 py-3 border-b border-zinc-100 h-14 flex flex-col justify-center">
                  <div className="text-sm font-semibold text-zinc-800 truncate">{p.name}</div>
                  <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3" />{companyName(p.company_id)}
                  </div>
                </div>
              ))}
            </div>
            {/* Gantt bars col */}
            <div className="flex-1 overflow-x-auto">
              {/* Month header */}
              <div className="relative h-9 border-b border-zinc-200 bg-zinc-50">
                {months.map((m, i) => (
                  <div key={i} className="absolute top-0 bottom-0 flex items-center" style={{ left: `${m.pct}%` }}>
                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider pl-2">{m.label}</div>
                    <div className="absolute left-0 top-0 bottom-0 border-l border-zinc-200" />
                  </div>
                ))}
                {/* Today marker */}
                <div className="absolute top-0 bottom-0 border-l-2 border-violet-500 z-10" style={{ left: `${Math.round((now - minDate) / 86400000 / totalDays * 100)}%` }}>
                  <div className="absolute -top-0 -left-3 text-[9px] font-bold text-violet-600 bg-violet-100 px-1 rounded">Hoje</div>
                </div>
              </div>
              {/* Bars */}
              {filtered.map(p => {
                const { left, width } = ganttBar(p, minDate, totalDays)
                const st = normStatus(p.status)
                const pct = progressPct(p.progress)
                return (
                  <div key={p.id} className="relative h-14 border-b border-zinc-100 flex items-center px-2">
                    {/* Grid lines */}
                    {months.map((m, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-100" style={{ left: `${m.pct}%` }} />
                    ))}
                    {/* Today line */}
                    <div className="absolute top-0 bottom-0 border-l border-violet-300 border-dashed z-10" style={{ left: `${Math.round((now - minDate) / 86400000 / totalDays * 100)}%` }} />
                    {/* Bar */}
                    <div className="absolute h-7 rounded-md overflow-hidden z-20" style={{ left: `${left}%`, width: `${width}%`, minWidth: 60 }}>
                      <div className="absolute inset-0 bg-zinc-700 opacity-90 rounded-md" />
                      <div className={`absolute inset-y-0 left-0 rounded-md ${st.bar}`} style={{ width: `${pct}%`, opacity: 0.6 }} />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-white text-[10px] font-bold truncate">{pct}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Deadline col */}
            <div className="w-28 shrink-0 border-l border-zinc-200">
              <div className="px-3 py-3 bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider">Prazo</div>
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
        /* LIST VIEW */
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800 text-white text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-bold">Projeto</th>
                <th className="text-left px-4 py-3 font-bold">Empresa</th>
                <th className="text-left px-4 py-3 font-bold">Analista</th>
                <th className="text-left px-4 py-3 font-bold">Status</th>
                <th className="text-left px-4 py-3 font-bold w-40">Progresso</th>
                <th className="text-left px-4 py-3 font-bold">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(p => {
                const st = normStatus(p.status)
                const pct = progressPct(p.progress)
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-zinc-800">{p.name}</td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">{companyName(p.company_id)}</td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">{analystName(p.analyst_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-zinc-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${st.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-zinc-500 w-8 text-right">{pct}%</span>
                      </div>
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
    </div>
  )
}
