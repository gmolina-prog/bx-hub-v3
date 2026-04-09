import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'
import {
  Settings,
  Users,
  Plug,
  FileText,
  HardDrive,
  Key,
  Plus,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Shield,
  Clock,
  Database,
  Activity,
  Trash2,
  Mail,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react'

// ============================================================================
// Admin.jsx — Painel de Administração
// ----------------------------------------------------------------------------
// Tabelas Supabase usadas:
//   profiles          (já existe): id, org_id, full_name, email, role, avatar_url, created_at
//   audit_log         (opcional): ver Logs.jsx
//   integrations      (novo, opcional): id, org_id, provider, status, last_sync, config jsonb
//   api_tokens        (novo, opcional): id, org_id, name, prefix, last_used, created_at
// ============================================================================

const TABS = [
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'integrations', label: 'Integrações', icon: Plug },
  { id: 'audit', label: 'Auditoria', icon: FileText },
  { id: 'system', label: 'Sistema', icon: HardDrive },
  { id: 'tokens', label: 'API Tokens', icon: Key },
]

// Roles reais do banco (valores em PT mistos):
//   owner, Gerente (capitalizado!), analyst
// Mantemos admin/senior/viewer como opcoes extras pra evolucao futura.
const ROLES = [
  { value: 'owner', label: 'Owner', color: 'bg-violet-100 text-violet-700' },
  { value: 'admin', label: 'Admin', color: 'bg-rose-100 text-rose-700' },
  { value: 'Gerente', label: 'Gerente', color: 'bg-amber-100 text-amber-700' },
  { value: 'senior', label: 'Sênior', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'analyst', label: 'Analista', color: 'bg-sky-100 text-sky-700' },
  { value: 'viewer', label: 'Viewer', color: 'bg-zinc-100 text-zinc-600' },
]

// Known integrations catalog (real config comes from `integrations` table if exists)
const INTEGRATIONS_CATALOG = [
  { id: 'supabase', name: 'Supabase', icon: '🗄', description: 'Backend e banco de dados', required: true },
  { id: 'gcal', name: 'Google Calendar', icon: '📅', description: 'Sincronização de eventos' },
  { id: 'gmail', name: 'Gmail', icon: '📧', description: 'Envio de emails e drafts' },
  { id: 'gdrive', name: 'Google Drive', icon: '☁', description: 'Armazenamento de documentos' },
  { id: 'notion', name: 'Notion', icon: '📝', description: 'Sincronização de notas' },
  { id: 'slack', name: 'Slack', icon: '💬', description: 'Notificações e alertas' },
  { id: 'datajud', name: 'DataJud CNJ', icon: '⚖', description: 'Consulta a processos judiciais' },
  { id: 'powerbi', name: 'Power BI', icon: '📊', description: 'Dashboards externos' },
  { id: 'claude', name: 'Claude AI', icon: '🤖', description: 'Análise de reuniões e texto', required: true },
  { id: 'bndes', name: 'BNDES API', icon: '🏦', description: 'Linhas de crédito', optional: true },
]

