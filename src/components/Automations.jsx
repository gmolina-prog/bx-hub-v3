import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'
import {
  Zap,
  Plus,
  X,
  Mail,
  Calendar,
  MessageSquare,
  Bell,
  BarChart3,
  FileText,
  Trash2,
  Power,
  ArrowRight,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

// ============================================================================
// Automations.jsx — Workflows e gatilhos
// ----------------------------------------------------------------------------
// Reusa a tabela automation_rules que já existe no Supabase:
//   id, org_id, name, trigger_desc, action_desc, is_active, created_at
// Campos opcionais novos (adicionar via ALTER se quiser):
//   icon text, category text, last_run timestamptz, run_count int
// ============================================================================

const TEMPLATES = [
  {
    id: 'task-overdue',
    icon: Mail,
    color: 'violet',
    title: 'Notificar atraso de tarefa',
    subtitle: 'Trigger · Email',
    description: 'Quando uma tarefa fica vencida há 1 dia, envia email automático para o responsável e seu líder.',
    economy: '2h/sem',
    trigger: 'Tarefa vencida há mais de 1 dia',
    action: 'Enviar email para responsável e líder direto',
  },
  {
    id: 'routine-tasks',
    icon: FileText,
    color: 'emerald',
    title: 'Criar tarefas de rotina',
    subtitle: 'Agendado · Rotinas',
    description: 'Toda segunda às 8h, cria automaticamente as tarefas semanais de rotina para cada consultor.',
    economy: '3h/sem',
    trigger: 'Toda segunda-feira às 8h',
    action: 'Criar tarefas recorrentes da semana para cada consultor',
  },
  {
    id: 'crm-followup',
    icon: ArrowRight,
    color: 'sky',
    title: 'Follow-up CRM automático',
    subtitle: 'CRM · Email',
    description: 'Após 7 dias sem atividade em proposta enviada, cria task de follow-up para o responsável.',
    economy: '1h/sem',
    trigger: 'Proposta enviada sem atividade há 7 dias',
    action: 'Criar task de follow-up para responsável',
  },
  {
    id: 'risk-alert',
    icon: Bell,
    color: 'amber',
    title: 'Alerta risco crítico',
    subtitle: 'Riscos · Slack',
    description: 'Quando um risco entra em estado crítico (score ≥ 16), notifica o canal Slack imediatamente.',
    economy: 'imediato',
    trigger: 'Risco com score ≥ 16',
    action: 'Notificar canal Slack #avisos',
  },
  {
    id: 'gcal-sync',
    icon: Calendar,
    color: 'rose',
    title: 'Sync Google Calendar',
    subtitle: 'Trigger · Calendário',
    description: 'Quando uma reunião é criada no Google Calendar, cria automaticamente uma nota de reunião no Hub.',
    economy: '2h/sem',
    trigger: 'Novo evento no Google Calendar',
    action: 'Criar nota de reunião no Hub',
  },
  {
    id: 'weekly-report',
    icon: BarChart3,
    color: 'indigo',
    title: 'Relatório semanal automático',
    subtitle: 'Agendado · Email',
    description: 'Toda sexta às 17h, gera e envia relatório de status dos projetos para cada cliente.',
    economy: '4h/sem',
    trigger: 'Toda sexta-feira às 17h',
    action: 'Gerar e enviar relatório de status por email',
  },
]

const COLOR_MAP = {
  violet: { border: 'border-l-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
  emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  sky: { border: 'border-l-sky-500', bg: 'bg-sky-50', text: 'text-sky-700' },
  amber: { border: 'border-l-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  rose: { border: 'border-l-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
  indigo: { border: 'border-l-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700' },
}

const INTEGRATIONS = [
  { icon: '📧', name: 'Gmail' },
  { icon: '📅', name: 'Google Calendar' },
  { icon: '💬', name: 'Slack' },
  { icon: '📝', name: 'Notion' },
  { icon: '☁', name: 'Drive' },
  { icon: '🤖', name: 'Claude AI' },
  { icon: '⚖', name: 'DataJud' },
  { icon: '📊', name: 'Power BI' },
]

export default function Automations() {
  const { profile } = useData()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    trigger_desc: '',
    action_desc: '',
  })
  const [successMsg, setSuccessMsg] = useState(null)

  useEffect(() => {
    if (profile?.org_id) loadRules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id])

  async function loadRules() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('org_id', profile?.org_id)
        .order('created_at', { ascending: false })
      if (qErr) throw qErr
      setRules(data || [])
    } catch (err) {
      console.error('Error loading automation rules:', err)
      setError(err.message || 'Erro ao carregar automações')
    } finally {
      setLoading(false)
    }
  }

  async function toggleRuleActive(ruleId, currentStatus) {
    try {
      const { error: uErr } = await supabase
        .from('automation_rules')
        .update({ is_active: !currentStatus })
        .eq('id', ruleId)
      if (uErr) throw uErr
      await loadRules()
      showSuccess(currentStatus ? 'Automação desativada' : 'Automação ativada')
    } catch (err) {
      console.error('Error toggling rule:', err)
      toast.error(`Erro ao atualizar regra: ` + (err.message || 'desconhecido'))
    }
  }

  async function deleteRule(ruleId) {
    if (!confirm('Tem certeza que deseja excluir esta automação? Esta ação não pode ser desfeita.')) return
    try {
      const { error: dErr } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', ruleId)
      if (dErr) throw dErr
      await loadRules()
      showSuccess('Automação excluída')
    } catch (err) {
      console.error('Error deleting rule:', err)
      toast.error(`Erro ao excluir regra: ` + (err.message || 'desconhecido'))
    }
  }

  async function submitForm() {
    if (!formData.name.trim() || !formData.trigger_desc.trim() || !formData.action_desc.trim()) {
      toast.warning('Por favor, preencha todos os campos')
      return
    }
    if (!profile?.org_id) {
      toast.warning('Perfil do usuário não carregado. Tente novamente em alguns segundos.')
      return
    }

    setSubmitting(true)
    try {
      const { error: iErr } = await supabase
        .from('automation_rules')
        .insert([{
          org_id: profile.org_id,
          name: formData.name.trim(),
          trigger_desc: formData.trigger_desc.trim(),
          action_desc: formData.action_desc.trim(),
          is_active: false,
        }])
      if (iErr) throw iErr
      setFormData({ name: '', trigger_desc: '', action_desc: '' })
      setShowForm(false)
      await loadRules()
      showSuccess('Automação criada com sucesso! Ative para começar a rodar.')
    } catch (err) {
      console.error('Error creating rule:', err)
      toast.error(`Erro ao criar automação: ` + (err.message || 'desconhecido'))
    } finally {
      setSubmitting(false)
    }
  }

  function useTemplate(tpl) {
    setFormData({
      name: tpl.title,
      trigger_desc: tpl.trigger,
      action_desc: tpl.action,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  // KPIs
  const activeCount = rules.filter(r => r.is_active).length
  const draftCount = rules.filter(r => !r.is_active).length
  const totalEconomy = activeCount * 2 // rough estimate 2h/sem per active rule

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1">
              Workflows e gatilhos
            </div>
            <h1 className="text-2xl font-bold mb-1">Automações</h1>
            <p className="text-sm text-zinc-300">
              {activeCount} ativas · {draftCount} em rascunho · {TEMPLATES.length} templates prontos
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova automação
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Ativas" value={activeCount} accent="violet" />
          <Kpi label="Economia est." value={`${totalEconomy}h`} sub="por semana" accent="emerald" />
          <Kpi label="Templates" value={TEMPLATES.length} accent="sky" />
          <Kpi label="Em rascunho" value={draftCount} accent="amber" />
          <Kpi label="Total regras" value={rules.length} accent="rose" />
        </div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-900 font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-rose-900">
            <div className="font-bold">Erro ao carregar automações</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      )}

      {/* Create form (inline) */}
      {showForm && (
        <div className="bg-white border-2 border-violet-300 rounded-xl p-5 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-600" />
              Nova automação
            </h2>
            <button
              onClick={() => {
                setShowForm(false)
                setFormData({ name: '', trigger_desc: '', action_desc: '' })
              }}
              className="p-1 hover:bg-zinc-100 rounded"
            >
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Nome da automação
              </label>
              <input
                type="text"
                placeholder="Ex: Notificar atraso de tarefa"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Gatilho (quando?)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Tarefa vencida há mais de 1 dia"
                value={formData.trigger_desc}
                onChange={(e) => setFormData({ ...formData, trigger_desc: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Ação (o quê?)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Enviar email para responsável e líder direto"
                value={formData.action_desc}
                onChange={(e) => setFormData({ ...formData, action_desc: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100">
              <button
                onClick={() => {
                  setShowForm(false)
                  setFormData({ name: '', trigger_desc: '', action_desc: '' })
                }}
                className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={submitForm}
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                Criar automação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active rules list */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center mb-6">
          <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2 text-zinc-400" />
          <span className="text-sm text-zinc-500">Carregando automações…</span>
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-gradient-to-br from-violet-50 to-white border-2 border-dashed border-violet-200 rounded-xl p-12 text-center mb-6">
          <div className="w-16 h-16 bg-violet-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Zap className="w-8 h-8 text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-zinc-800 mb-2">Nenhuma automação criada</h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-5">
            Automatize tarefas repetitivas: notificações, criação de tarefas a partir de eventos,
            follow-ups, sync entre módulos e muito mais.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold"
            >
              Criar primeira automação
            </button>
            <button
              onClick={() => document.getElementById('templates-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-5 py-2.5 bg-white border border-violet-300 text-violet-700 hover:bg-violet-50 rounded-lg text-sm font-semibold"
            >
              Ver templates prontos
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-600" />
              Suas automações
              <span className="ml-auto text-xs text-zinc-500 font-semibold">
                {rules.length} {rules.length === 1 ? 'regra' : 'regras'}
              </span>
            </h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {rules.map(rule => (
              <div key={rule.id} className="px-5 py-4 hover:bg-zinc-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    rule.is_active ? 'bg-emerald-100' : 'bg-zinc-100'
                  }`}>
                    <Zap className={`w-5 h-5 ${rule.is_active ? 'text-emerald-600' : 'text-zinc-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-zinc-800 truncate">{rule.name}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                            rule.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {rule.is_active ? '● Ativa' : '○ Rascunho'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleRuleActive(rule.id, rule.is_active)}
                          className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                            rule.is_active
                              ? 'text-zinc-600 hover:bg-zinc-100'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                          title={rule.is_active ? 'Desativar' : 'Ativar'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="bg-zinc-50 rounded-lg px-3 py-2">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">Quando</div>
                        <div className="text-zinc-700">{rule.trigger_desc}</div>
                      </div>
                      <div className="bg-zinc-50 rounded-lg px-3 py-2">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">Faz o quê</div>
                        <div className="text-zinc-700">{rule.action_desc}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Templates */}
      <div id="templates-section" className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-600" />
            Templates recomendados
          </h2>
          <span className="text-xs text-zinc-500 font-semibold">{TEMPLATES.length} disponíveis</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map(tpl => {
            const Icon = tpl.icon
            const c = COLOR_MAP[tpl.color] || COLOR_MAP.violet
            return (
              <div
                key={tpl.id}
                className={`bg-white border border-zinc-200 border-l-4 ${c.border} rounded-xl p-4 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800 leading-tight">{tpl.title}</h3>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{tpl.subtitle}</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed mb-3">{tpl.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                  <span className={`text-[10px] font-bold ${c.text}`}>⚡ Economia: {tpl.economy}</span>
                  <button
                    onClick={() => useTemplate(tpl)}
                    className="px-3 py-1 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-md"
                  >
                    Usar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* How it works + integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-600" />
            Como funciona
          </h2>
          <div className="space-y-4">
            {[
              { n: 1, title: 'Escolha um gatilho', desc: 'Quando algo acontecer no Hub (tarefa criada, prazo vencido, risco identificado…)' },
              { n: 2, title: 'Defina condições', desc: 'Filtros opcionais: só projetos críticos, só tarefas do consultor X, só clientes do tipo Y…' },
              { n: 3, title: 'Configure as ações', desc: 'Enviar email, criar tarefa, postar no Slack, atualizar status, gerar relatório…' },
            ].map(step => (
              <div key={step.n} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step.n}
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-800">{step.title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-600" />
            Integrações disponíveis
            <span className="ml-auto text-xs text-zinc-500 font-semibold">{INTEGRATIONS.length} conectores</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {INTEGRATIONS.map(i => (
              <div key={i.name} className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg">
                <span className="text-base">{i.icon}</span>
                <span className="text-xs font-semibold text-zinc-700">{i.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  )
}
