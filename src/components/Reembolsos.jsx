import React, { useState, useEffect, useCallback } from 'react'
import { Receipt, Plus, X, Check, ChevronDown, ChevronRight, AlertCircle, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'

const VL = '#5452C1'
const STATUS = {
  rascunho:  { label: 'Rascunho',  color: '#6B7280', bg: '#F9FAFB', next: 'submetido' },
  submetido: { label: 'Submetido', color: '#D97706', bg: '#FFFBEB', next: 'aprovado' },
  aprovado:  { label: 'Aprovado',  color: '#059669', bg: '#ECFDF5', next: 'pago' },
  pago:      { label: 'Pago',      color: '#3B82F6', bg: '#EFF6FF', next: null },
  rejeitado: { label: 'Rejeitado', color: '#EF4444', bg: '#FEF2F2', next: null },
}
const CATS = ['transporte','refeicao','material','hospedagem','outros']
const CAT_LABELS = { transporte:'Transporte', refeicao:'Refeição', material:'Material', hospedagem:'Hospedagem', outros:'Outros' }

function fmtBRL(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0) }

export default function Reembolsos() {
  const { profile } = useData()
  const [reports, setReports] = useState([])
  const [items, setItems] = useState({})
  const [expanded, setExpanded] = useState({})
  const [profiles, setProfilesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [addingItem, setAddingItem] = useState(null)
  const [newItem, setNewItem] = useState({ category: 'refeicao', description: '', value: '', date: '' })

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [repR, profR] = await Promise.allSettled([
      supabase.from('expense_reports').select('*').eq('org_id', profile.org_id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name').eq('org_id', profile.org_id).order('full_name'),
    ])
    let reps = []
    if (repR.status === 'fulfilled' && !repR.value.error) reps = repR.value.data || []
    if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    setReports(reps)
    if (reps.length > 0) {
      const { data: itemData } = await supabase.from('expense_items').select('*').in('report_id', reps.map(r => r.id))
      const grouped = {}
      reps.forEach(r => { grouped[r.id] = [] })
      ;(itemData || []).forEach(it => { if (grouped[it.report_id]) grouped[it.report_id].push(it) })
      setItems(grouped)
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  async function createReport() {
    if (!newTitle.trim()) return
    setSaving(true)
    const { error } = await supabase.from('expense_reports').insert({
      org_id: profile.org_id, submitted_by: profile.id, title: newTitle, status: 'rascunho', total_amount: 0
    })
    if (error) { toast.error('Erro ao criar relatório: ' + error.message); setSaving(false); return }
    setShowNew(false); setNewTitle(''); await load(); setSaving(false)
    toast.success('Relatório criado')
  }

  async function advanceStatus(r) {
    const next = STATUS[r.status]?.next
    if (!next) return
    const { error } = await supabase.from('expense_reports')
      .update({ status: next }).eq('id', r.id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao avançar status: ' + error.message); return }
    await load()
  }

  async function deleteReport(id) {
    if (!await confirm('Excluir este relatório?', { danger: true, confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return
    await supabase.from('expense_items').delete().eq('report_id', id)
    await supabase.from('expense_reports').delete().eq('id', id).eq('org_id', profile.org_id); await load()
  }

  async function addItem(reportId) {
    if (!newItem.description.trim() || !newItem.value) return
    setSaving(true)
    try {
      const val = parseFloat(newItem.value.replace(',', '.'))
      const { error } = await supabase.from('expense_items').insert({
        report_id: reportId, org_id: profile.org_id,
        category: newItem.category, description: newItem.description,
        amount: val, date: newItem.date || new Date().toISOString().split('T')[0]
      })
      if (error) throw error
      const repItems = [...(items[reportId] || []), { amount: val }]
      const total = repItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
      await supabase.from('expense_reports').update({ total_amount: total }).eq('id', reportId).eq('org_id', profile.org_id)
      setAddingItem(null); setNewItem({ category: 'refeicao', description: '', value: '', date: '' })
      await load()
    } catch (err) {
      toast.error('Erro ao adicionar item: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(reportId, itemId) {
    const { error } = await supabase.from('expense_items').delete().eq('id', itemId)
    if (error) { toast.error('Erro ao remover item: ' + error.message); return }
    const remaining = (items[reportId] || []).filter(it => it.id !== itemId)
    const total = remaining.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
    await supabase.from('expense_reports').update({ total_amount: total }).eq('id', reportId).eq('org_id', profile.org_id)
    await load()
  }

  const filtered = filterStatus === 'all' ? reports : reports.filter(r => r.status === filterStatus)
  const totalPendente = reports.filter(r => r.status === 'submetido').reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0)
  const profMap = {}; profiles.forEach(p => { profMap[p.id] = p })

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: '#2D2E39' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2"><Receipt className="w-3 h-3" /> Despesas</div>
            <h1 className="text-2xl font-bold mb-1">Reembolsos</h1>
            <p className="text-sm text-zinc-400">{reports.length} relatório{reports.length !== 1 ? 's' : ''} · {fmtBRL(totalPendente)} pendente de aprovação</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(STATUS).map(([k, s]) => (
              <div key={k} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[70px]">
                <div className="text-lg font-bold text-violet-300">{reports.filter(r => r.status === k).length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todos os status</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <button onClick={() => setShowNew(true)} className="ml-auto flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-colors" style={{ background: VL }}>
          <Plus className="w-4 h-4" /> Novo relatório
        </button>
      </div>

      {showNew && (
        <div className="bg-white border border-violet-200 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-800">Novo Relatório de Reembolso</h3>
            <button onClick={() => setShowNew(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-3">
            <input className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" placeholder="Título (ex: Viagem São Paulo Abr/2026)" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <button onClick={createReport} disabled={saving || !newTitle.trim()} className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50" style={{ background: VL }}>
              {saving ? 'Criando…' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-400">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <Receipt className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <div className="text-sm text-zinc-500">Nenhum relatório encontrado</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(report => {
            const repItems = items[report.id] || []
            const isExp = expanded[report.id]
            const st = STATUS[report.status] || STATUS.rascunho
            return (
              <div key={report.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-zinc-50 transition-colors" onClick={() => setExpanded(p => ({...p, [report.id]: !p[report.id]}))}>
                  <button className="text-zinc-400 shrink-0">
                    {isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-zinc-800">{report.title}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{profMap[report.submitted_by]?.full_name || '—'} · {repItems.length} item{repItems.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-zinc-800">{fmtBRL(report.total_amount)}</div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  {st.next && (
                    <button onClick={e => { e.stopPropagation(); advanceStatus(report) }}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold border px-3 py-1.5 rounded-lg transition-colors hover:bg-violet-50"
                      style={{ color: VL, borderColor: `${VL}40` }}>
                      <Check className="w-3 h-3" /> {STATUS[st.next]?.label}
                    </button>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteReport(report.id) }} className="text-zinc-300 hover:text-red-400 transition-colors shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>

                {isExp && (
                  <div className="border-t border-zinc-100">
                    {repItems.length > 0 && (
                      <table className="w-full text-sm">
                        <thead><tr className="text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 bg-zinc-50">
                          <th className="text-left px-5 py-2 font-bold">Categoria</th>
                          <th className="text-left px-4 py-2 font-bold">Descrição</th>
                          <th className="text-left px-4 py-2 font-bold">Data</th>
                          <th className="text-right px-4 py-2 font-bold">Valor</th>
                          <th className="px-4 py-2 w-8" />
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-50">
                          {repItems.map(it => (
                            <tr key={it.id} className="hover:bg-zinc-50">
                              <td className="px-5 py-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">{CAT_LABELS[it.category] || it.category}</span>
                              </td>
                              <td className="px-4 py-2.5 text-zinc-700">{it.description}</td>
                              <td className="px-4 py-2.5 text-zinc-500 text-xs">{it.date ? new Date(it.date).toLocaleDateString('pt-BR') : '—'}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-zinc-800">{fmtBRL(it.amount)}</td>
                              <td className="px-4 py-2.5"><button onClick={() => deleteItem(report.id, it.id)} className="text-zinc-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr className="border-t-2 border-zinc-200 bg-zinc-50">
                          <td colSpan={3} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-600">Total</td>
                          <td className="px-4 py-2.5 text-right font-bold text-zinc-900">{fmtBRL(report.total_amount)}</td>
                          <td />
                        </tr></tfoot>
                      </table>
                    )}
                    {addingItem === report.id ? (
                      <div className="px-5 py-4 bg-violet-50 border-t border-violet-100">
                        <div className="grid grid-cols-5 gap-3 mb-3">
                          <select className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-violet-500" value={newItem.category} onChange={e => setNewItem(p => ({...p, category: e.target.value}))}>
                            {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                          </select>
                          <input className="col-span-2 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" placeholder="Descrição *" value={newItem.description} onChange={e => setNewItem(p => ({...p, description: e.target.value}))} />
                          <input type="date" className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={newItem.date} onChange={e => setNewItem(p => ({...p, date: e.target.value}))} />
                          <input className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" placeholder="Valor (R$) *" value={newItem.value} onChange={e => setNewItem(p => ({...p, value: e.target.value}))} />
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => addItem(report.id)} disabled={saving || !newItem.description.trim() || !newItem.value}
                            className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50" style={{ background: VL }}>
                            <Plus className="w-3 h-3" /> Adicionar
                          </button>
                          <button onClick={() => { setAddingItem(null); setNewItem({ category: 'refeicao', description: '', value: '', date: '' }) }} className="text-xs text-zinc-500 px-3 py-1.5">Cancelar</button>
                        </div>
                      </div>
                    ) : report.status === 'rascunho' && (
                      <div className="px-5 py-3 border-t border-zinc-100">
                        <button onClick={() => setAddingItem(report.id)} className="flex items-center gap-2 text-xs font-semibold transition-colors" style={{ color: VL }}>
                          <Plus className="w-3.5 h-3.5" /> Adicionar item
                        </button>
                      </div>
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
