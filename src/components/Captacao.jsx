// src/components/Captacao.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { isLeaderRole } from '../lib/roles'
import { toast, confirm } from './Toast'
import {
  Target,
  Plus,
  Search,
  Filter,
  TrendingUp,
  DollarSign,
  Percent,
  AlertTriangle,
  Clock,
  X,
  RefreshCw,
  ChevronRight,
  Landmark,
  User,
  Calendar,
  Layers,
  List,
  CheckCircle,
  Save,
  Trash2,
  Archive,
  MessageSquare,
  Edit3,
  Phone,
  Mail,
  ExternalLink,
} from 'lucide-react'

// ============================================================================
// Captacao.jsx v2 — Pipeline de oportunidades comerciais
// ----------------------------------------------------------------------------
// PRESERVA o /captacao atual (Kanban 5 colunas + 3 KPIs hero + filtro
// responsavel) e ADICIONA: aging por estagio, alertas de deals parados,
// filtros (instituicao, valor minimo), view alternativa em lista, modal de
// detalhe ao clicar no card.
//
// Tabelas Supabase reais (validadas):
//   pipeline_items (3): id, org_id, name, stage (indicacao/comite/liberado),
//                       value, probability, entity_name, contact_name, notes,
//                       last_contact, next_action, assigned_to, cover_color,
//                       is_archived, expected_close, institution, institution_name,
//                       company_id, status, created_at, updated_at, created_by
//   institutions (3): id, name, type (Banco Comercial/Investimento/Fomento), is_active
//   profiles (10): id, full_name, initials, avatar_color
//   companies (4): id, name
// ============================================================================

// Mapeamento dos 5 estagios visuais (preserva o que o front antigo mostra)
// O banco real so tem 3 valores (indicacao/comite/liberado) — os outros 2
// sao stages "intermediarios" que ficam vazios ate alguem mover deals pra la
const STAGES = [
  { id: 'indicacao',     label: '1 - Indicação à Instituição', color: 'sky',     dot: 'bg-sky-500' },
  { id: 'documentacao',  label: '2 - Envio de Documentação',   color: 'violet',  dot: 'bg-violet-500' },
  { id: 'comite',        label: '3 - Comitê',                  color: 'amber',   dot: 'bg-amber-500' },
  { id: 'aprovado',      label: '4 - Aprovado',                color: 'emerald', dot: 'bg-emerald-500' },
  { id: 'liberado',      label: '5 - Operação Liberada',       color: 'sky',     dot: 'bg-sky-400' },
]

const STAGE_PROBABILITIES = {
  indicacao:    20,
  documentacao: 40,
  comite:       60,
  aprovado:     85,
  liberado:    100,
}

const VIEW_MODES = [
  { id: 'kanban', label: 'Kanban', icon: Layers },
  { id: 'list',   label: 'Lista',  icon: List },
]

const AGING_THRESHOLDS = {
  fresh:    7,   // <= 7 dias = verde
  warning: 14,   // 7-14 dias = amarelo
  // > 14 dias = vermelho
}

