import React, { useState, useEffect, useCallback } from 'react'
import GaugeChart from './GaugeChart'
import { AlertTriangle, Plus, X, Save, Trash2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'

const CH = '#2D2E39', VL = '#5452C1'
const GREEN = '#10B981', AMBER = '#F59E0B', RED = '#EF4444', BLUE = '#3B82F6'

// Score: probabilidade (1-5) × impacto (1-5) = max 25
function riskScore(p, i) { return (p || 3) * (i || 3) }
function riskLevel(score) {
  if (score >= 16) return { label: 'Crítico', color: RED, bg: '#FEF2F2', icon: '🔴' }
  if (score >= 10) return { label: 'Alto',    color: AMBER, bg: '#FFFBEB', icon: '🟠' }
  if (score >= 5)  return { label: 'Médio',   color: BLUE, bg: '#EFF6FF', icon: '🟡' }
  return              { label: 'Baixo',   color: GREEN, bg: '#F0FDF4', icon: '🟢' }
}

const CATEGORIES = ['Financeiro','Operacional','Legal','Estratégico','Tecnologia','RH','Mercado','Compliance']
const STATUS_OPTS = ['open','mitigated','closed']
const STATUS_LABELS = { open: 'Aberto', mitigated: 'Em Mitigação', closed: 'Fechado' }
const EMPTY = { name: '', probability: 3, impact: 3, status: 'open', mitigation: '', mitigation_due: '', owner_id: '', project_id: '' }

// Heatmap 5×5
const HEAT_CELLS = []
for (let imp = 5; imp >= 1; imp--) {
  for (let prob = 1; prob <= 5; prob++) {
    HEAT_CELLS.push({ prob, imp, score: prob * imp })
  }
}
function heatColor(score) {
  if (score >= 16) return `${RED}CC`
  if (score >= 10) return `${AMBER}CC`
  if (score >= 5)  return `${BLUE}88`
  return `${GREEN}66`
}

export default function Riscos() {
  const { profile } = useData()
  usePageTitle('Riscos')
  const [risks, setRisks] = useState([])
  const [projects, setProjects] = useState([])
  const [profiles, setProfiles] = useState([])
  const profMap = Object.fromEntries(profiles.map(p => [p.id, p]))
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [filterProject, setFilterProject] = useState('all')
  const [search,        setSearch]        = useState('')
  const [tab, setTab] = useState('matrix') // matrix | list

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    setLoading(true)
    try {
      const [risksR, projR, profR] = await Promise.allSettled([
        supabase.from('risks').select('*').eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(200),
        supabase.from('projects').select('id,name').eq('org_id', profile.org_id).eq('is_archived', false).order('name'),
        supabase.from('profiles').select('id,full_name').eq('org_id', profile.org_id).order('full_name'),
      ])
      if (risksR.status === 'fulfilled') {
        if (risksR.value.error?.code === '42P01') { setTableError(true); return }
        setRisks(risksR.value.data || [])
      }
      if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
      if (profR.status === 'fulfilled' && !profR.value.error) setProfiles(profR.value.data || [])
    } catch (err) { console.error('[Riscos] load:', err.message) }
    finally { setLoading(false) }
  }, [profile])

  useEscapeKey(() => { setSelected(null); setIsNew(false) }, !!(selected))
  useEffect(() => { load() }, [load])

  const openRisks = risks.filter(r => r.status !== 'closed')
  const totalExposure = openRisks.reduce((s, r) => s + riskScore(r.probability, r.impact), 0)
  const maxExposure = openRisks.length * 25
  const exposurePct = maxExposure > 0 ? Math.round(totalExposure / maxExposure * 100) : 0
  const exposureColor = exposurePct >= 70 ? RED : exposurePct >= 40 ? AMBER : GREEN
  const exposureLabel = exposurePct >= 70 ? 'EXPOSIÇÃO ALTA' : exposurePct >= 40 ? 'ATENÇÃO NECESSÁRIA' : 'SOB CONTROLE'

  const critical = openRisks.filter(r => riskScore(r.probability, r.impact) >= 16)
  const high     = openRisks.filter(r => { const s = riskScore(r.probability, r.impact); return s >= 10 && s < 16 })
  const medium   = openRisks.filter(r => { const s = riskScore(r.probability, r.impact); return s >= 5 && s < 10 })
  const low      = openRisks.filter(r => riskScore(r.probability, r.impact) < 5)

  const filtered = risks.filter(r => {
    const matchStatus  = filterStatus  === 'all' || r.status     === filterStatus
    const matchProject = filterProject === 'all' || r.project_id === filterProject
    const matchSearch  = !search.trim() ||
      (r.title       || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.owner       || '').toLowerCase().includes(search.toLowerCase()) ||
      (profMap[r.owner_id]?.full_name || '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchProject && matchSearch
  })
  const projMap = {}
  projects.forEach(p => { projMap[p.id] = p })

  async function saveRisk() {
    setSaving(true); setError(null)
    // B-12: campos explícitos — não enviar id/org_id/created_at/created_by no update
    const safe = {
      name: form.name,
      probability: parseInt(form.probability) || 3,
      impact: parseInt(form.impact) || 3,
      status: form.status,
      mitigation: form.mitigation || null,
      owner_id: form.owner_id || null,
      project_id: form.project_id || null,
    }
    const { error: err } = isNew
      ? await supabase.from('risks').insert({ ...safe, org_id: profile.org_id })
      : await supabase.from('risks').update(safe).eq('id', selected.id).eq('org_id', profile.org_id)
    if (err) { setError(err.message); setSaving(false); return }
    await load(); setSelected(null); setIsNew(false); setSaving(false)
  }

  async function deleteRisk(id) {
    if (!await confirm('Excluir este risco?', { danger: true, confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return
    const { error } = await supabase.from('risks').delete().eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao excluir risco: ' + error.message); return }
    setSelected(null); await load()
  }

  function openEdit(risk) {
    setSelected(risk); setIsNew(false)
    setForm({
      name: risk.name || '',
      probability: risk.probability || 3,
      impact: risk.impact || 3,
      status: risk.status || 'open',
      mitigation: risk.mitigation || '',
      mitigation_due: risk.mitigation_due ? risk.mitigation_due.slice(0, 10) : '',
      owner_id: risk.owner_id || '',
      project_id: risk.project_id || '',
    })
    setError(null)
  }
  function openNew() { setSelected(null); setIsNew(true); setForm(EMPTY); setError(null) }

  if (tableError) return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-amber-800">Tabela `risks` não encontrada</div>
          <div className="text-sm text-amber-700 mt-1">Execute o script de migration. Ver <code>docs/SCHEMA.md</code>.</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-[1600px] mx-auto font-['Montserrat',system-ui,sans-serif]">
      {/* Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white relative overflow-hidden" style={{ background: CH }}>
        <div className="absolute top-[-30px] right-[-30px] w-48 h-48 rounded-full" style={{ background: `radial-gradient(circle, ${VL}33 0%, transparent 70%)` }} />
        <div className="flex items-start justify-between flex-wrap gap-4 relative z-10">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> Gestão de Riscos
            </div>
            <h1 className="text-2xl font-bold mb-1">Central de Riscos</h1>
            <p className="text-sm text-zinc-400">Monitoramento inteligente — {openRisks.length} risco{openRisks.length !== 1 ? 's' : ''} ativo{openRisks.length !== 1 ? 's' : ''}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: `${exposureColor}22`, color: exposureColor }}>
                {exposurePct >= 70 ? '⚠️' : exposurePct >= 40 ? '🔔' : '✅'} {exposureLabel}
              </span>
              <button onClick={openNew} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:-translate-y-0.5" style={{ background: VL }}>
                <Plus className="w-3.5 h-3.5" /> Novo Risco
              </button>
            </div>
          </div>
          {/* Gauge de exposição */}
          <div className="flex items-center justify-center">
            <GaugeChart
              value={exposurePct}
              pct={exposurePct}
              suffix="%"
              label="exposição"
              color={exposureColor}
              size="sm"
              dark={true}
            />
          </div>
        </div>
        {/* KPIs */}
        <div className="flex gap-3 mt-4 flex-wrap">
          {[
            { icon: '🔴', label: 'Crítico', count: critical.length, color: RED },
            { icon: '🟠', label: 'Alto', count: high.length, color: AMBER },
            { icon: '🟡', label: 'Médio', count: medium.length, color: BLUE },
            { icon: '🟢', label: 'Baixo', count: low.length, color: GREEN },
            { icon: '✅', label: 'Fechados', count: risks.filter(r => r.status === 'closed').length, color: '#9CA3AF' },
          ].map(k => (
            <div key={k.label} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[70px]">
              <div className="text-lg font-bold" style={{ color: k.color }}>{k.count}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{k.icon} {k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Alertas inteligentes */}
      {critical.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">🚨 Alertas Inteligentes</div>
          {critical.slice(0, 3).map(r => (
            <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50 mb-2">
              <span className="text-lg">🔴</span>
              <div>
                <strong className="text-sm" style={{ color: RED }}>RISCO CRÍTICO</strong> — <span className="text-sm text-zinc-800">{r.name || 'Sem nome'}</span>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {projMap[r.project_id]?.name && `Projeto: ${projMap[r.project_id].name} · `}
                  Score: {riskScore(r.probability, r.impact)}/25 · Prob: {r.probability} × Impacto: {r.impact}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4">
        {/* Main content */}
        <div className="flex-1">
          {/* Tabs enriquecidas */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex bg-zinc-100 rounded-lg p-1 gap-1">
              {[
                { id: 'matrix', label: 'Matriz 5×5', count: null },
                { id: 'list',   label: 'Lista', count: filtered.length },
                { id: 'critico', label: '🔴 Críticos', count: critical.length },
                { id: 'alto',    label: '🟡 Altos', count: high.length },
                { id: 'vencendo',label: '⏰ Vencendo', count: risks.filter(r => r.mitigation_due && new Date(r.mitigation_due) < new Date(Date.now() + 7*86400000) && r.status !== 'closed').length },
                { id: 'closed',  label: '✅ Fechados', count: risks.filter(r => r.status === 'closed').length },
              ].map(t => {
                const on = tab === t.id
                return (
                  <button key={t.id} onClick={() => { setTab(t.id); if (['critico','alto','vencendo','closed'].includes(t.id)) setFilterStatus('all') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                      fontSize: 12, fontWeight: on ? 600 : 500, borderRadius: 7,
                      cursor: 'pointer', whiteSpace: 'nowrap', outline: 'none', border: 'none',
                      background: on ? '#2D2E39' : 'transparent',
                      color: on ? 'white' : '#6B7280',
                      transition: 'all .12s',
                    }}>
                    {t.label}
                    {t.count !== null && (
                      <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 99, background: on ? 'rgba(255,255,255,.15)' : '#EAECF0', color: on ? 'white' : '#6B7280' }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              placeholder="Buscar risco…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-violet-500 w-48"
            />
            <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Todos os status</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="all">Todos os projetos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {(filterStatus !== 'all' || filterProject !== 'all' || search) && (
              <button
                onClick={() => { setFilterStatus('all'); setFilterProject('all'); setSearch('') }}
                className="flex items-center gap-1 text-xs font-semibold text-rose-600 border border-rose-200 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 whitespace-nowrap"
              >
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>

          {loading ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-400">Carregando…</div>
          ) : tab === 'matrix' ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <div className="flex gap-4">
                <div className="flex flex-col items-center justify-center w-6 shrink-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 -rotate-90 whitespace-nowrap">Impacto ↑</span>
                </div>
                <div className="flex-1">
                  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    {HEAT_CELLS.map(({ prob, imp, score }, i) => {
                      const cellRisks = filtered.filter(r => r.probability === prob && r.impact === imp)
                      return (
                        <div key={i} className="rounded-lg p-2 min-h-[70px] cursor-default transition-opacity hover:opacity-100 opacity-85" style={{ background: heatColor(score) }}>
                          <div className="text-[8px] font-bold text-white uppercase tracking-wider mb-1 opacity-80">P{prob}×I{imp}</div>
                          {cellRisks.map(r => (
                            <button key={r.id} onClick={() => openEdit(r)} className="w-full text-left bg-white/90 hover:bg-white rounded text-[10px] font-semibold px-1.5 py-0.5 truncate mb-0.5 text-zinc-800 transition-colors">
                              {r.name || 'Sem nome'}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                  <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    {[1,2,3,4,5].map(p => <div key={p} className="text-center text-[9px] font-bold uppercase tracking-wider text-zinc-400">P{p}</div>)}
                  </div>
                  <div className="text-center text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">Probabilidade →</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <AlertTriangle className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                  <div className="text-sm text-zinc-500">Nenhum risco encontrado</div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="bg-zinc-800 text-white text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-bold">Risco</th>
                    <th className="text-left px-4 py-3 font-bold">Projeto</th>
                    <th className="text-left px-4 py-3 font-bold">Responsável</th>
                    <th className="text-left px-4 py-3 font-bold">Score</th>
                    <th className="text-left px-4 py-3 font-bold">Nível</th>
                    <th className="text-left px-4 py-3 font-bold">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filtered.map(r => {
                      const score = riskScore(r.probability, r.impact)
                      const lvl = riskLevel(score)
                      return (
                        <tr key={r.id} onClick={() => openEdit(r)} className="hover:bg-zinc-50 cursor-pointer transition-colors">
                          <td className="px-5 py-3 font-semibold text-zinc-800">{r.name || '—'}</td>
                          <td className="px-4 py-3 text-zinc-500 text-xs">{projMap[r.project_id]?.name || '—'}</td>
                          <td className="px-4 py-3 text-xs text-zinc-600">{profMap[r.owner_id]?.full_name || '—'}</td>
                          <td className="px-4 py-3 text-xs text-zinc-600">
                            {r.mitigation_due ? (
                              <span className={new Date(r.mitigation_due) < new Date() ? 'text-red-500 font-semibold' : 'text-zinc-600'}>
                                {new Date(r.mitigation_due).toLocaleDateString('pt-BR')}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 font-bold text-zinc-700">{score}/25</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ background: lvl.bg, color: lvl.color, borderColor: `${lvl.color}40` }}>
                              {lvl.icon} {lvl.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-600">{STATUS_LABELS[r.status] || r.status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Form panel */}
        {(isNew || selected) && (
          <div className="w-96 shrink-0 bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-800">{isNew ? 'Novo Risco' : 'Editar Risco'}</h3>
              <button onClick={() => { setSelected(null); setIsNew(false) }} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nome *</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.name || ''} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
              </div>
              {/* Descrição removida — campo não existe no banco */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Probabilidade (1-5)</label>
                  <input type="range" min="1" max="5" className="w-full" value={form.probability} onChange={e => setForm(p => ({...p, probability: parseInt(e.target.value)}))} />
                  <div className="text-center text-xs font-bold text-violet-600">{form.probability}</div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Impacto (1-5)</label>
                  <input type="range" min="1" max="5" className="w-full" value={form.impact} onChange={e => setForm(p => ({...p, impact: parseInt(e.target.value)}))} />
                  <div className="text-center text-xs font-bold text-violet-600">{form.impact}</div>
                </div>
              </div>
              {/* Score display */}
              <div className="p-3 rounded-lg text-center" style={{ background: riskLevel(riskScore(form.probability, form.impact)).bg }}>
                <div className="text-lg font-bold" style={{ color: riskLevel(riskScore(form.probability, form.impact)).color }}>
                  {riskLevel(riskScore(form.probability, form.impact)).icon} {riskLevel(riskScore(form.probability, form.impact)).label}
                </div>
                <div className="text-xs text-zinc-500">Score: {riskScore(form.probability, form.impact)}/25</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Categoria</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Status</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Projeto</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.project_id || ''} onChange={e => setForm(p => ({...p, project_id: e.target.value}))}>
                  <option value="">— nenhum —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Responsável</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.owner_id || ''} onChange={e => setForm(p => ({...p, owner_id: e.target.value}))}>
                  <option value="">— nenhum —</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Mitigação</label>
                <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" rows={3} value={form.mitigation || ''} onChange={e => setForm(p => ({...p, mitigation: e.target.value}))} placeholder="Ações de mitigação..." />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Prazo de mitigação</label>
                <input type="date" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={form.mitigation_due || ''} onChange={e => setForm(p => ({...p, mitigation_due: e.target.value}))} />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-100 flex items-center gap-3">
              <button onClick={saveRisk} disabled={saving || !form.name?.trim()} className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors" style={{ background: VL }}>
                <Save className="w-4 h-4" />{saving ? 'Salvando…' : 'Salvar'}
              </button>
              {!isNew && <button onClick={() => deleteRisk(selected.id)} className="text-zinc-400 hover:text-red-500 p-2 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
