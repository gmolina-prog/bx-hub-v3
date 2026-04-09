// src/components/Time.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { ROLES } from '../lib/roles'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'
import {
  Users,
  Search,
  MessageCircle,
  Cake,
  Briefcase,
  Award,
  Mail,
  MapPin,
  Send,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Trophy,
  Heart,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

// ============================================================================
// Time.jsx v2 — Gestão da equipe
// ----------------------------------------------------------------------------
// CONSERTA o /time atual que mostra "Nenhum membro encontrado" mesmo com
// 10 colaboradores no banco. Adiciona 5 abas, kudos, ranking e workload.
//
// Tabelas Supabase reais (validadas):
//   profiles (10): id, full_name, initials, avatar_color, role, email, location, org_id
//   kudos (0): id, org_id, from_user, to_user, message, category, created_at
//   tasks (8): id, assigned_to, column_id, priority, due_date
//   check_ins (7): user_id, status, date
//   routines (4): id, assigned_to, is_active
// ============================================================================

const TABS = [
  { id: 'directory',   label: 'Diretório',     icon: Users },
  { id: 'ranking',     label: 'Ranking',       icon: Trophy },
  { id: 'mural',       label: 'Mural',         icon: Heart },
  { id: 'birthdays',   label: 'Aniversários',  icon: Cake },
  { id: 'workload',    label: 'Carga',         icon: Briefcase },
]

// Roles reais do banco: analyst, Gerente, owner (com extras pra futuro)


const KUDOS_CATEGORIES = [
  { id: 'teamwork',    label: 'Trabalho em equipe', emoji: '🤝' },
  { id: 'excellence',  label: 'Excelência',         emoji: '⭐' },
  { id: 'innovation',  label: 'Inovação',           emoji: '💡' },
  { id: 'leadership',  label: 'Liderança',          emoji: '🎯' },
  { id: 'mentorship',  label: 'Mentoria',           emoji: '🧑‍🏫' },
  { id: 'delivery',    label: 'Entrega',            emoji: '🚀' },
]

export default function Time() {
  const { profile } = useData()
  const [activeTab, setActiveTab] = useState('directory')
  const [profiles, setProfiles] = useState([])
  const [kudos, setKudos] = useState([])
  const [tasks, setTasks] = useState([])
  const [checkins, setCheckins] = useState([])
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [showKudoForm, setShowKudoForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [kudoForm, setKudoForm] = useState({
    to_user: '',
    category: 'teamwork',
    message: '',
  })

  useEffect(() => {
    if (profile?.org_id) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id])

  // Auto-select first profile when list loads (CONSERTA o bug do master/detail)
  useEffect(() => {
    if (profiles.length > 0 && !selectedId) {
      setSelectedId(profiles[0].id)
    }
  }, [profiles, selectedId])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      // CRITICO: ordenar por full_name (profiles NAO tem created_at)
      const { data: profilesData, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', profile?.org_id)
        .order('full_name', { ascending: true })
      if (pErr) throw pErr
      setProfiles(profilesData || [])

      await Promise.all([
        loadTable('kudos', setKudos, q => q.order('created_at', { ascending: false }).limit(50)),
        loadTable('tasks', setTasks, q => q.is('deleted_at', null)),
        loadTable('check_ins', setCheckins),
        loadTable('routines', setRoutines, q => q.eq('is_active', true)),
      ])
    } catch (err) {
      console.error('Error loading time:', err)
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

  async function submitKudo() {
    if (!kudoForm.to_user || !kudoForm.message.trim()) {
      toast.warning('Selecione um destinatário e escreva uma mensagem')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        org_id: profile.org_id,
        from_user: profile.id,
        to_user: kudoForm.to_user,
        category: kudoForm.category,
        message: kudoForm.message.trim(),
      }
      const { error: iErr } = await supabase.from('kudos').insert([payload])
      if (iErr) throw iErr
      setKudoForm({ to_user: '', category: 'teamwork', message: '' })
      setShowKudoForm(false)
      await loadAll()
      showSuccess('Kudo enviado! 🎉')
    } catch (err) {
      toast.error(`Erro ao enviar kudo: ` + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  // ============================================================
  // Filtragem (CONSERTA o bug "Nenhum membro encontrado")
  // ============================================================
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (filterRole !== 'all' && p.role !== filterRole) return false
      if (search) {
        const s = search.toLowerCase()
        const hay = `${p.full_name || ''} ${p.email || ''} ${p.role || ''} ${p.location || ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [profiles, search, filterRole])

  const selectedProfile = useMemo(() => {
    return profiles.find(p => p.id === selectedId)
  }, [profiles, selectedId])

  // Stats per profile
  const profileStats = useMemo(() => {
    const m = new Map()
    profiles.forEach(p => {
      const myTasks = tasks.filter(t => t.assigned_to === p.id)
      const doneTasks = myTasks.filter(t => t.column_id === 'done').length
      const myRoutines = routines.filter(r => r.assigned_to === p.id).length
      const myCheckIns = checkins.filter(c => c.user_id === p.id).length
      const kudosReceived = kudos.filter(k => k.to_user === p.id).length
      const kudosGiven = kudos.filter(k => k.from_user === p.id).length
      m.set(p.id, {
        tasksTotal: myTasks.length,
        tasksDone: doneTasks,
        tasksDoing: myTasks.filter(t => t.column_id === 'doing').length,
        tasksTodo: myTasks.filter(t => t.column_id === 'todo').length,
        tasksLate: myTasks.filter(t => t.column_id !== 'done' && t.due_date && new Date(t.due_date) < new Date()).length,
        routines: myRoutines,
        checkIns: myCheckIns,
        kudosReceived,
        streak: streakByUser[p.id] || 0,
        kudosGiven,
      })
    })
    return m
  }, [profiles, tasks, routines, checkins, kudos])

  // B-26: pesos unificados com Produtividade.jsx
  const SCORE_W = { taskDone: 10, routine: 8, checkIn: 3, kudo: 8, streakBonus: 5 }

  function calcScore(stats) {
    const base = (stats.tasksDone || 0) * SCORE_W.taskDone
               + (stats.routines  || 0) * SCORE_W.routine
               + (stats.checkIns  || 0) * SCORE_W.checkIn
               + (stats.kudosReceived || 0) * SCORE_W.kudo
    // Streak: dias consecutivos de check-in (mesmo algoritmo do Produtividade)
    const streak = stats.streak || 0
    const streakPts = streak >= 3 ? Math.min(streak, 14) * SCORE_W.streakBonus : 0
    return base + streakPts
  }

  const ranked = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const sa = profileStats.get(a.id) || {}
      const sb = profileStats.get(b.id) || {}
      return calcScore(sb) - calcScore(sa)
    })
  }, [profiles, profileStats])

  const totalKpis = useMemo(() => ({
    total: profiles.length,
    online: checkins.filter(c => c.date === new Date().toISOString().slice(0, 10)).length,
    kudosTotal: kudos.length,
    activeRoutines: routines.length,
  }), [profiles, checkins, kudos, routines])

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <Users className="w-3 h-3" />
              Gestão da equipe
            </div>
            <h1 className="text-2xl font-bold mb-1">👥 Time</h1>
            <p className="text-sm text-zinc-300">
              {totalKpis.total} colaboradores · {totalKpis.online} hoje · {totalKpis.kudosTotal} kudos · {totalKpis.activeRoutines} rotinas ativas
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowKudoForm(true)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Heart className="w-4 h-4" />
              Enviar kudo
            </button>
            <button
              onClick={loadAll}
              disabled={loading}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Total equipe" value={totalKpis.total} accent="violet" />
          <Kpi label="Check-in hoje" value={totalKpis.online} accent="emerald" />
          <Kpi label="Kudos enviados" value={totalKpis.kudosTotal} accent="rose" />
          <Kpi label="Rotinas ativas" value={totalKpis.activeRoutines} accent="amber" />
        </div>

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

      {/* Form de kudo */}
      {showKudoForm && (
        <div className="bg-white border-2 border-violet-300 rounded-xl p-5 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
              <Heart className="w-4 h-4 text-violet-600" />
              Enviar um kudo
            </h2>
            <button onClick={() => setShowKudoForm(false)} className="p-1 hover:bg-zinc-100 rounded">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
          <div className="space-y-3 mb-4">
            <select
              value={kudoForm.to_user}
              onChange={(e) => setKudoForm({ ...kudoForm, to_user: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
            >
              <option value="">Para quem é o kudo?</option>
              {profiles.filter(p => p.id !== profile?.id).map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {KUDOS_CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setKudoForm({ ...kudoForm, category: c.id })}
                  className={`px-2 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    kudoForm.category === c.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <div className="text-lg">{c.emoji}</div>
                  <div>{c.label}</div>
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              placeholder="Escreva uma mensagem reconhecendo o trabalho..."
              value={kudoForm.message}
              onChange={(e) => setKudoForm({ ...kudoForm, message: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowKudoForm(false)} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg">
              Cancelar
            </button>
            <button onClick={submitKudo} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Send className="w-4 h-4" />
              {submitting ? 'Enviando…' : 'Enviar kudo'}
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

      {/* ============== TAB: DIRETÓRIO (master/detail) ============== */}
      {!loading && activeTab === 'directory' && (
        <>
          {/* Filtros */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, email, role, localização…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
                />
              </div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
              >
                <option value="all">Todas as permissões</option>
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6">
            {/* Lista */}
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 text-xs font-bold uppercase tracking-wider text-zinc-600">
                {filteredProfiles.length} {filteredProfiles.length === 1 ? 'membro' : 'membros'}
              </div>
              {filteredProfiles.length === 0 ? (
                <div className="p-12 text-center text-sm text-zinc-400">
                  Nenhum membro encontrado
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto">
                  {filteredProfiles.map(p => {
                    const initials = p.initials || (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                    const avatarStyle = p.avatar_color ? { background: p.avatar_color } : {}
                    const avatarClass = p.avatar_color
                      ? 'w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
                      : 'w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
                    const isSelected = p.id === selectedId
                    const stats = profileStats.get(p.id) || {}
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                          isSelected ? 'bg-violet-50 border-l-4 border-violet-500' : 'hover:bg-zinc-50 border-l-4 border-transparent'
                        }`}
                      >
                        <div className={avatarClass} style={avatarStyle}>{initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-zinc-800 truncate">{p.full_name || '—'}</div>
                          <div className="text-xs text-zinc-500 truncate">{p.cargo || p.role || ''}</div>
                        </div>
                        <div className="text-right text-[10px] text-zinc-400 font-semibold">
                          <div>{stats.tasksDone || 0}/{stats.tasksTotal || 0}</div>
                          <div>tarefas</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Detail */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6">
              {!selectedProfile ? (
                <div className="p-12 text-center text-sm text-zinc-400">
                  Selecione um membro do time para ver detalhes
                </div>
              ) : (
                <ProfileDetail profile={selectedProfile} stats={profileStats.get(selectedProfile.id)} kudos={kudos.filter(k => k.to_user === selectedProfile.id)} />
              )}
            </div>
          </div>
        </>
      )}

      {/* ============== TAB: RANKING ============== */}
      {!loading && activeTab === 'ranking' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-violet-600" />
              Ranking — Score = tarefas×10 + rotinas×5 + check-ins×3 + kudos×8
            </h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {ranked.map((p, idx) => {
              const stats = profileStats.get(p.id) || {}
              const score = calcScore(stats)
              const initials = p.initials || (p.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
              const avatarStyle = p.avatar_color ? { background: p.avatar_color } : {}
              const avatarClass = p.avatar_color
                ? 'w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
                : 'w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
              return (
                <div key={p.id} className="px-5 py-4 hover:bg-zinc-50 flex items-center gap-4">
                  <div className="text-2xl font-bold text-zinc-700 w-12 text-center">
                    {medal || `#${idx + 1}`}
                  </div>
                  <div className={avatarClass} style={avatarStyle}>{initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-zinc-800 truncate">{p.full_name}</div>
                    <div className="text-xs text-zinc-500">{p.role}</div>
                  </div>
                  <div className="hidden md:flex gap-3 text-xs">
                    <Badge label="Tarefas" value={stats.tasksDone} />
                    <Badge label="Rotinas" value={stats.routines} />
                    <Badge label="Check-ins" value={stats.checkIns} />
                    <Badge label="Kudos" value={stats.kudosReceived} />
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-violet-700">{score}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">pontos</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============== TAB: MURAL DE KUDOS ============== */}
      {!loading && activeTab === 'mural' && (
        <div className="space-y-4">
          {kudos.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
              <Heart className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <div className="text-sm font-bold text-zinc-700">Nenhum kudo enviado ainda</div>
              <div className="text-xs text-zinc-500 mt-1 mb-4">
                Reconheça o trabalho dos seus colegas — pequenos gestos fazem grande diferença.
              </div>
              <button
                onClick={() => setShowKudoForm(true)}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-2"
              >
                <Heart className="w-4 h-4" />
                Enviar primeiro kudo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kudos.map(k => {
                const from = profiles.find(p => p.id === k.from_user)
                const to = profiles.find(p => p.id === k.to_user)
                const cat = KUDOS_CATEGORIES.find(c => c.id === k.category)
                return (
                  <div key={k.id} className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-3xl">{cat?.emoji || '⭐'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-500">
                          <span className="font-bold text-zinc-700">{from?.full_name || '—'}</span>
                          {' → '}
                          <span className="font-bold text-violet-700">{to?.full_name || '—'}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mt-0.5">
                          {cat?.label || k.category}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-700 italic">"{k.message}"</p>
                    <div className="text-[10px] text-zinc-400 mt-3">
                      {k.created_at && new Date(k.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ============== TAB: ANIVERSÁRIOS ============== */}
      {!loading && activeTab === 'birthdays' && (() => {
        const today = new Date(); today.setHours(0,0,0,0)
        const thisYear = today.getFullYear()

        // Calcular próximo aniversário para cada pessoa com birth_date
        const withBirthday = profiles
          .filter(p => p.birth_date)
          .map(p => {
            const bd = new Date(p.birth_date + 'T00:00:00')
            // Próximo aniversário no ano corrente ou seguinte
            let next = new Date(thisYear, bd.getMonth(), bd.getDate())
            if (next < today) next = new Date(thisYear + 1, bd.getMonth(), bd.getDate())
            const daysUntil = Math.round((next - today) / 86400000)
            const isToday = daysUntil === 0
            const age = thisYear - bd.getFullYear() + (next.getFullYear() > thisYear ? 0 : 0)
            return { ...p, next, daysUntil, isToday, age }
          })
          .sort((a, b) => a.daysUntil - b.daysUntil)

        const withoutBirthday = profiles.filter(p => !p.birth_date)

        return (
          <div className="space-y-4">
            {/* Próximos aniversários */}
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                  <Cake className="w-4 h-4 text-violet-600" />
                  Próximos aniversários
                </h2>
                <span className="text-xs text-zinc-500">{withBirthday.length} de {profiles.length} com data cadastrada</span>
              </div>
              {withBirthday.length === 0 ? (
                <div className="p-10 text-center">
                  <Cake className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                  <div className="text-sm text-zinc-500">Nenhum colaborador com data de nascimento cadastrada.</div>
                  <div className="text-xs text-zinc-400 mt-1">Adicione as datas em Cadastro → Colaboradores.</div>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {withBirthday.map(p => {
                    const initials = p.initials || (p.full_name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
                    const avatarStyle = p.avatar_color ? { background: p.avatar_color } : {}
                    const avatarClass = p.avatar_color
                      ? 'w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
                      : 'w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
                    const monthDay = new Date(p.birth_date + 'T00:00:00')
                      .toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
                    return (
                      <div key={p.id} className={`px-5 py-4 flex items-center gap-4 ${p.isToday ? 'bg-amber-50 border-l-4 border-amber-400' : 'hover:bg-zinc-50'}`}>
                        <div className={avatarClass} style={avatarStyle}>{initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-zinc-800 flex items-center gap-2">
                            {p.full_name}
                            {p.isToday && <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">🎂 Hoje!</span>}
                          </div>
                          <div className="text-xs text-zinc-500">{monthDay}</div>
                        </div>
                        <div className="text-right shrink-0">
                          {p.isToday ? (
                            <div className="text-2xl">🎉</div>
                          ) : (
                            <>
                              <div className="text-lg font-bold text-violet-700">{p.daysUntil}</div>
                              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">dias</div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Sem data cadastrada */}
            {withoutBirthday.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl p-4">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                  Sem data cadastrada ({withoutBirthday.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {withoutBirthday.map(p => {
                    const initials = p.initials || (p.full_name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
                    return (
                      <div key={p.id} className="flex items-center gap-2 bg-zinc-50 rounded-lg px-3 py-1.5">
                        <div className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-500 text-[10px] font-bold flex items-center justify-center">
                          {initials}
                        </div>
                        <span className="text-xs text-zinc-500">{p.full_name?.split(' ')[0]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ============== TAB: CARGA DE TRABALHO ============== */}
      {!loading && activeTab === 'workload' && (
        <div className="space-y-3">
          {profiles.map(p => {
            const stats = profileStats.get(p.id) || {}
            const initials = p.initials || (p.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const avatarStyle = p.avatar_color ? { background: p.avatar_color } : {}
            const avatarClass = p.avatar_color
              ? 'w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
              : 'w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0'
            const totalActive = (stats.tasksDoing || 0) + (stats.tasksTodo || 0)
            const overload = totalActive >= 5
            const lateLevel = stats.tasksLate || 0
            return (
              <div key={p.id} className="bg-white border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className={avatarClass} style={avatarStyle}>{initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-zinc-800 truncate">{p.full_name}</div>
                    <div className="text-xs text-zinc-500">{p.role}</div>
                  </div>
                  {overload && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-rose-100 text-rose-700 uppercase tracking-wide">
                      Sobrecarga
                    </span>
                  )}
                  {lateLevel > 0 && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wide">
                      {lateLevel} atrasada{lateLevel > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center p-2 bg-zinc-50 rounded">
                    <div className="font-bold text-zinc-700">{stats.tasksTodo || 0}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">A fazer</div>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded">
                    <div className="font-bold text-amber-700">{stats.tasksDoing || 0}</div>
                    <div className="text-[10px] text-amber-600 uppercase">Em andamento</div>
                  </div>
                  <div className="text-center p-2 bg-emerald-50 rounded">
                    <div className="font-bold text-emerald-700">{stats.tasksDone || 0}</div>
                    <div className="text-[10px] text-emerald-600 uppercase">Concluídas</div>
                  </div>
                  <div className="text-center p-2 bg-violet-50 rounded">
                    <div className="font-bold text-violet-700">{stats.routines || 0}</div>
                    <div className="text-[10px] text-violet-600 uppercase">Rotinas</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function Kpi({ label, value, accent }) {
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
    </div>
  )
}

function Badge({ label, value }) {
  return (
    <div className="text-center px-2 py-1 bg-zinc-50 rounded">
      <div className="font-bold text-zinc-700">{value || 0}</div>
      <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}

function ProfileDetail({ profile, stats, kudos }) {
  if (!profile) return null
  const s = stats || {}
  const initials = profile.initials || (profile.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const avatarStyle = profile.avatar_color ? { background: profile.avatar_color } : {}
  const avatarClass = profile.avatar_color
    ? 'w-20 h-20 rounded-full text-white flex items-center justify-center font-bold text-2xl flex-shrink-0'
    : 'w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-2xl flex-shrink-0'

  return (
    <div>
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-zinc-100">
        <div className={avatarClass} style={avatarStyle}>{initials}</div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-zinc-800">{profile.full_name || '—'}</h2>
          <div className="text-sm text-zinc-600">{profile.role || ''}</div>
          {profile.email && (
            <div className="text-xs text-zinc-500 flex items-center gap-1 mt-2">
              <Mail className="w-3 h-3" />
              {profile.email}
            </div>
          )}
          {profile.location && (
            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {profile.location}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <DetailStat label="Tarefas concluídas" value={`${s.tasksDone || 0}/${s.tasksTotal || 0}`} accent="emerald" />
        <DetailStat label="Em andamento" value={s.tasksDoing || 0} accent="amber" />
        <DetailStat label="Rotinas" value={s.routines || 0} accent="violet" />
        <DetailStat label="Check-ins" value={s.checkIns || 0} accent="sky" />
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          Kudos recebidos ({kudos.length})
        </h3>
        {kudos.length === 0 ? (
          <div className="text-xs text-zinc-400 italic">Nenhum kudo recebido ainda</div>
        ) : (
          <div className="space-y-2">
            {kudos.slice(0, 3).map(k => {
              const cat = KUDOS_CATEGORIES.find(c => c.id === k.category)
              return (
                <div key={k.id} className="bg-violet-50 border-l-4 border-violet-400 rounded-r-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{cat?.emoji || '⭐'}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">{cat?.label || k.category}</span>
                  </div>
                  <p className="text-xs text-zinc-700 italic">"{k.message}"</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailStat({ label, value, accent }) {
  const accents = {
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <div className={`border rounded-lg p-3 ${accents[accent]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mt-1">{label}</div>
    </div>
  )
}