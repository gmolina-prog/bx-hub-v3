import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'
import {
  Users,
  FileText,
  TrendingUp,
  Sparkles,
  Plus,
  X,
  RefreshCw,
  AlertCircle,
  Mail,
  Phone,
  MessageCircle,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Handshake,
  Edit3,
  Trash2,
  Building2,
} from 'lucide-react'

// ============================================================================
// CRM.jsx — CRM Comercial (Propostas + Cross-sell + Forecast)
// ----------------------------------------------------------------------------
// Refatoração completa do CRM atual. Mantém compatibilidade com:
//   - companies (tabela existente)
//   - crm_interactions (tabela existente — usada no fluxo "Nova Interação")
//   - proposals (tabela existente — KPI já mostra contagem)
//
// Usa .select('*') em todas as queries para não assumir colunas específicas.
// Se uma tabela não existir, mostra empty state em vez de quebrar.
// ============================================================================

const TABS = [
  { id: 'overview', label: 'Visão geral', icon: TrendingUp },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'proposals', label: 'Propostas', icon: FileText },
  { id: 'crosssell', label: 'Cross-sell', icon: Sparkles },
  { id: 'forecast', label: 'Forecast', icon: TrendingUp },
]

// IMPORTANTE: status real do banco e em PORTUGUES minusculo
// Valor confirmado em producao: 'enviada'
// Demais valores assumidos seguindo o padrao do funil
const STAGES = [
  { id: 'rascunho', label: 'Rascunho', icon: Edit3, color: 'zinc', pct: 5 },
  { id: 'enviada', label: 'Enviada', icon: Send, color: 'violet', pct: 30 },
  { id: 'negociando', label: 'Negociando', icon: Handshake, color: 'amber', pct: 60 },
  { id: 'aceita', label: 'Aceita', icon: CheckCircle, color: 'emerald', pct: 100 },
  { id: 'perdida', label: 'Perdida', icon: XCircle, color: 'rose', pct: 0 },
]

const STAGE_COLORS = {
  zinc: { bg: 'bg-zinc-50', border: 'border-zinc-300', text: 'text-zinc-700', chip: 'bg-zinc-100 text-zinc-700' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', chip: 'bg-violet-100 text-violet-700' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', chip: 'bg-amber-100 text-amber-700' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', chip: 'bg-rose-100 text-rose-700' },
}

// companies.criticality valores reais do banco: 'alto', 'critico'
// Os outros sao assumidos seguindo escala de criticidade
const HEALTH_BUCKETS = [
  { id: 'baixo', label: 'Baixo risco', icon: '🟢', color: 'emerald' },
  { id: 'medio', label: 'Médio risco', icon: '🔵', color: 'sky' },
  { id: 'alto', label: 'Alto risco', icon: '🟡', color: 'amber' },
  { id: 'critico', label: 'Crítico', icon: '🔴', color: 'rose' },
]

const INTERACTION_TYPES = [
  { id: 'meeting', label: 'Reunião', icon: Briefcase },
  { id: 'call', label: 'Ligação', icon: Phone },
  { id: 'email', label: 'E-mail', icon: Mail },
  { id: 'visit', label: 'Visita', icon: Users },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'note', label: 'Nota', icon: FileText },
]