export default function Captacao() {
  const { profile } = useData()
  usePageTitle('Captação')
  const [items, setItems] = useState([])
  const [institutions, setInstitutions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [viewMode,  setViewMode]  = useState('kanban')
  const [draggingId, setDraggingId] = useState(null)
  const [pendingLoss, setPendingLoss] = useState(null)  // { itemId, newStage }
  const [lossReason,  setLossReason]  = useState('')
  const [dragOverStage, setDragOverStage] = useState(null)
  const [filterAssigned, setFilterAssigned] = useState('all')
  const [filterInstitution, setFilterInstitution] = useState('all')
  const [filterMinValue, setFilterMinValue] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    company_id: '',
    institution_name: '',
    stage: 'indicacao',
    value: '',
    probability: 20,
    contact_name: '',
    next_action: '',
    expected_close: '',
    notes: '',
  })

  useEscapeKey(() => { setSelectedItem(null) }, !!(selectedItem))
  useEffect(() => {
    if (profile?.org_id) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        loadTable('pipeline_items', setItems, q => q.eq('is_archived', false).order('updated_at', { ascending: false })),
        loadTable('institutions', setInstitutions, q => q.eq('is_active', true).order('name', { ascending: true })),
        loadTable('profiles', setProfiles, q => q.order('full_name', { ascending: true })),
        loadTable('companies', setCompanies, q => q.order('name', { ascending: true })),
      ])
    } catch (err) {
      console.error('Error loading captacao:', err)
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

  async function submitItem() {
    if (!form.name.trim()) {
      toast.warning('Preencha o nome da oportunidade')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        org_id: profile.org_id,
        name: form.name.trim(),
        company_id: form.company_id || null,
        institution_name: form.institution_name?.trim() || null,
        stage: form.stage,
        value: parseFloat(form.value) || 0,
        probability: parseInt(form.probability) || STAGE_PROBABILITIES[form.stage],
        contact_name: form.contact_name?.trim() || null,
        next_action: form.next_action?.trim() || null,
        expected_close: form.expected_close || null,
        notes: form.notes?.trim() || null,
        status: 'active',
        is_archived: false,
        created_by: profile.id,
        last_contact: new Date().toISOString(),
      }
      const { error: iErr } = await supabase.from('pipeline_items').insert([payload])
      if (iErr) throw iErr
      setForm({ name: '', company_id: '', institution_name: '', stage: 'indicacao', value: '', probability: 20, contact_name: '', next_action: '', expected_close: '', notes: '' })
      setShowForm(false)
      await loadAll()
      toast.success('Oportunidade criada')
    } catch (err) {
      toast.error(`Erro ao criar oportunidade: ` + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function onDragStart(itemId) { setDraggingId(itemId) }
  function onDragOver(e, stageId) { e.preventDefault(); setDragOverStage(stageId) }
  function onDragLeave() { setDragOverStage(null) }
  async function onDrop(e, stageId) {
    e.preventDefault()
    setDragOverStage(null)
    if (!draggingId) return
    const item = items.find(i => i.id === draggingId)
    setDraggingId(null)
    if (!item || item.stage === stageId) return
    await moveItem(draggingId, stageId)
  }

  async function moveItem(itemId, newStage) {
    try {
      const { error: uErr } = await supabase
        .from('pipeline_items')
        .update({
          stage: newStage,
          probability: STAGE_PROBABILITIES[newStage],
          last_contact: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('org_id', profile.org_id)
      if (uErr) throw uErr
      const movedItem = items.find(i => i.id === itemId)
      logActivity(supabase, { org_id: profile.org_id, actor_id: profile.id, entity_type: 'pipeline_item', entity_id: itemId, action: 'stage_changed', module: 'captacao', metadata: { to: newStage, title: movedItem?.name } })
      await loadAll()
      toast.success('Movido para ' + STAGES.find(s => s.id === newStage)?.label)
    } catch (err) {
      toast.error(`Erro ao mover: ` + err.message)
    }
  }

  // Filtragem
  const filtered = useMemo(() => {
    return items.filter(it => {
      if (filterAssigned !== 'all' && it.assigned_to !== filterAssigned) return false
      if (filterInstitution !== 'all' && it.institution_name !== filterInstitution) return false
      if (filterMinValue) {
        const min = parseFloat(filterMinValue) || 0
        if ((parseFloat(it.value) || 0) < min) return false
      }
      if (search) {
        const s = search.toLowerCase()
        const hay = `${it.name || ''} ${it.entity_name || ''} ${it.institution_name || ''} ${it.contact_name || ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [items, filterAssigned, filterInstitution, filterMinValue, search])

  // Group by stage
  const byStage = useMemo(() => {
    const m = {}
    STAGES.forEach(s => { m[s.id] = [] })
    filtered.forEach(it => {
      const s = it.stage || 'indicacao'
      if (!m[s]) m[s] = []
      m[s].push(it)
    })
    return m
  }, [filtered])

  // KPIs (preservados do v3 atual + novos)
  const kpis = useMemo(() => {
    const total = filtered.reduce((s, it) => s + (parseFloat(it.value) || 0), 0)
    const weighted = filtered.reduce((s, it) => {
      const prob = (parseFloat(it.probability) || STAGE_PROBABILITIES[it.stage] || 0) / 100
      return s + (parseFloat(it.value) || 0) * prob
    }, 0)
    const liberados = filtered.filter(it => it.stage === 'liberado').length
    const conversion = filtered.length > 0 ? Math.round((liberados / filtered.length) * 100) : 0

    // Aging
    const now = Date.now()
    const stale = filtered.filter(it => {
      if (!it.last_contact && !it.updated_at) return false
      const ref = new Date(it.last_contact || it.updated_at).getTime()
      const days = (now - ref) / (24 * 3600 * 1000)
      return days > AGING_THRESHOLDS.warning
    }).length

    return { total, weighted, conversion, stale, count: filtered.length }
  }, [filtered])

  function formatCurrency(v) {
    const n = parseFloat(v) || 0
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
  }

  function getAging(item) {
    const ref = item.last_contact || item.updated_at || item.created_at
    if (!ref) return { days: 0, level: 'fresh', label: '—' }
    const days = Math.floor((Date.now() - new Date(ref).getTime()) / (24 * 3600 * 1000))
    let level = 'fresh'
    if (days > AGING_THRESHOLDS.warning) level = 'stale'
    else if (days > AGING_THRESHOLDS.fresh) level = 'warning'
    const label = days === 0 ? 'hoje' : days === 1 ? 'ontem' : `${days}d atrás`
    return { days, level, label }
  }

  function exportCSV() {
    const rows = [
      ['Oportunidade','Estágio','Valor','Probabilidade','Empresa','Contato','Instituição','Responsável','Última ação','Próxima ação'],
      ...filtered.map(it => {
        const prof  = profiles.find(p => p.id === it.assigned_to)
        const stage = STAGES.find(s => s.id === it.stage)
        return [
          `"${(it.name || '').replace(/"/g,'""')}"`,
          stage?.label || it.stage,
          it.value || 0,
          `${it.probability || STAGE_PROBABILITIES[it.stage]}%`,
          `"${(it.entity_name || '').replace(/"/g,'""')}"`,
          `"${(it.contact_name || '').replace(/"/g,'""')}"`,
          `"${(it.institution_name || '').replace(/"/g,'""')}"`,
          prof?.full_name || '',
          it.last_contact ? it.last_contact.slice(0,10) : '',
          `"${(it.next_action || '').replace(/"/g,'""')}"`,
        ].join(',')
      })
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `pipeline_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <Target className="w-3 h-3" />
              Pipeline de oportunidades comerciais
            </div>
            <h1 className="text-2xl font-bold mb-1">🎯 Captação</h1>
            <p className="text-sm text-zinc-300">
              {kpis.count} oportunidades · {institutions.length} instituições parceiras
              {kpis.stale > 0 && ` · ${kpis.stale} parada${kpis.stale > 1 ? 's' : ''}`}
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
            {isLeaderRole(profile?.role) && (
<button
              onClick={exportCSV}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold flex items-center gap-2"
              title="Exportar pipeline filtrado como CSV"
            >
              ↓ CSV
            </button>
)}
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Oportunidade
            </button>
          </div>
        </div>

        {/* 3 KPIs originais + 1 novo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Pipeline Total"  value={formatCurrency(kpis.total)}    icon={DollarSign} accent="violet" />
          <Kpi label="Valor Ponderado" value={formatCurrency(kpis.weighted)} icon={TrendingUp} accent="sky" />
          <Kpi label="Taxa Conversão"  value={`${kpis.conversion}%`}         icon={Percent}    accent="emerald" />
          <Kpi label="Parados +14d"    value={kpis.stale}                    icon={AlertTriangle} accent={kpis.stale > 0 ? 'rose' : 'amber'} />
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-emerald-900 font-semibold">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5" />
          <span className="text-sm text-rose-900">{error}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_140px_auto] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar oportunidade, contato, instituição…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
            />
          </div>
          <select
            value={filterAssigned}
            onChange={(e) => setFilterAssigned(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
          >
            <option value="all">Todos os Responsáveis</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
          <select
            value={filterInstitution}
            onChange={(e) => setFilterInstitution(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
          >
            <option value="all">Todas as Instituições</option>
            {institutions.map(i => (
              <option key={i.id} value={i.name}>{i.name}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Valor min R$"
            value={filterMinValue}
            onChange={(e) => setFilterMinValue(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg"
          />
          <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
            {VIEW_MODES.map(v => {
              const Icon = v.icon
              return (
                <button
                  key={v.id}
                  onClick={() => setViewMode(v.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 ${viewMode === v.id ? 'bg-white shadow text-violet-700' : 'text-zinc-500'}`}
                >
                  <Icon className="w-3 h-3" />
                  {v.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Form Nova Oportunidade */}
      {showForm && (
        <div className="bg-white border-2 border-violet-300 rounded-xl p-5 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-600" />
              Nova oportunidade
            </h2>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-zinc-100 rounded">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input
              type="text"
              placeholder="Nome da oportunidade"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg md:col-span-2"
            />
            <select
              value={form.company_id}
              onChange={(e) => setForm({ ...form, company_id: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
            >
              <option value="">Cliente (opcional)…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={form.institution_name}
              onChange={(e) => setForm({ ...form, institution_name: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
            >
              <option value="">Instituição…</option>
              {institutions.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </select>
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value, probability: STAGE_PROBABILITIES[e.target.value] })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
            >
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input
              type="number"
              placeholder="Valor (R$)"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg"
            />
            <input
              type="text"
              placeholder="Contato"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg"
            />
            <input
              type="date"
              placeholder="Fechamento esperado"
              value={form.expected_close}
              onChange={(e) => setForm({ ...form, expected_close: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg"
            />
            <input
              type="text"
              placeholder="Próxima ação"
              value={form.next_action}
              onChange={(e) => setForm({ ...form, next_action: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg md:col-span-2"
            />
            <textarea
              rows={2}
              placeholder="Notas..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg md:col-span-2 resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg">Cancelar</button>
            <button onClick={submitItem} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
              {submitting ? 'Salvando…' : 'Criar oportunidade'}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center mb-6">
          <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2 text-zinc-400" />
          <span className="text-sm text-zinc-500">Carregando…</span>
        </div>
      )}

      {/* ============== KANBAN ============== */}
      {!loading && viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {STAGES.map(stage => {
            const list = byStage[stage.id] || []
            const stageValue = list.reduce((s, it) => s + (parseFloat(it.value) || 0), 0)
            const weightedValue = list.reduce((s, it) => s + (parseFloat(it.value) || 0) * ((parseFloat(it.probability) || STAGE_PROBABILITIES[it.stage]) / 100), 0)
            const stageColors = {
              sky:     { header: '#F0F9FF', border: '#BAE6FD', text: '#0369A1', dot: '#0EA5E9' },
              violet:  { header: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9', dot: '#7C3AED' },
              amber:   { header: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
              emerald: { header: '#ECFDF5', border: '#A7F3D0', text: '#065F46', dot: '#10B981' },
            }
            const sc = stageColors[stage.color] || stageColors.violet
            return (
              <div key={stage.id}
                className={`flex flex-col rounded-2xl border-2 transition-all ${
                  dragOverStage === stage.id
                    ? 'border-violet-400 ring-2 ring-violet-300 ring-offset-2 shadow-lg'
                    : 'border-zinc-200'
                }`}
                style={{ background: '#F8F9FC' }}
                onDragOver={e => onDragOver(e, stage.id)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, stage.id)}
              >
                {/* Column header */}
                <div className="px-4 py-3 rounded-t-2xl border-b border-zinc-200" style={{ background: sc.header }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: sc.dot }} />
                      <h3 className="text-xs font-bold text-zinc-700">{stage.label.replace(/^\d+ - /, '')}</h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border" style={{ color: sc.text, borderColor: sc.border }}>{list.length}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-zinc-600">{formatCurrency(stageValue)}</span>
                    <span className="text-zinc-400">pond. {formatCurrency(weightedValue)}</span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-3 min-h-[160px] flex-1">
                  {list.length === 0 ? (
                    <div className="text-center py-10 text-xs text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl">
                      {dragOverStage === stage.id ? '↓ Soltar aqui' : 'Vazio'}
                    </div>
                  ) : (
                    list.map(item => {
                      const aging = getAging(item)
                      const assigned = profiles.find(p => p.id === item.assigned_to)
                      const prob = item.probability || STAGE_PROBABILITIES[item.stage] || 0
                      const weighted = (parseFloat(item.value) || 0) * (prob / 100)
                      const isStale = aging.level === 'stale'
                      const isWarning = aging.level === 'warning'
                      const accentColor = item.cover_color || '#5452C1'

                      // Urgency badge
                      let urgencyBadge = null
                      if (isStale) urgencyBadge = { label: '⚠ Parado', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
                      else if (isWarning) urgencyBadge = { label: '⏳ Atenção', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' }
                      else urgencyBadge = { label: '✓ Ativo', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' }

                      const checklistDone = Array.isArray(item.checklist) ? item.checklist.filter(i => i.done).length : 0
                      const checklistTotal = Array.isArray(item.checklist) ? item.checklist.length : 0

                      // Next stage shortcut
                      const currentIdx = STAGES.findIndex(s => s.id === item.stage)
                      const nextStage = STAGES[currentIdx + 1]
                      const prevStage = STAGES[currentIdx - 1]

                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => onDragStart(item.id)}
                          onClick={() => setSelectedItem(item)}
                          className={`bg-white rounded-xl cursor-pointer transition-all group ${
                            draggingId === item.id ? 'opacity-30 scale-95' : 'hover:shadow-lg hover:-translate-y-0.5'
                          }`}
                          style={{
                            boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                            borderLeft: `4px solid ${accentColor}`,
                          }}
                        >
                          {/* Card body */}
                          <div className="p-4">
                            {/* Urgency + tags row */}
                            <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                                style={{ background: urgencyBadge.bg, color: urgencyBadge.color, borderColor: urgencyBadge.border }}>
                                {urgencyBadge.label}
                              </span>
                              {Array.isArray(item.tags) && item.tags.slice(0,2).map((tag,i) => (
                                <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">{tag}</span>
                              ))}
                            </div>

                            {/* Title — full, no truncate, 3 lines max */}
                            <h4 className="text-sm font-bold text-zinc-800 leading-snug line-clamp-3 mb-1.5">{item.name || '—'}</h4>

                            {/* Cliente + Instituição */}
                            <div className="space-y-0.5 mb-3">
                              {item.entity_name && (
                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                                  <div className="w-1 h-1 rounded-full bg-zinc-300 shrink-0" />
                                  <span className="truncate font-medium">{item.entity_name}</span>
                                </div>
                              )}
                              {item.institution_name && (
                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                                  <div className="w-1 h-1 rounded-full bg-violet-300 shrink-0" />
                                  <span className="truncate">{item.institution_name}</span>
                                </div>
                              )}
                            </div>

                            {/* Valor + Ponderado */}
                            <div className="flex items-end justify-between mb-2">
                              <div>
                                <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold mb-0.5">Valor</div>
                                <div className="text-base font-bold" style={{ color: accentColor }}>{formatCurrency(item.value)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold mb-0.5">Ponderado</div>
                                <div className="text-sm font-bold text-zinc-600">{formatCurrency(weighted)}</div>
                              </div>
                            </div>

                            {/* Prob barra */}
                            <div className="flex items-center gap-2 mb-3">
                              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${prob}%`, background: prob >= 80 ? '#10B981' : prob >= 50 ? '#5452C1' : '#F59E0B' }} />
                              </div>
                              <span className="text-[10px] font-bold w-8 text-right shrink-0"
                                style={{ color: prob >= 80 ? '#10B981' : prob >= 50 ? '#5452C1' : '#F59E0B' }}>
                                {prob}%
                              </span>
                            </div>

                            {/* Checklist */}
                            {checklistTotal > 0 && (
                              <div className="flex items-center gap-2 mb-3">
                                <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-emerald-500 transition-all"
                                    style={{ width: `${checklistTotal > 0 ? checklistDone/checklistTotal*100 : 0}%` }} />
                                </div>
                                <span className="text-[9px] text-zinc-400 font-semibold shrink-0">☑ {checklistDone}/{checklistTotal}</span>
                              </div>
                            )}

                            {/* Próxima ação */}
                            {item.next_action && (
                              <div className="flex items-start gap-1.5 mb-3 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2">
                                <span className="text-violet-400 text-[10px] mt-0.5 shrink-0">→</span>
                                <span className="text-[11px] text-violet-700 font-semibold leading-snug line-clamp-2">{item.next_action}</span>
                              </div>
                            )}

                            {/* Footer: responsável + aging */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {assigned ? (
                                  <>
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                      style={{ background: assigned.avatar_color || '#5452C1' }}>
                                      {(assigned.initials || assigned.full_name?.slice(0,2) || '?').toUpperCase()}
                                    </div>
                                    <span className="text-[10px] text-zinc-500 font-medium">{assigned.full_name?.split(' ')[0]}</span>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-zinc-400 italic">Sem responsável</span>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold ${isStale ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-zinc-400'}`}>
                                {aging.label}
                              </span>
                            </div>
                          </div>

                          {/* Stage nav footer */}
                          <div className="flex border-t border-zinc-100 rounded-b-xl overflow-hidden">
                            {prevStage && (
                              <button
                                onClick={e => { e.stopPropagation(); moveItem(item.id, prevStage.id) }}
                                className="flex-1 py-2 text-[10px] font-bold text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-colors text-center"
                                title={`← ${prevStage.label}`}>
                                ← {prevStage.label.replace(/^\d+ - /, '').slice(0,10)}
                              </button>
                            )}
                            {prevStage && nextStage && <div className="w-px bg-zinc-100" />}
                            {nextStage && (
                              <button
                                onClick={e => { e.stopPropagation(); moveItem(item.id, nextStage.id) }}
                                className="flex-1 py-2 text-[10px] font-bold text-violet-500 hover:bg-violet-50 hover:text-violet-700 transition-colors text-center"
                                title={`→ ${nextStage.label}`}>
                                {nextStage.label.replace(/^\d+ - /, '').slice(0,12)} →
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ============== LISTA ============== */}
      {!loading && viewMode === 'list' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-400">Nenhuma oportunidade encontrada</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-800 text-white">
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Oportunidade</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Estágio</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Instituição</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Valor</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Prob.</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Aging</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Próxima ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(item => {
                  const stage = STAGES.find(s => s.id === item.stage) || STAGES[0]
                  const aging = getAging(item)
                  return (
                    <tr key={item.id} className="hover:bg-zinc-50 cursor-pointer" onClick={() => setSelectedItem(item)}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-zinc-800">{item.name}</div>
                        {item.entity_name && <div className="text-[10px] text-zinc-500">{item.entity_name}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-zinc-700">
                          <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                          {stage.label.replace(/^\d - /, '')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{item.institution_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-800">{formatCurrency(item.value)}</td>
                      <td className="px-4 py-3 text-center text-amber-600 font-bold text-xs">{item.probability || STAGE_PROBABILITIES[item.stage]}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold ${
                          aging.level === 'stale' ? 'text-rose-600' :
                          aging.level === 'warning' ? 'text-amber-600' :
                          'text-emerald-600'
                        }`}>
                          {aging.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs truncate max-w-xs">{item.next_action || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ============== MODAL DEAL — ESTILO TRELLO ============== */}
      {/* B-179: Modal de motivo de perda */}
      {pendingLoss && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-zinc-800 mb-1">Proposta Perdida</h3>
            <p className="text-xs text-zinc-500 mb-4">Qual foi o motivo? (opcional — ajuda na análise do pipeline)</p>
            <textarea
              rows={3}
              autoFocus
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none mb-4"
              placeholder="Ex: preço acima do orçamento, concorrente, não fechou contrato..."
              value={lossReason}
              onChange={e => setLossReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={confirmLoss}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90"
                style={{ background: '#EF4444' }}>
                Confirmar perda
              </button>
              <button onClick={() => { setPendingLoss(null); setLossReason('') }}
                className="px-4 text-sm text-zinc-500 hover:text-zinc-700">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedItem && (
        <DealModal
          item={selectedItem}
          stages={STAGES}
          stageProbabilities={STAGE_PROBABILITIES}
          profiles={profiles}
          companies={companies}
          institutions={institutions}
          formatCurrency={formatCurrency}
          onClose={() => setSelectedItem(null)}
          onSave={async (updated) => {
            const { error } = await supabase.from('pipeline_items').update(updated).eq('id', selectedItem.id)
            if (error) { toast.error('Erro ao salvar: ' + error.message); return }
            await loadAll()
            setSelectedItem(null)
            toast.success('Oportunidade salva')
          }}
          onArchive={async () => {
            try {
              const { error } = await supabase.from('pipeline_items')
                .update({ is_archived: true }).eq('id', selectedItem.id).eq('org_id', profile.org_id)
              if (error) throw error
              await loadAll()
              setSelectedItem(null)
              toast.success('Oportunidade arquivada')
            } catch (err) {
              toast.error('Erro ao arquivar: ' + err.message)
            }
          }}
          onDelete={async () => {
            if (!await confirm('Excluir esta oportunidade permanentemente?', { danger: true, confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return
            await supabase.from('pipeline_items').delete().eq('id', selectedItem.id).eq('org_id', profile.org_id)
            await loadAll()
            setSelectedItem(null)
            toast.success('Oportunidade excluída')
          }}
        />
      )}
    </div>
  )
}

// ============================================================================
// DealModal — Modal Trello-style para oportunidade de captação
// ============================================================================
function DealModal({ item, stages, stageProbabilities, profiles, companies, institutions, formatCurrency, onClose, onSave, onArchive, onDelete }) {
  const VL = '#5452C1', CH = '#2D2E39'
  const GREEN = '#10B981', AMBER = '#F59E0B', RED = '#EF4444'

  const [tab, setTab] = useState('detalhes') // detalhes | historico | acao
  const [form, setForm] = useState({
    name:             item.name || '',
    stage:            item.stage || 'indicacao',
    value:            item.value || '',
    probability:      item.probability || stageProbabilities[item.stage] || 20,
    entity_name:      item.entity_name || '',
    institution_name: item.institution_name || '',
    contact_name:     item.contact_name || '',
    expected_close:   item.expected_close ? item.expected_close.split('T')[0] : '',
    next_action:      item.next_action || '',
    last_contact:     item.last_contact ? item.last_contact.split('T')[0] : '',
    notes:            item.notes || '',
    assigned_to:      item.assigned_to || '',
    cover_color:      item.cover_color || '',
    tags:             Array.isArray(item.tags) ? item.tags : [],
    checklist:        Array.isArray(item.checklist) ? item.checklist : [],
    company_id:       item.company_id || '',
  })
  const [newTag,          setNewTag]          = useState('')
  const [newCheckItem,    setNewCheckItem]    = useState('')
  const [saving, setSaving] = useState(false)
  const [newContact, setNewContact] = useState('')

  // Histórico de contato simulado a partir das notas + last_contact
  // B-87: parsear notes para extrair entradas de histórico no formato "[DD/MM/AAAA] texto"
  const contacts = []
  if (form.notes) {
    const lines = form.notes.split('\n').filter(Boolean)
    lines.forEach(line => {
      const m = line.match(/^\[([\d/]+)\]\s*(.+)/)
      if (m) {
        // Converter data BR para ISO para comparação
        const parts = m[1].split('/')
        const dateISO = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : null
        contacts.push({ date: dateISO, text: m[2], type: 'note' })
      } else if (line.trim()) {
        contacts.push({ date: null, text: line.trim(), type: 'note' })
      }
    })
  }
  if (item.last_contact && contacts.length === 0) contacts.push({ date: item.last_contact, text: 'Último contato registrado', type: 'phone' })
  if (item.next_action) contacts.push({ date: item.expected_close || null, text: `Próxima ação: ${item.next_action}`, type: 'action' })

  async function save() {
    setSaving(true)
    await onSave({
      name:             form.name,
      stage:            form.stage,
      value:            parseFloat(form.value) || 0,
      probability:      parseInt(form.probability) || stageProbabilities[form.stage],
      entity_name:      form.entity_name || null,
      institution_name: form.institution_name || null,
      contact_name:     form.contact_name || null,
      expected_close:   form.expected_close || null,
      next_action:      form.next_action || null,
      last_contact:     form.last_contact ? new Date(form.last_contact).toISOString() : item.last_contact,
      notes:            form.notes || null,
      assigned_to:      form.assigned_to || null,
      cover_color:      form.cover_color || null,
    })
    setSaving(false)
  }

  const probColor = form.probability >= 80 ? GREEN : form.probability >= 50 ? AMBER : RED
  const stage = stages.find(s => s.id === form.stage)

  const COVER_COLORS = [VL,'#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#EC4899','#2D2E39']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Cover strip */}
        {form.cover_color && <div className="h-2 w-full" style={{ background: form.cover_color }} />}

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex-1 min-w-0 pr-4">
            <input
              className="w-full text-xl font-bold text-zinc-800 border-0 outline-none focus:border-b-2 pb-0.5 bg-transparent"
              style={{ borderBottomColor: VL }}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Nome da oportunidade…"
            />
            {item.entity_name && <div className="text-xs text-zinc-400 mt-1">{item.entity_name}</div>}
            <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-2">
              {item.created_by && profiles.find(p => p.id === item.created_by) && (
                <span>Criado por {profiles.find(p => p.id === item.created_by)?.full_name?.split(' ')[0]}</span>
              )}
              {item.created_at && (
                <span>{item.created_by ? '·' : ''} {new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onArchive} className="p-1.5 text-zinc-400 hover:text-amber-500 transition-colors" title="Arquivar">
              <Archive className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors" title="Excluir">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stage selector — highlight visual */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 overflow-x-auto">
          {stages.map(s => (
            <button key={s.id} onClick={() => setForm(p => ({ ...p, stage: s.id, probability: stageProbabilities[s.id] }))}
              className="flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all"
              style={form.stage === s.id
                ? { background: VL, color: '#fff' }
                : { background: '#F2F2F2', color: '#6B7280' }}>
              {s.label.split(' - ')[0]}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 px-6">
          {[['detalhes','Detalhes'],['historico','Contatos'],['acao','Próximas Ações']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${tab === id ? 'border-violet-500 text-violet-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {tab === 'detalhes' && (
            <div className="space-y-4">
              {/* KPIs editáveis */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-violet-50 rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-1">Valor (R$)</div>
                  <input type="number" className="w-full text-xl font-bold text-violet-700 bg-transparent border-0 outline-none"
                    value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} placeholder="0" />
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">Prob. (%)</div>
                  <input type="number" min="0" max="100" className="w-full text-xl font-bold bg-transparent border-0 outline-none"
                    style={{ color: probColor }}
                    value={form.probability} onChange={e => setForm(p => ({ ...p, probability: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="rounded-xl p-3 border border-zinc-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Ponderado</div>
                  <div className="text-xl font-bold text-zinc-700">
                    {formatCurrency((parseFloat(form.value) || 0) * (parseInt(form.probability) || 0) / 100)}
                  </div>
                </div>
              </div>

              {/* Barra de probabilidade */}
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, form.probability)}%`, background: probColor }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Empresa cliente</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" value={form.entity_name || ''} onChange={e => setForm(p => ({ ...p, entity_name: e.target.value }))}>
                    <option value="">— selecione —</option>
                    {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Instituição</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" value={form.institution_name || ''} onChange={e => setForm(p => ({ ...p, institution_name: e.target.value }))}>
                    <option value="">— selecione —</option>
                    {institutions.map(i => <option key={i.id} value={i.name}>{i.name} ({i.type})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Contato</label>
                  <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    value={form.contact_name || ''} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} placeholder="Nome do contato…" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Responsável</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" value={form.assigned_to || ''} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">— nenhum —</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Empresa (Cadastro)</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" value={form.company_id || ''} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))}>
                    <option value="">— nenhuma —</option>
                    {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Previsão fechamento</label>
                  <input type="date" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    value={form.expected_close || ''} onChange={e => setForm(p => ({ ...p, expected_close: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Último contato</label>
                  <input type="date" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    value={form.last_contact || ''} onChange={e => setForm(p => ({ ...p, last_contact: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Notas</label>
                <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none" rows={3}
                  value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Observações, contexto, condições…" />
              </div>

              {/* Cover color */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Cor do card</label>
                <div className="flex gap-1.5">
                  {COVER_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, cover_color: p.cover_color === c ? '' : c }))}
                      className="w-6 h-6 rounded-full ring-offset-1 transition-all"
                      style={{ background: c, outline: form.cover_color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                  {form.cover_color && (
                    <button onClick={() => setForm(p => ({ ...p, cover_color: '' }))} className="text-[10px] text-zinc-400 hover:text-zinc-600 ml-1">limpar</button>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tags</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(form.tags || []).map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      {tag}
                      <button onClick={() => setForm(p => ({...p, tags: p.tags.filter((_,j) => j !== i)}))} className="hover:text-red-600 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="flex-1 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-violet-500"
                    placeholder="Nova tag… (Enter para adicionar)"
                    value={newTag} onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter' && newTag.trim()) { setForm(p=>({...p,tags:[...(p.tags||[]),newTag.trim()]})); setNewTag('') }}} />
                  <button onClick={() => { if(newTag.trim()){setForm(p=>({...p,tags:[...(p.tags||[]),newTag.trim()]}));setNewTag('')}}}
                    className="px-2 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-500">+ Tag</button>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">
                  Checklist {(form.checklist||[]).length > 0 && (
                    <span className="text-zinc-400 font-normal ml-1">
                      {(form.checklist||[]).filter(i=>i.done).length}/{(form.checklist||[]).length}
                    </span>
                  )}
                </label>
                <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
                  {(form.checklist||[]).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 group">
                      <input type="checkbox" checked={!!item.done}
                        onChange={e => setForm(p => ({...p, checklist: p.checklist.map((ci,j) => j===i ? {...ci,done:e.target.checked} : ci)}))}
                        className="w-3.5 h-3.5 accent-violet-600 shrink-0" />
                      <span className={`text-xs flex-1 ${item.done ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>{item.text}</span>
                      <button onClick={() => setForm(p => ({...p, checklist: p.checklist.filter((_,j) => j!==i)}))}
                        className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 text-xs">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="flex-1 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-violet-500"
                    placeholder="Novo item… (Enter)"
                    value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter'&&newCheckItem.trim()){setForm(p=>({...p,checklist:[...(p.checklist||[]),{text:newCheckItem.trim(),done:false}]}));setNewCheckItem('')}}} />
                  <button onClick={() => { if(newCheckItem.trim()){setForm(p=>({...p,checklist:[...(p.checklist||[]),{text:newCheckItem.trim(),done:false}]}));setNewCheckItem('')}}}
                    className="px-2 py-1.5 bg-zinc-700 text-white text-xs rounded-lg hover:bg-zinc-600">+ Item</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'historico' && (
            <div>
              <div className="text-xs text-zinc-500 mb-4">Registro de interações com a instituição/contato</div>
              {contacts.length === 0 ? (
                <div className="text-center py-8">
                  <Phone className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">Nenhum contato registrado</p>
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  {contacts.map((c, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-zinc-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#EEF2FF' }}>
                        {c.type === 'phone' ? <Phone className="w-4 h-4" style={{ color: VL }} /> : c.type === 'action' ? <Edit3 className="w-4 h-4" style={{ color: AMBER }} /> : <MessageSquare className="w-4 h-4" style={{ color: VL }} />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-800">{c.text}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{c.date ? new Date(c.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-zinc-100 pt-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Registrar novo contato</div>
                <div className="flex gap-2">
                  <input className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="Descreva o contato…"
                    onKeyDown={e => { if (e.key === 'Enter' && newContact.trim()) { setForm(p => ({ ...p, notes: `[${new Date().toLocaleDateString('pt-BR')}] ${newContact}\n` + (p.notes || '') })); setNewContact('') } }} />
                  <button onClick={() => {
                    if (!newContact.trim()) return
                    const entry = `[${new Date().toLocaleDateString('pt-BR')}] ${newContact}\n`
                    setForm(p => ({ ...p, notes: entry + (p.notes || '') }))
                    setNewContact('')
                  }}
                    className="px-3 py-2 text-white text-xs font-bold rounded-lg" style={{ background: VL }}>
                    + Log
                  </button>
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">Salvo nas Notas · Enter para adicionar</div>
              </div>
            </div>
          )}

          {tab === 'acao' && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Próxima ação</label>
                <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none" rows={3}
                  value={form.next_action || ''} onChange={e => setForm(p => ({ ...p, next_action: e.target.value }))}
                  placeholder="Descreva o próximo passo para avançar este deal…" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Data da próxima ação</label>
                <input type="date" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                  value={form.expected_close || ''} onChange={e => setForm(p => ({ ...p, expected_close: e.target.value }))} />
              </div>

              {/* Checklist de etapas por estágio */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Checklist — {stage?.label}</label>
                {[
                  { stage: 'indicacao',    items: ['Identificar decisor', 'Mapear necessidade de crédito', 'Definir produto/linha', 'Agendar apresentação'] },
                  { stage: 'documentacao', items: ['Receber documentação da empresa', 'Validar balanços e DREs', 'Preparar kit banco', 'Enviar para instituição'] },
                  { stage: 'comite',       items: ['Acompanhar análise interna', 'Responder diligências', 'Negociar condições (taxa, prazo, garantias)', 'Aguardar deliberação'] },
                  { stage: 'aprovado',     items: ['Receber term sheet', 'Revisar condições com cliente', 'Assinar documentos', 'Formalizar contratos'] },
                  { stage: 'liberado',     items: ['Confirmar liberação do recurso', 'Emitir NF de honorários', 'Arquivar documentação', 'Solicitar feedback do cliente'] },
                ].find(c => c.stage === form.stage)?.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 py-2 border-b border-zinc-50">
                    <input type="checkbox" className="w-4 h-4 rounded accent-violet-600" id={`chk-${i}`} />
                    <label htmlFor={`chk-${i}`} className="text-sm text-zinc-700 cursor-pointer">{item}</label>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
          <div className="text-[10px] text-zinc-400">
            Criado em {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '—'}
            {item.updated_at && ` · Atualizado ${new Date(item.updated_at).toLocaleDateString('pt-BR')}`}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-700 px-4 py-2">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name.trim()}
              className="flex items-center gap-1.5 text-white text-sm font-bold px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
              style={{ background: VL }}>
              <Save className="w-4 h-4" />{saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


function Kpi({ label, value, icon: Icon, accent }) {
  const accents = {
    violet: 'text-violet-300',
    emerald: 'text-emerald-300',
    sky: 'text-sky-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
      <div className="flex items-start justify-between mb-1">
        <div className={`text-[10px] font-bold uppercase tracking-wider ${accents[accent] || 'text-zinc-300'}`}>
          {label}
        </div>
        {Icon && <Icon className={`w-3 h-3 ${accents[accent] || 'text-zinc-300'}`} />}
      </div>
      <div className="text-xl font-bold tracking-tight">{value}</div>
    </div>
  )
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-zinc-100">
      <Icon className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
        <div className="text-sm text-zinc-800 mt-0.5">{children}</div>
      </div>
    </div>
  )
}