export default function Admin() {
  const { profile } = useData()
  const [activeTab, setActiveTab] = useState('users')
  const [profiles, setProfiles] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteData, setInviteData] = useState({ email: '', full_name: '', role: 'analyst' })
  const [inviting, setInviting] = useState(false)

  const isOwner = profile?.role === 'owner' || profile?.role === 'admin'

  useEffect(() => {
    if (!profile?.org_id) return
    loadProfiles()
    loadIntegrations()
    loadRecentEvents()
    loadTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id])

  async function loadProfiles() {
    setLoading(true)
    setError(null)
    try {
      // profiles real schema: id, org_id, full_name, initials, role, avatar_color, location, email
      // NAO tem created_at -- ordenar por full_name
      const { data, error: qErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', profile?.org_id)
        .order('full_name', { ascending: true })
      if (qErr) throw qErr
      setProfiles(data || [])
    } catch (err) {
      console.error('Error loading profiles:', err)
      setError('Erro ao carregar usuários: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadIntegrations() {
    try {
      const { data, error: qErr } = await supabase
        .from('integrations')
        .select('*')
        .eq('org_id', profile?.org_id)
      // If table doesn't exist, just use catalog defaults
      if (!qErr && data) setIntegrations(data)
    } catch (err) {
      // Silent: integrations table is optional
      console.warn('integrations table may not exist yet')
    }
  }

  async function loadRecentEvents() {
    try {
      const { data, error: qErr } = await supabase
        .from('audit_log')
        .select('*')
        .eq('org_id', profile?.org_id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (!qErr && data) setRecentEvents(data)
    } catch (err) {
      console.warn('audit_log table may not exist yet')
    }
  }

  async function loadTokens() {
    try {
      const { data, error: qErr } = await supabase
        .from('api_tokens')
        .select('*')
        .eq('org_id', profile?.org_id)
        .order('created_at', { ascending: false })
      if (!qErr && data) setTokens(data)
    } catch (err) {
      console.warn('api_tokens table may not exist yet')
    }
  }

  async function updateRole(profileId, newRole) {
    if (!isOwner) {
      toast.warning('Apenas owners/admins podem alterar roles')
      return
    }
    try {
      const { error: uErr } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId)
        .eq('org_id', profile.org_id)
      if (uErr) throw uErr
      await loadProfiles()
      showSuccess('Role atualizada')
    } catch (err) {
      toast.error(`Erro ao atualizar role: ` + err.message)
    }
  }

  async function submitInvite() {
    if (!inviteData.email || !inviteData.full_name) {
      toast.warning('Preencha nome e email')
      return
    }
    if (!isOwner) {
      toast.warning('Apenas owners/admins podem convidar usuários')
      return
    }
    setInviting(true)
    try {
      // NOTE: real invite via auth requires admin API / edge function.
      // Here we just create a pending profile row.
      // Gerar initials automaticamente
      const initials = inviteData.full_name.trim().split(' ')
        .map(w => w[0]).join('').toUpperCase().slice(0, 2)
      const { error: iErr } = await supabase
        .from('profiles')
        .insert([{
          org_id: profile.org_id,
          email: inviteData.email.trim(),
          full_name: inviteData.full_name.trim(),
          role: inviteData.role,
          initials,
          is_active: true,
        }])
      if (iErr) throw iErr
      setInviteData({ email: '', full_name: '', role: 'analyst' })
      setShowInviteForm(false)
      await loadProfiles()
      showSuccess('Convite registrado. Envie o link de acesso separadamente.')
    } catch (err) {
      // 23505 = unique_violation (email já cadastrado)
      if (err.code === '23505' || (err.message || '').includes('duplicate') || (err.message || '').includes('unique')) {
        toast.error('Este e-mail já está cadastrado na organização.')
      } else {
        toast.error('Erro ao convidar: ' + err.message)
      }
    } finally {
      setInviting(false)
    }
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  // KPIs
  const kpis = useMemo(() => {
    const byRole = {}
    profiles.forEach(p => {
      byRole[p.role || 'viewer'] = (byRole[p.role || 'viewer'] || 0) + 1
    })
    const integratedCount = integrations.filter(i => i.status === 'connected').length
    const catalogTotal = INTEGRATIONS_CATALOG.length
    return {
      totalUsers: profiles.length,
      byRole,
      integrations: `${integratedCount}/${catalogTotal}`,
      tokens: tokens.length,
      recentEvents: recentEvents.length,
    }
  }, [profiles, integrations, tokens, recentEvents])

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1">
              Administração
            </div>
            <h1 className="text-2xl font-bold mb-1">Painel administrativo</h1>
            <p className="text-sm text-zinc-300">
              {kpis.totalUsers} usuários · {kpis.integrations} integrações · {kpis.tokens} tokens ativos
              {!isOwner && ' · somente leitura'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Shield className={`w-5 h-5 ${isOwner ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="text-xs font-semibold">
              {isOwner ? 'Acesso completo' : 'Acesso somente leitura'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Usuários" value={kpis.totalUsers} sub="ativos" accent="violet" />
          <Kpi label="Admins" value={kpis.byRole.admin || kpis.byRole.owner || 0} accent="rose" />
          <Kpi label="Integrações" value={kpis.integrations} accent="emerald" />
          <Kpi label="Tokens API" value={kpis.tokens} accent="amber" />
          <Kpi label="Eventos hoje" value={kpis.recentEvents} accent="sky" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 border-b border-white/10 -mb-2">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
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

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-emerald-900 font-semibold">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5" />
          <span className="text-sm text-rose-900">{error}</span>
        </div>
      )}

      {/* TAB: Users */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Invite form */}
          {showInviteForm && (
            <div className="bg-white border-2 border-violet-300 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-violet-600" />
                  Convidar novo usuário
                </h2>
                <button
                  onClick={() => setShowInviteForm(false)}
                  className="p-1 hover:bg-zinc-100 rounded"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={inviteData.full_name}
                  onChange={(e) => setInviteData({ ...inviteData, full_name: e.target.value })}
                  className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="email@bxgroup.com.br"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
                />
                <select
                  value={inviteData.role}
                  onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                  className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none bg-white"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowInviteForm(false)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitInvite}
                  disabled={inviting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50"
                >
                  {inviting ? 'Convidando…' : 'Registrar convite'}
                </button>
              </div>
            </div>
          )}

          {/* Users table */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-600" />
                Usuários da organização
                <span className="ml-2 text-xs text-zinc-500 font-semibold">{profiles.length}</span>
              </h2>
              {isOwner && (
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Convidar
                </button>
              )}
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-zinc-400">
                <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                Carregando…
              </div>
            ) : profiles.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400">Nenhum usuário encontrado</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {profiles.map(p => {
                  const role = ROLES.find(r => r.value === p.role) || ROLES[ROLES.length - 1]
                  // Usar initials do banco se existir, senao calcular
                  const initials = p.initials || (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  // Usar avatar_color do banco se existir
                  const avatarStyle = p.avatar_color
                    ? { background: p.avatar_color }
                    : {}
                  const avatarClass = p.avatar_color
                    ? 'w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
                    : 'w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
                  return (
                    <div key={p.id} className="px-5 py-3 hover:bg-zinc-50 flex items-center gap-4">
                      <div className={avatarClass} style={avatarStyle}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-zinc-800 truncate">{p.full_name || '—'}</div>
                        <div className="text-xs text-zinc-500 truncate">{p.email}</div>
                      </div>
                      {isOwner ? (
                        <select
                          value={p.role || 'viewer'}
                          onChange={(e) => updateRole(p.id, e.target.value)}
                          className={`text-xs font-bold px-2 py-1 rounded-full border-0 ${role.color} focus:outline-none focus:ring-2 focus:ring-violet-400`}
                        >
                          {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${role.color}`}>
                          {role.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Role distribution */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-zinc-800 mb-4">Distribuição por role</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {ROLES.map(r => (
                <div key={r.value} className="text-center">
                  <div className={`text-2xl font-bold ${r.color.split(' ')[1]}`}>{kpis.byRole[r.value] || 0}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mt-1">{r.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Integrations */}
      {activeTab === 'integrations' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Plug className="w-4 h-4 text-violet-600" />
              Conectores externos
              <span className="ml-auto text-xs text-zinc-500 font-semibold">{INTEGRATIONS_CATALOG.length} disponíveis</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
            {INTEGRATIONS_CATALOG.map(cat => {
              const stored = integrations.find(i => i.provider === cat.id)
              const status = stored?.status || (cat.required ? 'connected' : 'disconnected')
              const statusMap = {
                connected: { label: 'Conectado', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
                disconnected: { label: 'Desconectado', color: 'bg-zinc-100 text-zinc-500', dot: 'bg-zinc-400' },
                expired: { label: 'Token expirado', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
                error: { label: 'Erro', color: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
              }
              const s = statusMap[status]
              return (
                <div key={cat.id} className="border border-zinc-200 rounded-lg p-4 hover:border-violet-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-zinc-800 truncate">{cat.name}</h3>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color} uppercase tracking-wide flex-shrink-0`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{cat.description}</p>
                      {stored?.last_sync && (
                        <p className="text-[10px] text-zinc-400 mt-1">
                          Última sync: {new Date(stored.last_sync).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
            💡 Para conectar uma integração, configure a tabela <code className="bg-white px-1 rounded">integrations</code> no Supabase ou use o painel de configurações do provedor.
          </div>
        </div>
      )}

      {/* TAB: Audit */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-600" />
              Eventos recentes
              <span className="ml-2 text-xs text-zinc-500 font-semibold">(últimos 10)</span>
            </h2>
            <a
              href="/logs"
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              Ver log completo →
            </a>
          </div>
          {recentEvents.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
              <div className="text-sm text-zinc-500">Nenhum evento registrado</div>
              <div className="text-xs text-zinc-400 mt-1">A tabela audit_log pode estar vazia ou não existir ainda.</div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {recentEvents.map(ev => (
                <div key={ev.id} className="px-5 py-2.5 text-sm flex items-center gap-3">
                  <div className="font-mono text-xs text-zinc-500 w-20">
                    {new Date(ev.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex-1 text-zinc-700 truncate">{ev.description}</div>
                  <div className="text-xs text-zinc-500">{ev.user_name || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: System */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SystemCard icon={Database} title="Supabase" value="Online" sub="Latência <50ms" color="emerald" />
          <SystemCard icon={HardDrive} title="Storage" value="—" sub="verificar no dashboard Supabase" color="sky" />
          <SystemCard icon={Activity} title="Uptime 30d" value="—" sub="verificar no Vercel" color="violet" />
          <div className="md:col-span-3 bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-zinc-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-600" />
              Links rápidos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg hover:border-violet-300">
                <span className="font-semibold text-zinc-700">Supabase Dashboard</span>
                <span className="text-xs text-zinc-400">↗</span>
              </a>
              <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg hover:border-violet-300">
                <span className="font-semibold text-zinc-700">Vercel Dashboard</span>
                <span className="text-xs text-zinc-400">↗</span>
              </a>
              <a href="/logs" className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg hover:border-violet-300">
                <span className="font-semibold text-zinc-700">Log de atividades</span>
                <span className="text-xs text-zinc-400">→</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Tokens */}
      {activeTab === 'tokens' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Key className="w-4 h-4 text-violet-600" />
              API Tokens
              <span className="ml-2 text-xs text-zinc-500 font-semibold">{tokens.length}</span>
            </h2>
          </div>
          {tokens.length === 0 ? (
            <div className="p-8 text-center">
              <Key className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
              <div className="text-sm text-zinc-500">Nenhum token gerado</div>
              <div className="text-xs text-zinc-400 mt-1">
                A tabela <code className="bg-zinc-100 px-1 rounded">api_tokens</code> não existe ou está vazia.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {tokens.map(t => (
                <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <Key className="w-4 h-4 text-zinc-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-zinc-800">{t.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">{t.prefix}••••••••</div>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {t.last_used ? `usado ${new Date(t.last_used).toLocaleDateString('pt-BR')}` : 'nunca usado'}
                  </div>
                </div>
              ))}
            </div>
          )}
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
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function SystemCard({ icon: Icon, title, value, sub, color }) {
  const colors = {
    emerald: 'text-emerald-600 bg-emerald-50',
    sky: 'text-sky-600 bg-sky-50',
    violet: 'text-violet-600 bg-violet-50',
  }
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</div>
          <div className="text-xl font-bold text-zinc-800 mt-0.5">{value}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>
        </div>
      </div>
    </div>
  )
}