export default function CRM() {
  const { profile } = useData()
  usePageTitle('CRM')
  const [activeTab, setActiveTab] = useState('overview')
  const [clientSearch, setClientSearch] = useState('')
  const [companies, setCompanies] = useState([])
  const [proposals, setProposals] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Forms
  const [showProposalForm, setShowProposalForm] = useState(false)
  const [showInteractionForm, setShowInteractionForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [proposalForm, setProposalForm] = useState({
    company_id: '',
    title: '',
    service_type: 'diagnostico',
    value: '',
    status: 'rascunho',
    contact_name: '',
    notes: '',
  })
  const [interactionForm, setInteractionForm] = useState({
    company_id: '',
    type: 'meeting',
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
      // Tabela real e `client_interactions` (nao crm_interactions)
      const [companiesRes, proposalsRes, interactionsRes] = await Promise.allSettled([
        loadTable('companies'),
        loadTable('proposals'),
        loadTable('client_interactions'),
      ])
      if (companiesRes.status    === 'fulfilled') setCompanies(companiesRes.value    || [])
      if (proposalsRes.status    === 'fulfilled') setProposals(proposalsRes.value    || [])
      if (interactionsRes.status === 'fulfilled') setInteractions(interactionsRes.value || [])
    } catch (err) {
      console.error('Error loading CRM data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadTable(tableName) {
    try {
      const { data, error: qErr } = await supabase
        .from(tableName)
        .select('*')
        .eq('org_id', profile?.org_id)
        .order('created_at', { ascending: false })
      if (qErr) {
        console.warn(`Table ${tableName}:`, qErr.message)
        return []
      }
      return data || []
    } catch (err) {
      console.warn(`Table ${tableName} not accessible:`, err.message)
      return []
    }
  }

  async function submitProposal() {
    if (!proposalForm.company_id || !proposalForm.title.trim()) {
      toast.warning('Selecione um cliente e preencha o título')
      return
    }
    setSubmitting(true)
    try {
      // Schema real: id, org_id, company_id, title, value, status, service_type,
      //              contact_name, sent_date, notes, loss_reason, created_by, created_at
      const payload = {
        org_id: profile.org_id,
        company_id: proposalForm.company_id,
        title: proposalForm.title.trim(),
        service_type: proposalForm.service_type,
        value: parseFloat(proposalForm.value) || 0,
        status: proposalForm.status,
        contact_name: proposalForm.contact_name?.trim() || null,
        notes: proposalForm.notes?.trim() || null,
        sent_date: proposalForm.status === 'enviada' ? new Date().toISOString().slice(0, 10) : null,
      }
      const { error: iErr } = await supabase.from('proposals').insert([payload])
      if (iErr) throw iErr
      setProposalForm({ company_id: '', title: '', service_type: 'diagnostico', value: '', status: 'rascunho', contact_name: '', notes: '' })
      setShowProposalForm(false)
      await loadAll()
      toast.success('Proposta criada com sucesso')
    } catch (err) {
      toast.error(`Erro ao criar proposta: ` + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitInteraction() {
    if (!interactionForm.company_id || !interactionForm.notes.trim()) {
      toast.warning('Selecione um cliente e preencha as notas')
      return
    }
    setSubmitting(true)
    try {
      // Schema real client_interactions: id, org_id, company_id, type, content,
      //                                   contact_name, date, created_by, created_at
      const payload = {
        org_id: profile.org_id,
        company_id: interactionForm.company_id,
        type: interactionForm.type,
        content: interactionForm.notes.trim(),
        date: new Date().toISOString().slice(0, 10),
        created_by: profile.id,  // B-06: necessário para RLS e NOT NULL
      }
      const { error: iErr } = await supabase.from('client_interactions').insert([payload])
      if (iErr) throw iErr
      setInteractionForm({ company_id: '', type: 'meeting', notes: '' })
      setShowInteractionForm(false)
      await loadAll()
      toast.success('Interação registrada')
    } catch (err) {
      console.error('[CRM] client_interactions:', err)
      toast.error(`Erro ao registrar interação: ` + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateProposalStage(proposalId, newStatus) {
    try {
      const updates = { status: newStatus }
      // Se mudou pra enviada, registra data
      if (newStatus === 'enviada') {
        updates.sent_date = new Date().toISOString().slice(0, 10)
      }
      // B-172: se perdida, coletar motivo
      if (newStatus === 'perdida') {
        const reason = window.prompt('Motivo da perda (opcional):')
        if (reason === null) return // cancelou
        if (reason.trim()) updates.loss_reason = reason.trim()
      }
      const { error: uErr } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', proposalId)
        .eq('org_id', profile.org_id)
      if (uErr) throw uErr
      await loadAll()
      toast.success('Status atualizado')
    } catch (err) {
      toast.error(`Erro ao atualizar status: ` + err.message)
    }
  }

  async function deleteProposal(proposalId) {
    if (!await confirm('Excluir esta proposta? Esta ação não pode ser desfeita.', { danger: true, confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return
    try {
      const { error: dErr } = await supabase.from('proposals').delete().eq('id', proposalId).eq('org_id', profile.org_id)
      if (dErr) throw dErr
      await loadAll()
      toast.success('Proposta excluída')
    } catch (err) {
      toast.error(`Erro ao excluir: ` + err.message)
    }
  }

  // B-114: showSuccess migrado para toast.success()

  // ===== KPIs derivados =====
  const kpis = useMemo(() => {
    const won = proposals.filter(p => p.status === 'aceita')
    const active = proposals.filter(p => !['aceita', 'perdida'].includes(p.status))
    const closed = proposals.filter(p => ['aceita', 'perdida'].includes(p.status))
    const sumValue = arr => arr.reduce((s, p) => s + (parseFloat(p.value) || 0), 0)

    const wonValue = sumValue(won)
    const activeValue = sumValue(active)
    const winRate = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0
    const ticketMedio = won.length > 0 ? wonValue / won.length : 0

    // Forecast ponderado
    const forecastWeighted = active.reduce((s, p) => {
      const stage = STAGES.find(x => x.id === p.status)
      const probability = (stage?.pct || 0) / 100
      return s + (parseFloat(p.value) || 0) * probability
    }, 0)

    return {
      won: { count: won.length, value: wonValue },
      active: { count: active.length, value: activeValue },
      winRate,
      ticketMedio,
      total: proposals.length,
      forecastWeighted,
    }
  }, [proposals])

  // Group proposals by status (campo real do banco)
  const byStage = useMemo(() => {
    const map = {}
    STAGES.forEach(s => { map[s.id] = [] })
    proposals.forEach(p => {
      const stage = p.status || 'rascunho'
      if (!map[stage]) map[stage] = []
      map[stage].push(p)
    })
    return map
  }, [proposals])

  // Helper: company by id
  const companyMap = useMemo(() => {
    const m = new Map()
    companies.forEach(c => m.set(c.id, c))
    return m
  }, [companies])

  function formatCurrency(v) {
    const n = parseFloat(v) || 0
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1">
              Comercial
            </div>
            <h1 className="text-2xl font-bold mb-1">CRM · Propostas, forecast e cross-sell</h1>
            <p className="text-sm text-zinc-300">
              {companies.length} clientes · {proposals.length} propostas · {interactions.length} interações registradas
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInteractionForm(true)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Nova interação
            </button>
            <button
              onClick={() => setShowProposalForm(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova proposta
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Kpi label="Receita ganha" value={formatCurrency(kpis.won.value)} accent="emerald" />
          <Kpi label="Pipeline ativo" value={formatCurrency(kpis.active.value)} sub={`${kpis.active.count} propostas`} accent="violet" />
          <Kpi label="Win rate" value={`${kpis.winRate}%`} accent="amber" />
          <Kpi label="Ticket médio" value={formatCurrency(kpis.ticketMedio)} accent="sky" />
          <Kpi label="Total propostas" value={kpis.total} accent="rose" />
          <Kpi label="Forecast ponderado" value={formatCurrency(kpis.forecastWeighted)} accent="violet" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 border-b border-white/10 -mb-2 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-violet-400 text-white'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Toasts */}
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

      {/* ============================================================
          Proposal Form Modal (inline)
          ============================================================ */}
      {showProposalForm && (
        <div className="bg-white border-2 border-violet-300 rounded-xl p-5 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-600" />
              Nova proposta
            </h2>
            <button onClick={() => setShowProposalForm(false)} className="p-1 hover:bg-zinc-100 rounded">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <select
              value={proposalForm.company_id}
              onChange={(e) => setProposalForm({ ...proposalForm, company_id: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none bg-white"
            >
              <option value="">Selecione o cliente…</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.full_name || c.id}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Título da proposta"
              value={proposalForm.title}
              onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
            />
            <select
              value={proposalForm.service_type}
              onChange={(e) => setProposalForm({ ...proposalForm, service_type: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none bg-white"
            >
              <option value="diagnostico">Diagnóstico</option>
              <option value="rj">RJ</option>
              <option value="finance_ma">Finance / M&amp;A</option>
              <option value="bpo">BPO</option>
              <option value="certificado_digital">Certificado Digital</option>
            </select>
            <input
              type="number"
              placeholder="Valor (R$)"
              value={proposalForm.value}
              onChange={(e) => setProposalForm({ ...proposalForm, value: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
            />
            <select
              value={proposalForm.status}
              onChange={(e) => setProposalForm({ ...proposalForm, status: e.target.value })}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none bg-white md:col-span-2"
            >
              {STAGES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowProposalForm(false)} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg">
              Cancelar
            </button>
            <button onClick={submitProposal} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
              {submitting ? 'Salvando…' : 'Criar proposta'}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          Interaction Form Modal (preserves old "Nova Interação" flow)
          ============================================================ */}
      {showInteractionForm && (
        <div className="bg-white border-2 border-violet-300 rounded-xl p-5 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-violet-600" />
              Nova interação
            </h2>
            <button onClick={() => setShowInteractionForm(false)} className="p-1 hover:bg-zinc-100 rounded">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
          <div className="space-y-3 mb-4">
            <select
              value={interactionForm.company_id}
              onChange={(e) => setInteractionForm({ ...interactionForm, company_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
            >
              <option value="">Selecione a empresa…</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.full_name || c.id}</option>
              ))}
            </select>
            <select
              value={interactionForm.type}
              onChange={(e) => setInteractionForm({ ...interactionForm, type: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
            >
              {INTERACTION_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <textarea
              rows={3}
              placeholder="Notas..."
              value={interactionForm.notes}
              onChange={(e) => setInteractionForm({ ...interactionForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowInteractionForm(false)} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg">
              Cancelar
            </button>
            <button onClick={submitInteraction} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB CONTENT
          ============================================================ */}

      {loading && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center mb-6">
          <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2 text-zinc-400" />
          <span className="text-sm text-zinc-500">Carregando…</span>
        </div>
      )}

      {/* TAB: Visão Geral */}
      {!loading && activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Funil */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-600" />
              Funil de propostas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {STAGES.map(stage => {
                const list = byStage[stage.id] || []
                const value = list.reduce((s, p) => s + (parseFloat(p.value) || 0), 0)
                const Icon = stage.icon
                const c = STAGE_COLORS[stage.color]
                return (
                  <div
                    key={stage.id}
                    className={`${c.bg} ${c.border} border-2 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-shadow`}
                    onClick={() => setActiveTab('proposals')}
                  >
                    <Icon className={`w-5 h-5 ${c.text} mx-auto mb-2`} />
                    <div className={`text-[10px] font-bold uppercase tracking-wide ${c.text}`}>{stage.label}</div>
                    <div className={`text-3xl font-bold ${c.text} mt-1`}>{list.length}</div>
                    <div className={`text-xs ${c.text} font-semibold mt-1`}>{formatCurrency(value)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Saúde dos clientes + Atividade recente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-600" />
                Saúde dos clientes
              </h2>
              <div className="space-y-3">
                {HEALTH_BUCKETS.map(b => {
                  // Use health field if exists, else default all to "good"
                  const count = companies.filter(c => (c.criticality || 'medio') === b.id).length
                  const pct = companies.length > 0 ? (count / companies.length) * 100 : 0
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-zinc-700">{b.icon} {b.label}</span>
                        <span className="font-bold text-zinc-900">{count}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={`h-full bg-${b.color}-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-600" />
                Atividade recente
              </h2>
              {interactions.length === 0 ? (
                <div className="text-center py-8 text-sm text-zinc-400">
                  Nenhuma interação registrada
                  <button
                    onClick={() => setShowInteractionForm(true)}
                    className="block mx-auto mt-3 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold"
                  >
                    + Registrar primeira
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {interactions.slice(0, 8).map(it => {
                    const company = companyMap.get(it.company_id)
                    const type = INTERACTION_TYPES.find(t => t.id === it.type) || INTERACTION_TYPES[0]
                    const Icon = type.icon
                    return (
                      <div key={it.id} className="flex items-start gap-3 p-2.5 hover:bg-zinc-50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs">
                            <span className="font-bold text-zinc-800">{type.label}</span>
                            {' · '}
                            <span className="text-zinc-600">{company?.name || company?.full_name || '—'}</span>
                          </div>
                          {it.notes && <div className="text-xs text-zinc-500 mt-0.5 truncate">{it.notes}</div>}
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            {it.created_at && new Date(it.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Clientes */}
      {!loading && activeTab === 'clients' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 bg-zinc-50">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-600" />
              Clientes
              <span className="ml-2 text-xs text-zinc-500 font-semibold">{companies.length}</span>
            </h2>
            <input
              type="text"
              placeholder="Buscar por nome ou CNPJ…"
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-violet-500 w-56"
            />
          </div>
          {(() => {
            const filteredClients = clientSearch.trim()
              ? companies.filter(co => {
                  const q = clientSearch.toLowerCase()
                  return (co.name || '').toLowerCase().includes(q) ||
                         (co.cnpj || '').toLowerCase().includes(q) ||
                         (co.segment || '').toLowerCase().includes(q)
                })
              : companies
            if (filteredClients.length === 0) return (
              <div className="p-12 text-center text-sm text-zinc-400">
                {clientSearch ? `Nenhum cliente encontrado para "${clientSearch}"` : 'Nenhum cliente cadastrado'}
              </div>
            )
            return (
              <div className="divide-y divide-zinc-100">
                {filteredClients.map(co => {
                  const clientProposals = proposals.filter(p => p.company_id === co.id)
                  const clientInteractions = interactions.filter(i => i.company_id === co.id)
                  const totalValue = clientProposals.reduce((s, p) => s + (parseFloat(p.value) || 0), 0)
                  const initials = (co.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <div key={co.id} className="px-5 py-4 hover:bg-zinc-50 grid grid-cols-[48px_2fr_1fr_1fr_1fr] gap-4 items-center">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-zinc-800 truncate">{co.name || '—'}</div>
                        <div className="text-xs text-zinc-500 truncate">{co.segment || co.cnpj || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Propostas</div>
                        <div className="text-sm font-bold text-zinc-800">{clientProposals.length}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Interações</div>
                        <div className="text-sm font-bold text-zinc-800">{clientInteractions.length}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Pipeline</div>
                        <div className="text-sm font-bold text-violet-700">{formatCurrency(totalValue)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* TAB: Propostas */}
      {!loading && activeTab === 'proposals' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-600" />
              Todas as propostas
              <span className="ml-2 text-xs text-zinc-500 font-semibold">{proposals.length}</span>
            </h2>
            <button onClick={() => setShowProposalForm(true)} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              Nova
            </button>
          </div>
          {proposals.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <div className="text-sm font-semibold text-zinc-700">Nenhuma proposta criada</div>
              <button onClick={() => setShowProposalForm(true)} className="mt-3 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold">
                Criar primeira proposta
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {proposals.map(p => {
                const company = companyMap.get(p.company_id)
                const stage = STAGES.find(s => s.id === p.status) || STAGES[0]
                const c = STAGE_COLORS[stage.color]
                return (
                  <div key={p.id} className="px-5 py-4 hover:bg-zinc-50 grid grid-cols-[2fr_1fr_140px_120px_110px_60px] gap-3 items-center">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-zinc-800 truncate">{p.title || 'Sem título'}</div>
                      <div className="text-xs text-zinc-500 truncate">{company?.name || company?.full_name || '—'}</div>
                      {p.status === 'perdida' && p.loss_reason && (
                        <div className="text-[10px] text-rose-500 font-semibold mt-0.5 truncate" title={p.loss_reason}>
                          ✗ {p.loss_reason}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-zinc-600">{p.type || '—'}</div>
                    <div>
                      <select
                        value={p.status || 'rascunho'}
                        onChange={(e) => updateProposalStage(p.id, e.target.value)}
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border-0 ${c.chip} focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer`}
                      >
                        {STAGES.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="text-sm font-bold text-zinc-800 text-right">{formatCurrency(p.value)}</div>
                    <div className="text-xs text-amber-600 font-bold text-center">{stage.pct}%</div>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => deleteProposal(p.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Cross-sell */}
      {!loading && activeTab === 'crosssell' && (
        <div className="space-y-4">
          <div className="bg-violet-50 border-l-4 border-violet-500 rounded-xl p-5">
            <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              BX Outsourcing → BX Finance
            </h3>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Clientes BPO contábil com perfil para reestruturação financeira (alavancagem alta + queda de margem nos últimos 2 trimestres).
              Oportunidade de cross-sell para diagnósticos e RJ.
            </p>

          </div>
          <div className="bg-violet-50 border-l-4 border-violet-500 rounded-xl p-5">
            <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              BX Finance → BX Certified
            </h3>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Clientes em diagnóstico ou RJ que ainda não têm certificado digital ativo. Cross-sell direto para BX Certified.
            </p>
          </div>
          <div className="bg-violet-50 border-l-4 border-violet-500 rounded-xl p-5">
            <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              BX Finance → BX Outsourcing
            </h3>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Pós-RJ: clientes que saíram da recuperação judicial e precisam de estrutura contábil/fiscal robusta. BPO BX Outsourcing.
            </p>
          </div>
        </div>
      )}

      {/* TAB: Forecast */}
      {!loading && activeTab === 'forecast' && (
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            Forecast trimestral
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-50 rounded-xl p-5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pessimista</div>
              <div className="text-3xl font-bold text-zinc-800 mt-2">{formatCurrency(kpis.won.value)}</div>
              <div className="text-[10px] text-zinc-500 mt-1">só Aceitas</div>
            </div>
            <div className="bg-violet-50 border-2 border-violet-300 rounded-xl p-5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Realista</div>
              <div className="text-3xl font-bold text-violet-700 mt-2">{formatCurrency(kpis.forecastWeighted)}</div>
              <div className="text-[10px] text-violet-600 mt-1">ponderado por probabilidade</div>
            </div>
            <div className="bg-zinc-50 rounded-xl p-5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Otimista</div>
              <div className="text-3xl font-bold text-zinc-800 mt-2">{formatCurrency(kpis.won.value + kpis.active.value)}</div>
              <div className="text-[10px] text-zinc-500 mt-1">100% das ativas</div>
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

function Kpi({ label, value, sub, accent }) {
  const accents = {
    violet: 'text-violet-300',
    emerald: 'text-emerald-300',
    sky: 'text-sky-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
      <div className={`text-[10px] font-bold uppercase tracking-wider ${accents[accent] || 'text-zinc-300'} mb-1`}>
        {label}
      </div>
      <div className="text-xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  )
}
