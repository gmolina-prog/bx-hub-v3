import React, { useState, useEffect, useCallback } from 'react'
import { Receipt, Plus, X, Save, Trash2, ChevronDown, ChevronRight, AlertCircle, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

const STATUS_MAP = {
  rascunho: { label: 'Rascunho', color: 'bg-zinc-100 text-zinc-600', next: 'submetido' },
  submetido: { label: 'Submetido', color: 'bg-amber-100 text-amber-700', next: 'aprovado' },
  aprovado:  { label: 'Aprovado',  color: 'bg-green-100 text-green-700', next: 'pago' },
  pago:      { label: 'Pago',      color: 'bg-blue-100 text-blue-700',   next: null },
  reprovado: { label: 'Reprovado', color: 'bg-red-100 text-red-700',     next: null },
}

const CATEGORIES = [
  { value: 'transporte', label: 'Transporte' },
  { value: 'refeicao',   label: 'Refeição' },
  { value: 'material',   label: 'Material' },
  { value: 'hospedagem', label: 'Hospedagem' },
  { value: 'outros',     label: 'Outros' },
]

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, color: 'bg-zinc-100 text-zinc-600' }
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${s.color}`}>{s.label}</span>
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}

const EMPTY_REPORT = { title: '', status: 'rascunho' }
const EMPTY_ITEM = { category: 'refeicao', description: '', value: '', date: '' }

export default function Reembolsos() {
  const { profile } = useData()
  const [reports, setReports] = useState([])
  const [items, setItems] = useState({})        // { reportId: [...items] }
  const [expanded, setExpanded] = useState({})  // { reportId: bool }
  const [profiles, setProfilesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showNewReport, setShowNewReport] = useState(false)
  const [newReport, setNewReport] = useState(EMPTY_REPORT)
  const [addingItem, setAddingItem] = useState(null)  // reportId
  const [newItem, setNewItem] = useState(EMPTY_ITEM)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [repRes, profRes] = await Promise.allSettled([
      supabase.from('expense_reports').select('*').eq('org_id', profile.org_id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
    ])
    let reps = []
    if (repRes.status === 'fulfilled' && !repRes.value.error) reps = repRes.value.data || []
    if (profRes.status === 'fulfilled' && !profRes.value.error) setProfilesList(profRes.value.data || [])
    setReports(reps)

    // Load items for all reports
    if (reps.length > 0) {
      const ids = reps.map(r => r.id)
      const { data: itemData } = await supabase.from('expense_items').select('*').in('expense_report_id', ids)
      const grouped = {}
      ids.forEach(id => { grouped[id] = [] })
      ;(itemData || []).forEach(it => {
        if (grouped[it.expense_report_id]) grouped[it.expense_report_id].push(it)
      })
      setItems(grouped)
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  async function createReport() {
    if (!newReport.title.trim()) return
    setSaving(true)
    const { error: err } = await supabase.from('expense_reports').insert({
      org_id: profile.org_id, user_id: profile.id,
      title: newReport.title, status: 'rascunho', total_value: 0,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setShowNewReport(false); setNewReport(EMPTY_REPORT)
    await load(); setSaving(false)
  }

  async function deleteReport(id) {
    if (!window.confirm('Excluir este relatório e todos os seus itens?')) return
    await supabase.from('expense_items').delete().eq('expense_report_id', id)
    await supabase.from('expense_reports').delete().eq('id', id)
    await load()
  }

  async function updateStatus(report, nextStatus) {
    if (!nextStatus) return
    const { error: err } = await supabase.from('expense_reports').update({ status: nextStatus }).eq('id', report.id)
    if (err) { setError(err.message); return }
    await load()
  }

  async function addItem(reportId) {
    if (!newItem.description.trim() || !newItem.value) return
    setSaving(true)
    const value = parseFloat(newItem.value.replace(',', '.'))
    const { error: err } = await supabase.from('expense_items').insert({
      expense_report_id: reportId,
      category: newItem.category,
      description: newItem.description,
      value,
      date: newItem.date || new Date().toISOString().split('T')[0],
    })
    if (err) { setError(err.message); setSaving(false); return }
    // Recalc total
    const reportItems = [...(items[reportId] || []), { value }]
    const total = reportItems.reduce((acc, it) => acc + (parseFloat(it.value) || 0), 0)
    await supabase.from('expense_reports').update({ total_value: total }).eq('id', reportId)
    setAddingItem(null); setNewItem(EMPTY_ITEM)
    await load(); setSaving(false)
  }

  async function deleteItem(reportId, itemId) {
    await supabase.from('expense_items').delete().eq('id', itemId)
    const remaining = (items[reportId] || []).filter(it => it.id !== itemId)
    const total = remaining.reduce((acc, it) => acc + (parseFloat(it.value) || 0), 0)
    await supabase.from('expense_reports').update({ total_value: total }).eq('id', reportId)
    await load()
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filtered = filterStatus === 'all' ? reports : reports.filter(r => r.status === filterStatus)
  const profileName = (id) => profiles.find(p => p.id === id)?.full_name || '—'
  const totalPendente = reports.filter(r => r.status === 'submetido').reduce((acc, r) => acc + (parseFloat(r.total_value) || 0), 0)

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <Receipt className="w-3 h-3" /> Despesas
            </div>
            <h1 className="text-2xl font-bold mb-1">Reembolsos</h1>
            <p className="text-sm text-zinc-400">{reports.length} relatório{reports.length !== 1 ? 's' : ''} · {fmtBRL(totalPendente)} pendente de aprovação</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(STATUS_MAP).map(([key, s]) => (
              <div key={key} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[70px]">
                <div className="text-lg font-bold text-violet-300">{reports.filter(r => r.status === key).length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setShowNewReport(true)} className="ml-auto flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" /> Novo relatório
        </button>
      </div>

      {/* New report form */}
      {showNewReport && (
        <div className="bg-white border border-violet-200 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-800">Novo Relatório de Reembolso</h3>
            <button onClick={() => setShowNewReport(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-3">
            <input className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" placeholder="Título do relatório (ex: Viagem São Paulo Abr/2026)" value={newReport.title} onChange={e => setNewReport(p => ({...p, title: e.target.value}))} />
            <button onClick={createReport} disabled={saving || !newReport.title.trim()} className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
              <Plus className="w-4 h-4" />{saving ? 'Criando…' : 'Criar'}
            </button>
            <button onClick={() => setShowNewReport(false)} className="text-sm text-zinc-500 px-3 py-2">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-400">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <Receipt className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <div className="text-sm font-semibold text-zinc-500">Nenhum relatório encontrado</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(report => {
            const repItems = items[report.id] || []
            const isExpanded = expanded[report.id]
            const st = STATUS_MAP[report.status] || STATUS_MAP.rascunho
            return (
              <div key={report.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                {/* Report header */}
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-zinc-50 transition-colors" onClick={() => toggleExpand(report.id)}>
                  <button className="text-zinc-400 shrink-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-zinc-800">{report.title}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{profileName(report.user_id)} · {repItems.length} item{repItems.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-zinc-800">{fmtBRL(report.total_value)}</div>
                    <div className="mt-0.5"><StatusBadge status={report.status} /></div>
                  </div>
                  {st.next && (
                    <button
                      onClick={e => { e.stopPropagation(); updateStatus(report, st.next) }}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-violet-600 border border-violet-200 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Check className="w-3 h-3" />{STATUS_MAP[st.next]?.label}
                    </button>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteReport(report.id) }} className="text-zinc-300 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Items */}
                {isExpanded && (
                  <div className="border-t border-zinc-100">
                    {repItems.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 bg-zinc-50">
                            <th className="px-5 py-2 font-bold">Categoria</th>
                            <th className="px-4 py-2 font-bold">Descrição</th>
                            <th className="px-4 py-2 font-bold">Data</th>
                            <th className="px-4 py-2 font-bold text-right">Valor</th>
                            <th className="px-4 py-2 w-8" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {repItems.map(item => {
                            const cat = CATEGORIES.find(c => c.value === item.category)
                            return (
                              <tr key={item.id} className="hover:bg-zinc-50">
                                <td className="px-5 py-2.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">{cat?.label || item.category}</span>
                                </td>
                                <td className="px-4 py-2.5 text-zinc-700">{item.description}</td>
                                <td className="px-4 py-2.5 text-zinc-500 text-xs">{item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '—'}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-zinc-800">{fmtBRL(item.value)}</td>
                                <td className="px-4 py-2.5">
                                  <button onClick={() => deleteItem(report.id, item.id)} className="text-zinc-300 hover:text-red-400 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                            <td colSpan={3} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-600">Total</td>
                            <td className="px-4 py-2.5 text-right font-bold text-zinc-900">{fmtBRL(report.total_value)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    )}

                    {/* Add item */}
                    {addingItem === report.id ? (
                      <div className="px-5 py-4 bg-violet-50 border-t border-violet-100">
                        <div className="grid grid-cols-5 gap-3 mb-3">
                          <select className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-violet-500" value={newItem.category} onChange={e => setNewItem(p => ({...p, category: e.target.value}))}>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <input className="col-span-2 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" placeholder="Descrição *" value={newItem.description} onChange={e => setNewItem(p => ({...p, description: e.target.value}))} />
                          <input type="date" className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={newItem.date} onChange={e => setNewItem(p => ({...p, date: e.target.value}))} />
                          <input className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" placeholder="Valor (R$) *" value={newItem.value} onChange={e => setNewItem(p => ({...p, value: e.target.value}))} />
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => addItem(report.id)} disabled={saving || !newItem.description.trim() || !newItem.value} className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                            <Plus className="w-3 h-3" />{saving ? 'Adicionando…' : 'Adicionar item'}
                          </button>
                          <button onClick={() => { setAddingItem(null); setNewItem(EMPTY_ITEM) }} className="text-xs text-zinc-500 hover:text-zinc-700 px-3 py-1.5">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      report.status === 'rascunho' && (
                        <div className="px-5 py-3 border-t border-zinc-100">
                          <button onClick={() => { setAddingItem(report.id); setNewItem(EMPTY_ITEM) }} className="flex items-center gap-2 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Adicionar item
                          </button>
                        </div>
                      )
                    )}
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
