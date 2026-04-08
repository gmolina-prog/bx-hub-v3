// src/components/Captacao.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
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
      alert('Preencha o nome da oportunidade')
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
      alert('Erro ao criar oportunidade: ' + err.message)
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
      alert('Erro ao mover: ' + err.message)
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

      {/* ============== MODAL DE DETALHE ============== */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zinc-100 flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-xl font-bold text-zinc-800">{selectedItem.name}</h2>
                {selectedItem.entity_name && (
                  <div className="text-sm text-zinc-500 mt-1">{selectedItem.entity_name}</div>
                )}
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-zinc-100 rounded">
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-violet-50 rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Valor</div>
                  <div className="text-2xl font-bold text-violet-700">{formatCurrency(selectedItem.value)}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Probabilidade</div>
                  <div className="text-2xl font-bold text-amber-700">{selectedItem.probability || STAGE_PROBABILITIES[selectedItem.stage]}%</div>
                </div>
              </div>

              <DetailRow icon={Layers} label="Estágio">
                <select
                  value={selectedItem.stage}
                  onChange={(e) => moveItem(selectedItem.id, e.target.value)}
                  className="text-sm border border-zinc-200 rounded px-2 py-1 bg-white"
                >
                  {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </DetailRow>
              {selectedItem.institution_name && <DetailRow icon={Landmark} label="Instituição">{selectedItem.institution_name}</DetailRow>}
              {selectedItem.contact_name && <DetailRow icon={User} label="Contato">{selectedItem.contact_name}</DetailRow>}
              {selectedItem.expected_close && <DetailRow icon={Calendar} label="Fechamento">{new Date(selectedItem.expected_close).toLocaleDateString('pt-BR')}</DetailRow>}
              {selectedItem.next_action && <DetailRow icon={ChevronRight} label="Próxima ação">{selectedItem.next_action}</DetailRow>}
              {selectedItem.last_contact && <DetailRow icon={Clock} label="Último contato">{new Date(selectedItem.last_contact).toLocaleDateString('pt-BR')}</DetailRow>}
              {selectedItem.notes && (
                <div className="pt-3 border-t border-zinc-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Notas</div>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{selectedItem.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

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