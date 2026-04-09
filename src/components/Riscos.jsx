import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Plus, X, Save, Trash2, Building2, FolderOpen, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

// risks table: id, org_id, project_id, company_id, title, description, probability, impact, category, status, mitigation, owner, created_at
// If risks table doesn't exist yet, we fall back gracefully

const PROB_LEVELS = ['Baixa', 'Média', 'Alta']
const IMPACT_LEVELS = ['Baixo', 'Médio', 'Alto']
const CATEGORIES = ['Financeiro', 'Operacional', 'Legal', 'Estratégico', 'Tecnologia', 'RH', 'Mercado']
const STATUS_OPTS = ['Identificado', 'Em mitigação', 'Aceito', 'Eliminado']

function riskScore(prob, impact) {
  const p = PROB_LEVELS.indexOf(prob) + 1
  const i = IMPACT_LEVELS.indexOf(impact) + 1
  return p * i
}

function riskColor(score) {
  if (score >= 7) return { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50 border-red-200', label: 'Crítico' }
  if (score >= 4) return { bg: 'bg-amber-400', text: 'text-amber-700', light: 'bg-amber-50 border-amber-200', label: 'Elevado' }
  if (score >= 2) return { bg: 'bg-yellow-300', text: 'text-yellow-700', light: 'bg-yellow-50 border-yellow-200', label: 'Moderado' }
  return { bg: 'bg-green-400', text: 'text-green-700', light: 'bg-green-50 border-green-200', label: 'Baixo' }
}

const EMPTY_RISK = { title: '', description: '', probability: 'Média', impact: 'Médio', category: 'Operacional', status: 'Identificado', mitigation: '', owner: '', company_id: '', project_id: '' }

export default function Riscos() {
  const { profile } = useData()
  const [risks, setRisks] = useState([])
  const [companies, setCompanies] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState(EMPTY_RISK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [risksRes, compRes, projRes] = await Promise.allSettled([
      supabase.from('risks').select('*').eq('org_id', profile.org_id).order('created_at', { ascending: false }),
      supabase.from('companies').select('id,name').eq('org_id', profile.org_id).order('name'),
      supabase.from('projects').select('id,name,company_id').eq('org_id', profile.org_id).order('name'),
    ])
    if (risksRes.status === 'fulfilled') {
      if (risksRes.value.error?.code === '42P01') { setTableError(true); setLoading(false); return }
      setRisks(risksRes.value.data || [])
    }
    if (compRes.status === 'fulfilled' && !compRes.value.error) setCompanies(compRes.value.data || [])
    if (projRes.status === 'fulfilled' && !projRes.value.error) setProjects(projRes.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const filtered = filterStatus === 'all' ? risks : risks.filter(r => r.status === filterStatus)

  async function saveRisk() {
    setSaving(true); setError(null)
    const payload = { ...form, org_id: profile.org_id, company_id: form.company_id || null, project_id: form.project_id || null }
    let err
    if (isNew) {
      const res = await supabase.from('risks').insert(payload)
      err = res.error
    } else {
      const res = await supabase.from('risks').update(form).eq('id', selected.id)
      err = res.error
    }
    if (err) { setError(err.message); setSaving(false); return }
    await load(); setSelected(null); setIsNew(false); setSaving(false)
  }

  async function deleteRisk(id) {
    if (!window.confirm('Excluir este risco?')) return
    await supabase.from('risks').delete().eq('id', id)
    setSelected(null); await load()
  }

  function openEdit(risk) { setSelected(risk); setIsNew(false); setForm({ ...risk }); setError(null) }
  function openNew() { setSelected(null); setIsNew(true); setForm(EMPTY_RISK); setError(null) }

  const companyName = (id) => companies.find(c => c.id === id)?.name || '—'

  // Matrix cells: impact x probability
  const matrixCells = IMPACT_LEVELS.slice().reverse().flatMap(impact =>
    PROB_LEVELS.map(prob => {
      const score = riskScore(prob, impact)
      const col = riskColor(score)
      const cellRisks = filtered.filter(r => r.probability === prob && r.impact === impact)
      return { prob, impact, score, col, cellRisks }
    })
  )

  if (tableError) return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-amber-800">Tabela `risks` não encontrada</div>
          <div className="text-sm text-amber-700 mt-1">Execute o script de migration para criar a tabela. Ver <code>docs/SCHEMA.md</code>.</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> Gestão de Riscos
            </div>
            <h1 className="text-2xl font-bold mb-1">Matriz de Riscos</h1>
            <p className="text-sm text-zinc-400">{risks.length} risco{risks.length !== 1 ? 's' : ''} mapeado{risks.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[['Crítico',9],['Elevado',6],['Moderado',2],['Baixo',1]].map(([label, minScore]) => {
              const count = risks.filter(r => {
                const s = riskScore(r.probability, r.impact)
                if (label === 'Crítico') return s >= 7
                if (label === 'Elevado') return s >= 4 && s < 7
                if (label === 'Moderado') return s >= 2 && s < 4
                return s < 2
              }).length
              const col = riskColor(label === 'Crítico' ? 9 : label === 'Elevado' ? 6 : label === 'Moderado' ? 3 : 1)
              return (
                <div key={label} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[70px]">
                  <div className={`text-lg font-bold ${label === 'Crítico' ? 'text-red-400' : label === 'Elevado' ? 'text-amber-400' : label === 'Moderado' ? 'text-yellow-300' : 'text-green-400'}`}>{count}</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* LEFT: Matrix + List */}
        <div className="flex-1 space-y-4">
          {/* Matrix */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Heatmap Probabilidade × Impacto</h2>
              <button onClick={openNew} className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">
                <Plus className="w-3 h-3" /> Novo risco
              </button>
            </div>
            <div className="flex gap-2">
              {/* Y axis label */}
              <div className="flex flex-col items-center justify-center w-6">
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 -rotate-90 whitespace-nowrap">Impacto ↑</span>
              </div>
              <div className="flex-1">
                {/* Matrix grid: 3 rows (impact) × 3 cols (prob) */}
                <div className="grid grid-rows-3 gap-1">
                  {IMPACT_LEVELS.slice().reverse().map(impact => (
                    <div key={impact} className="grid grid-cols-3 gap-1">
                      {PROB_LEVELS.map(prob => {
                        const score = riskScore(prob, impact)
                        const col = riskColor(score)
                        const cellRisks = filtered.filter(r => r.probability === prob && r.impact === impact)
                        return (
                          <div key={prob} className={`${col.bg} rounded-lg p-3 min-h-[80px] opacity-80 hover:opacity-100 transition-opacity cursor-default`}>
                            <div className="text-[9px] font-bold text-white uppercase tracking-wider mb-1">{impact} / {prob}</div>
                            <div className="space-y-1">
                              {cellRisks.map(r => (
                                <button key={r.id} onClick={() => openEdit(r)} className="w-full text-left bg-white/90 rounded text-[10px] font-semibold text-zinc-800 px-2 py-0.5 truncate hover:bg-white transition-colors">
                                  {r.title}
                                </button>
                              ))}
                            </div>
                            {cellRisks.length === 0 && <div className="text-[9px] text-white/40">—</div>}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                {/* X axis */}
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {PROB_LEVELS.map(p => <div key={p} className="text-center text-[9px] font-bold uppercase tracking-wider text-zinc-500">{p}</div>)}
                </div>
                <div className="text-center text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">Probabilidade →</div>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Todos os Riscos</h2>
              <select className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">Todos os status</option>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-400">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <AlertTriangle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <div className="text-xs text-zinc-500">Nenhum risco encontrado</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-100">
                    <th className="px-5 py-2 font-bold">Risco</th>
                    <th className="px-4 py-2 font-bold">Empresa</th>
                    <th className="px-4 py-2 font-bold">Categoria</th>
                    <th className="px-4 py-2 font-bold">Severidade</th>
                    <th className="px-4 py-2 font-bold">Status</th>
                    <th className="px-4 py-2 font-bold">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map(r => {
                    const score = riskScore(r.probability, r.impact)
                    const col = riskColor(score)
                    return (
                      <tr key={r.id} onClick={() => openEdit(r)} className="hover:bg-zinc-50 cursor-pointer transition-colors">
                        <td className="px-5 py-3 font-semibold text-zinc-800">{r.title}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{companyName(r.company_id)}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{r.category}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${col.light} ${col.text}`}>{col.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-600">{r.status}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600">{r.owner || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT: Form panel */}
        {(isNew || selected) && (
          <div className="w-96 shrink-0 bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-800">{isNew ? 'Novo Risco' : 'Editar Risco'}</h3>
              <button onClick={() => { setSelected(null); setIsNew(false) }} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Título *</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Descrição</label>
                <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" rows={3} value={form.description || ''} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Probabilidade</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.probability} onChange={e => setForm(p => ({...p, probability: e.target.value}))}>
                    {PROB_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Impacto</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.impact} onChange={e => setForm(p => ({...p, impact: e.target.value}))}>
                    {IMPACT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
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
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Mitigação</label>
                <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" rows={3} value={form.mitigation || ''} onChange={e => setForm(p => ({...p, mitigation: e.target.value}))} placeholder="Ações de mitigação…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Empresa</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.company_id || ''} onChange={e => setForm(p => ({...p, company_id: e.target.value}))}>
                    <option value="">— nenhuma —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Responsável</label>
                  <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.owner || ''} onChange={e => setForm(p => ({...p, owner: e.target.value}))} placeholder="Nome…" />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-100 flex items-center gap-3">
              <button onClick={saveRisk} disabled={saving || !form.title.trim()} className="flex items-center gap-1.5 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" />{saving ? 'Salvando…' : 'Salvar'}
              </button>
              {!isNew && (
                <button onClick={() => deleteRisk(selected.id)} className="text-zinc-400 hover:text-red-500 p-2 rounded transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
