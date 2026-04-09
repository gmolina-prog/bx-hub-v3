// src/components/Captacao.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
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
  const [items, setItems] = useState([])
  const [institutions, setInstitutions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [viewMode, setViewMode] = useState('kanban')
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
      showSuccess('Oportunidade criada')
    } catch (err) {
      toast.error(`Erro ao criar oportunidade: ` + err.message)
    } finally {
      setSubmitting(false)
    }
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
      if (uErr) throw uErr
      await loadAll()
      showSuccess('Movido para ' + STAGES.find(s => s.id === newStage)?.label)
    } catch (err) {
      toast.error(`Erro ao mover: ` + err.message)
    }
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {STAGES.map(stage => {
            const list = byStage[stage.id] || []
            const stageValue = list.reduce((s, it) => s + (parseFloat(it.value) || 0), 0)
            return (
              <div key={stage.id} className="bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="px-3 py-3 border-b border-zinc-200">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                      <h3 className="text-xs font-bold text-zinc-700 truncate">{stage.label}</h3>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 bg-white px-1.5 py-0.5 rounded">{list.length}</span>
                  </div>
                  <div className="text-xs text-zinc-500 font-semibold">{formatCurrency(stageValue)}</div>
                </div>
                <div className="p-2 space-y-2 min-h-[100px]">
                  {list.length === 0 ? (
                    <div className="text-center py-6 text-[10px] text-zinc-400 italic">Vazio</div>
                  ) : (
                    list.map(item => {
                      const aging = getAging(item)
                      const assigned = profiles.find(p => p.id === item.assigned_to)
                      const initials = assigned?.initials || (assigned?.full_name || '?').substring(0, 2).toUpperCase()
                      const avatarStyle = assigned?.avatar_color ? { background: assigned.avatar_color } : {}
                      const avatarClass = assigned?.avatar_color
                        ? 'w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0'
                        : 'w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0'
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className="bg-white border border-zinc-200 rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-violet-300 transition-all"
                          style={item.cover_color ? { borderLeftWidth: '3px', borderLeftColor: item.cover_color } : {}}
                        >
                          <div className="text-xs font-bold text-zinc-800 line-clamp-2 mb-1">{item.name || '—'}</div>
                          {item.entity_name && (
                            <div className="text-[10px] text-zinc-500 truncate">{item.entity_name}</div>
                          )}
                          <div className="flex items-center justify-between mt-2 mb-2">
                            <div className="text-xs font-bold text-violet-700">{formatCurrency(item.value)}</div>
                            <div className="text-[10px] font-bold text-amber-600">{item.probability || STAGE_PROBABILITIES[item.stage]}%</div>
                          </div>
                          <div className="h-1 bg-zinc-100 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-violet-500" style={{ width: `${item.probability || STAGE_PROBABILITIES[item.stage]}%` }} />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className={avatarClass} style={avatarStyle}>{initials}</div>
                            <div className={`text-[9px] font-bold ${
                              aging.level === 'stale' ? 'text-rose-600' :
                              aging.level === 'warning' ? 'text-amber-600' :
                              'text-zinc-400'
                            }`}>
                              {aging.level === 'stale' && '⚠ '}
                              {aging.label}
                            </div>
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
            showSuccess('Oportunidade salva')
          }}
          onArchive={async () => {
            await supabase.from('pipeline_items').update({ is_archived: true }).eq('id', selectedItem.id)
            await loadAll()
            setSelectedItem(null)
            showSuccess('Oportunidade arquivada')
          }}
          onDelete={async () => {
            if (!await confirm('Excluir esta oportunidade permanentemente?', { danger: true, confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return
            await supabase.from('pipeline_items').delete().eq('id', selectedItem.id)
            await loadAll()
            setSelectedItem(null)
            showSuccess('Oportunidade excluída')
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
  })
  const [saving, setSaving] = useState(false)
  const [newContact, setNewContact] = useState('')

  // Histórico de contato simulado a partir das notas + last_contact
  const contacts = []
  if (item.last_contact) contacts.push({ date: item.last_contact, text: 'Último contato registrado', type: 'phone' })
  if (item.next_action) contacts.push({ date: item.expected_close || new Date().toISOString(), text: `Próxima ação: ${item.next_action}`, type: 'action' })

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
                        {c.type === 'phone' ? <Phone className="w-4 h-4" style={{ color: VL }} /> : <Edit3 className="w-4 h-4" style={{ color: AMBER }} />}
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
                  <button onClick={() => { if (newContact.trim()) { setForm(p => ({ ...p, notes: `[${new Date().toLocaleDateString('pt-BR')}] ${newContact}\n` + (p.notes || '') })); setNewContact('') } }}
                    className="px-3 py-2 text-white text-xs font-bold rounded-lg" style={{ background: VL }}>
                    + Log
                  </button>
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">Registrado nas Notas · Enter para salvar</div>
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