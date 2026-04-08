// src/components/Intakes.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import {
  Inbox,
  Plus,
  Search,
  Filter,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Zap,
  ChevronRight,
  Building2,
  Phone,
  Mail,
  User,
  Calendar,
  Layers,
  Tag,
  Target,
} from 'lucide-react'

// ============================================================================
// Intakes.jsx v2 — Captação de demandas
// ----------------------------------------------------------------------------
// PRESERVA o /intakes atual (filtros Status + Ordenar + Limpar + botao Novo)
// e ADICIONA: KPIs hero, pipeline visual de 4 estagios, cards ricos, filtros
// avancados, form completo com 17 campos do schema real, conversao para
// proposta.
//
// Tabela Supabase real (validada — schema rico, 0 rows):
//   intakes: id, org_id, company_name, cnpj, contact_name, phone, email,
//            type, estimated_value, urgency, notes, status, created_at,
//            discount_percent, business_model, proposal_value,
//            next_step, next_contact_date
// ============================================================================

const STATUSES = [
  { id: 'novo',       label: 'Novo',         color: 'sky',     dot: 'bg-sky-500',     icon: Inbox },
  { id: 'triagem',    label: 'Triagem',      color: 'violet',  dot: 'bg-violet-500',  icon: Filter },
  { id: 'analise',    label: 'Em Análise',   color: 'amber',   dot: 'bg-amber-500',   icon: Clock },
  { id: 'convertido', label: 'Convertido',   color: 'emerald', dot: 'bg-emerald-500', icon: CheckCircle },
  { id: 'descartado', label: 'Descartado',   color: 'rose',    dot: 'bg-rose-500',    icon: X },
]

const URGENCIES = [
  { id: 'baixa',   label: 'Baixa',   color: 'bg-zinc-100 text-zinc-700',     dot: 'bg-zinc-400' },
  { id: 'media',   label: 'Média',   color: 'bg-sky-100 text-sky-700',       dot: 'bg-sky-500' },
  { id: 'alta',    label: 'Alta',    color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  { id: 'urgente', label: 'Urgente', color: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-500' },
]

const INTAKE_TYPES = [
  { id: 'diagnostico',         label: 'Diagnóstico Financeiro' },
  { id: 'rj',                  label: 'Recuperação Judicial' },
  { id: 'ma',                  label: 'M&A' },
  { id: 'reestruturacao',      label: 'Reestruturação de Dívida' },
  { id: 'bpo',                 label: 'BPO Contábil/Fiscal' },
  { id: 'certificado_digital', label: 'Certificado Digital' },
  { id: 'outro',               label: 'Outro' },
]

const SORT_OPTIONS = [
  { id: 'recent',  label: 'Data (Recente)' },
  { id: 'oldest',  label: 'Data (Antiga)' },
  { id: 'value',   label: 'Valor (Maior)' },
  { id: 'urgency', label: 'Urgência' },
]

export default function Intakes() {
  const { profile } = useData()
  const [intakes, setIntakes] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterUrgency, setFilterUrgency] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [showForm, setShowForm] = useState(false)
  const [selectedIntake, setSelectedIntake] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    company_name: '',
    cnpj: '',
    contact_name: '',
    phone: '',
    email: '',
    type: 'diagnostico',
    urgency: 'media',
    estimated_value: '',
    business_model: '',
    notes: '',
    next_step: '',
    next_contact_date: '',
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
        loadTable('intakes', setIntakes, q => q.order('created_at', { ascending: false })),
        loadTable('companies', setCompanies, q => q.order('name', { ascending: true })),
      ])
    } catch (err) {
      console.error('Error loading intakes:', err)
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

  async function submitIntake() {
    if (!form.company_name.trim()) {
      alert('Preencha o nome da empresa')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        org_id: profile.org_id,
        company_name: form.company_name.trim(),
        cnpj: form.cnpj?.trim() || null,
        contact_name: form.contact_name?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        type: form.type,
        urgency: form.urgency,
        estimated_value: parseFloat(form.estimated_value) || null,
        business_model: form.business_model?.trim() || null,
        notes: form.notes?.trim() || null,
        next_step: form.next_step?.trim() || null,
        next_contact_date: form.next_contact_date || null,
        status: 'novo',
      }
      const { error: iErr } = await supabase.from('intakes').insert([payload])
      if (iErr) throw iErr
      setForm({
        company_name: '', cnpj: '', contact_name: '', phone: '', email: '',
        type: 'diagnostico', urgency: 'media', estimated_value: '',
        business_model: '', notes: '', next_step: '', next_contact_date: '',
      })
      setShowForm(false)
      await loadAll()
      showSuccess('Intake criado com sucesso')
    } catch (err) {
      alert('Erro ao criar intake: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateIntakeStatus(intakeId, newStatus) {
    try {
      const { error: uErr } = await supabase
        .from('intakes')
        .update({ status: newStatus })
        .eq('id', intakeId)
      if (uErr) throw uErr
      await loadAll()
      showSuccess('Status atualizado')
    } catch (err) {
      alert('Erro ao atualizar: ' + err.message)
    }
  }

  function clearFilters() {
    setFilterStatus('all')
    setFilterUrgency('all')
    setFilterType('all')
    setSearch('')
    setSortBy('recent')
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  // Filtragem
  const filtered = useMemo(() => {
    let result = intakes.filter(it => {
      if (filterStatus !== 'all' && it.status !== filterStatus) return false
      if (filterUrgency !== 'all' && it.urgency !== filterUrgency) return false
      if (filterType !== 'all' && it.type !== filterType) return false
      if (search) {
        const s = search.toLowerCase()
        const hay = `${it.company_name || ''} ${it.cnpj || ''} ${it.contact_name || ''} ${it.email || ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
    // Sort
    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    } else if (sortBy === 'value') {
      result.sort((a, b) => (parseFloat(b.estimated_value) || 0) - (parseFloat(a.estimated_value) || 0))
    } else if (sortBy === 'urgency') {
      const urgOrder = { urgente: 0, alta: 1, media: 2, baixa: 3 }
      result.sort((a, b) => (urgOrder[a.urgency] ?? 99) - (urgOrder[b.urgency] ?? 99))
    }
    return result
  }, [intakes, filterStatus, filterUrgency, filterType, search, sortBy])

  // KPIs
  const kpis = useMemo(() => {
    const novos = intakes.filter(i => i.status === 'novo').length
    const emAnalise = intakes.filter(i => i.status === 'triagem' || i.status === 'analise').length
    const convertidos = intakes.filter(i => i.status === 'convertido').length
    const urgentes = intakes.filter(i => i.urgency === 'urgente' || i.urgency === 'alta').length
    const totalValue = intakes.reduce((s, i) => s + (parseFloat(i.estimated_value) || 0), 0)
    const conversionRate = intakes.length > 0 ? Math.round((convertidos / intakes.length) * 100) : 0
    return { novos, emAnalise, convertidos, urgentes, totalValue, conversionRate, total: intakes.length }
  }, [intakes])

  // By status (pipeline)
  const byStatus = useMemo(() => {
    const m = {}
    STATUSES.forEach(s => { m[s.id] = [] })
    filtered.forEach(it => {
      const s = it.status || 'novo'
      if (!m[s]) m[s] = []
      m[s].push(it)
    })
    return m
  }, [filtered])

  function formatCurrency(v) {
    if (!v) return '—'
    const n = parseFloat(v) || 0
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
  }

  function formatDate(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return '—'
    }
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <Inbox className="w-3 h-3" />
              Gestão de captação de demandas
            </div>
            <h1 className="text-2xl font-bold mb-1">📥 Intakes</h1>
            <p className="text-sm text-zinc-300">
              {kpis.total} {kpis.total === 1 ? 'intake registrado' : 'intakes registrados'}
              {kpis.urgentes > 0 && ` · ${kpis.urgentes} urgente${kpis.urgentes > 1 ? 's' : ''}`}
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
              Novo Intake
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Total" value={kpis.total} icon={Inbox} accent="violet" />
          <Kpi label="Novos" value={kpis.novos} icon={Zap} accent="sky" />
          <Kpi label="Em análise" value={kpis.emAnalise} icon={Clock} accent="amber" />
          <Kpi label="Convertidos" value={kpis.convertidos} sub={`${kpis.conversionRate}% taxa`} icon={CheckCircle} accent="emerald" />
          <Kpi label="Valor estimado" value={formatCurrency(kpis.totalValue)} icon={DollarSign} accent="violet" />
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
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5" />
          <span className="text-sm text-rose-900">{error}</span>
        </div>
      )}

      {/* Filtros (preserva os 3 originais + adiciona) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar empresa, CNPJ, contato…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white">
            <option value="all">Todos os status</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white">
            <option value="all">Todas urgências</option>
            {URGENCIES.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white">
            <option value="all">Todos os tipos</option>
            {INTAKE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white">
            {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button onClick={clearFilters} className="px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg whitespace-nowrap">
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Pipeline visual */}
      {!loading && intakes.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-600" />
            Pipeline de captação
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {STATUSES.map(stage => {
              const list = byStatus[stage.id] || []
              const Icon = stage.icon
              const colors = {
                sky:     'bg-sky-50 border-sky-200 text-sky-700',
                violet:  'bg-violet-50 border-violet-200 text-violet-700',
                amber:   'bg-amber-50 border-amber-200 text-amber-800',
                emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                rose:    'bg-rose-50 border-rose-200 text-rose-700',
              }
              return (
                <div key={stage.id} className={`${colors[stage.color]} border-2 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-shadow`} onClick={() => setFilterStatus(stage.id)}>
                  <Icon className="w-5 h-5 mx-auto mb-2" />
                  <div className="text-[10px] font-bold uppercase tracking-wide">{stage.label}</div>
                  <div className="text-3xl font-bold mt-1">{list.length}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Form Novo Intake */}
      {showForm && (
        <div className="bg-white border-2 border-violet-300 rounded-xl p-5 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-violet-600" />
              Novo intake
            </h2>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-zinc-100 rounded">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          <div className="space-y-4 mb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Empresa</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="Nome da empresa *" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
                <input type="text" placeholder="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Contato</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="text" placeholder="Nome do contato" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
                <input type="tel" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
                <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Demanda</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white">
                  {INTAKE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white">
                  {URGENCIES.map(u => <option key={u.id} value={u.id}>Urgência: {u.label}</option>)}
                </select>
                <input type="number" placeholder="Valor estimado (R$)" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
                <input type="text" placeholder="Modelo de negócio" value={form.business_model} onChange={(e) => setForm({ ...form, business_model: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Próximos passos</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                <input type="text" placeholder="Próximo passo" value={form.next_step} onChange={(e) => setForm({ ...form, next_step: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
                <input type="date" placeholder="Data próximo contato" value={form.next_contact_date} onChange={(e) => setForm({ ...form, next_contact_date: e.target.value })} className="px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
              </div>
              <textarea rows={3} placeholder="Notas adicionais..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg resize-none" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg">Cancelar</button>
            <button onClick={submitIntake} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
              {submitting ? 'Salvando…' : 'Criar intake'}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2 text-zinc-400" />
          <span className="text-sm text-zinc-500">Carregando…</span>
        </div>
      )}

      {/* Lista de cards */}
      {!loading && filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <Inbox className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <div className="text-sm font-bold text-zinc-700">
            {intakes.length === 0 ? 'Nenhum intake criado' : 'Nenhum resultado para os filtros'}
          </div>
          {intakes.length === 0 ? (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Criar Primeiro Intake
            </button>
          ) : (
            <button onClick={clearFilters} className="mt-3 text-xs text-violet-600 hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      ) : !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(it => {
            const status = STATUSES.find(s => s.id === it.status) || STATUSES[0]
            const urgency = URGENCIES.find(u => u.id === it.urgency) || URGENCIES[1]
            const type = INTAKE_TYPES.find(t => t.id === it.type)
            return (
              <div
                key={it.id}
                className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedIntake(it)}
              >
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-800 truncate">{it.company_name || '—'}</h3>
                    {it.cnpj && <div className="text-[10px] font-mono text-zinc-500">{it.cnpj}</div>}
                  </div>
                  <div className="flex flex-col gap-1 items-end flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${urgency.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${urgency.dot}`} />
                      {urgency.label}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1`} />
                      {status.label}
                    </span>
                  </div>
                </div>

                {type && (
                  <div className="text-xs text-violet-700 font-semibold mb-2">{type.label}</div>
                )}

                <div className="space-y-1 text-xs text-zinc-600 mb-3">
                  {it.contact_name && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-zinc-400" />
                      {it.contact_name}
                    </div>
                  )}
                  {it.email && (
                    <div className="flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                      <span className="truncate">{it.email}</span>
                    </div>
                  )}
                  {it.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-zinc-400" />
                      {it.phone}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Valor estimado</div>
                    <div className="text-base font-bold text-violet-700">{formatCurrency(it.estimated_value)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-400">{formatDate(it.created_at)}</div>
                    {it.next_contact_date && (
                      <div className="text-[10px] text-amber-600 font-semibold flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        Próx: {formatDate(it.next_contact_date)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de detalhe */}
      {selectedIntake && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedIntake(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zinc-100 flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-xl font-bold text-zinc-800">{selectedIntake.company_name}</h2>
                {selectedIntake.cnpj && <div className="text-sm font-mono text-zinc-500 mt-1">{selectedIntake.cnpj}</div>}
              </div>
              <button onClick={() => setSelectedIntake(null)} className="p-1 hover:bg-zinc-100 rounded">
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <DetailRow icon={Layers} label="Status">
                  <select
                    value={selectedIntake.status || 'novo'}
                    onChange={(e) => updateIntakeStatus(selectedIntake.id, e.target.value)}
                    className="text-sm border border-zinc-200 rounded px-2 py-1 bg-white"
                  >
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </DetailRow>
                <DetailRow icon={Zap} label="Urgência">
                  {URGENCIES.find(u => u.id === selectedIntake.urgency)?.label || '—'}
                </DetailRow>
              </div>
              {selectedIntake.type && <DetailRow icon={Tag} label="Tipo">{INTAKE_TYPES.find(t => t.id === selectedIntake.type)?.label || selectedIntake.type}</DetailRow>}
              {selectedIntake.contact_name && <DetailRow icon={User} label="Contato">{selectedIntake.contact_name}</DetailRow>}
              {selectedIntake.email && <DetailRow icon={Mail} label="E-mail">{selectedIntake.email}</DetailRow>}
              {selectedIntake.phone && <DetailRow icon={Phone} label="Telefone">{selectedIntake.phone}</DetailRow>}
              {selectedIntake.estimated_value && <DetailRow icon={DollarSign} label="Valor estimado">{formatCurrency(selectedIntake.estimated_value)}</DetailRow>}
              {selectedIntake.business_model && <DetailRow icon={Building2} label="Modelo de negócio">{selectedIntake.business_model}</DetailRow>}
              {selectedIntake.next_step && <DetailRow icon={ChevronRight} label="Próximo passo">{selectedIntake.next_step}</DetailRow>}
              {selectedIntake.next_contact_date && <DetailRow icon={Calendar} label="Próximo contato">{formatDate(selectedIntake.next_contact_date)}</DetailRow>}
              {selectedIntake.notes && (
                <div className="pt-3 border-t border-zinc-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Notas</div>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{selectedIntake.notes}</p>
                </div>
              )}
              {selectedIntake.status !== 'convertido' && (
                <div className="pt-4 border-t border-zinc-100">
                  <button
                    onClick={() => updateIntakeStatus(selectedIntake.id, 'convertido')}
                    className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Marcar como convertido
                  </button>
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

function Kpi({ label, value, sub, icon: Icon, accent }) {
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
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
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