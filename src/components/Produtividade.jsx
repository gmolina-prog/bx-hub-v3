// src/components/Produtividade.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import {
  TrendingUp,
  CheckCircle,
  Clock,
  Target,
  Award,
  Users,
  Briefcase,
  BarChart3,
  Flame,
  Star,
  AlertTriangle,
  RefreshCw,
  Filter,
  Trophy,
  Zap,
} from 'lucide-react'

// ============================================================================
// Produtividade.jsx v2 — Painel de produtividade da equipe
// ----------------------------------------------------------------------------
// Enriquece o /produtividade existente do v3 (4 KPIs + ranking simples)
// adicionando 4 abas, Score BX gamificado, filtros e gráficos.
//
// Tabelas Supabase reais (validadas em produção):
//   tasks (8): id, org_id, project_id, title, column_id (doing/done/todo),
//              priority (high/medium/urgent), assigned_to, due_date,
//              hours_logged, created_at, deleted_at
//   routines (4): id, org_id, assigned_to, title, frequency (diaria/semanal/mensal),
//                 is_active, project_id
//   routine_completions: routine_id, completed_by, reference_date
//   projects (6): id, name, type, priority (Alta/Média), status, progress,
//                 deadline, analyst_id, executive_id
//   profiles: id, full_name, initials, avatar_color, role, cargo (select *)
//   check_ins (7): user_id, status, date
//   time_entries: hours por user/task
// ============================================================================

const TABS = [
  { id: 'me',       label: 'Meu Desempenho', icon: Target },
  { id: 'team',     label: 'Equipe',         icon: Users },
  { id: 'projects', label: 'Por Projeto',    icon: Briefcase },
  { id: 'analytics',label: 'Análises',       icon: BarChart3 },
]

const PERIODS = [
  { id: '7d',  label: '7 dias',  days: 7 },
  { id: '30d', label: '30 dias', days: 30 },
  { id: '90d', label: '90 dias', days: 90 },
  { id: '12m', label: '12 meses',days: 365 },
]

// Pesos para o Score BX (gamificacao)
const SCORE_WEIGHTS = {
  taskDone:        10, // por tarefa concluida
  taskUrgent:      15, // bonus se priority=urgent
  taskHigh:         5, // bonus se priority=high
  taskOnTime:      10, // se concluiu antes do due_date
  taskLate:        -5, // penalidade se atrasada
  routineCompleted: 8, // por routine completion
  checkInDay:       3, // por check-in registrado
  streakBonus:      5, // por dia de streak
}

export default function Produtividade() {
  const { profile } = useData()
  usePageTitle('Produtividade')
  const [activeTab, setActiveTab] = useState('team') // default = visao da equipe (mantém comportamento original)
  const [period, setPeriod] = useState('30d')
  const [tasks, setTasks] = useState([])
  const [routines, setRoutines] = useState([])
  const [completions, setCompletions] = useState([])
  const [projects, setProjects] = useState([])
  const [profiles, setProfiles] = useState([])
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (profile?.org_id) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id, period])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const days = PERIODS.find(p => p.id === period)?.days || 30
      const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()

      await Promise.all([
        loadTable('tasks', setTasks, q => q.is('deleted_at', null)),
        loadTable('routines', setRoutines, q => q.eq('is_active', true)),
        loadTable('routine_completions', setCompletions, q => q.gte('completed_at', cutoff)),
        loadTable('projects', setProjects),
        loadTable('profiles', setProfiles, q => q.order('full_name', { ascending: true })),
        loadTable('check_ins', setCheckins, q => q.gte('date', cutoff.slice(0, 10))),
      ])
    } catch (err) {
      console.error('Error loading produtividade:', err)
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

  // ============================================================
  // Calculo do Score BX por usuario
  // ============================================================
  const userScores = useMemo(() => {
    const scores = new Map()
    profiles.forEach(p => {
      scores.set(p.id, {
        profile: p,
        score: 0,
        tasksTotal: 0,
        tasksDone: 0,
        tasksLate: 0,
        tasksOnTime: 0,
        routinesDone: 0,
        checkIns: 0,
        breakdown: { tasks: 0, routines: 0, checkins: 0, bonus: 0 },
      })
    })

    // Tasks
    tasks.forEach(t => {
      const userId = t.assigned_to
      if (!userId || !scores.has(userId)) return
      const u = scores.get(userId)
      u.tasksTotal++

      if (t.column_id === 'done') {
        u.tasksDone++
        u.score += SCORE_WEIGHTS.taskDone
        u.breakdown.tasks += SCORE_WEIGHTS.taskDone

        if (t.priority === 'urgent') {
          u.score += SCORE_WEIGHTS.taskUrgent
          u.breakdown.bonus += SCORE_WEIGHTS.taskUrgent
        } else if (t.priority === 'high') {
          u.score += SCORE_WEIGHTS.taskHigh
          u.breakdown.bonus += SCORE_WEIGHTS.taskHigh
        }

        // On time / late
        if (t.due_date) {
          const due = new Date(t.due_date)
          const updated = new Date(t.updated_at || t.created_at)
          if (updated <= due) {
            u.tasksOnTime++
            u.score += SCORE_WEIGHTS.taskOnTime
            u.breakdown.bonus += SCORE_WEIGHTS.taskOnTime
          }
        }
      } else if (t.due_date && new Date(t.due_date) < new Date()) {
        u.tasksLate++
        u.score += SCORE_WEIGHTS.taskLate
        u.breakdown.tasks += SCORE_WEIGHTS.taskLate
      }
    })

    // Routine completions
    completions.forEach(c => {
      if (!scores.has(c.completed_by)) return
      const u = scores.get(c.completed_by)
      u.routinesDone++
      u.score += SCORE_WEIGHTS.routineCompleted
      u.breakdown.routines += SCORE_WEIGHTS.routineCompleted
    })

    // Check-ins + streak
    checkins.forEach(c => {
      if (!scores.has(c.user_id)) return
      const u = scores.get(c.user_id)
      u.checkIns++
      u.score += SCORE_WEIGHTS.checkInDay
      u.breakdown.checkins += SCORE_WEIGHTS.checkInDay
    })

    // Streak: dias consecutivos com check-in (calcula por usuário)
    const ciByUser = {}
    checkins.forEach(c => {
      if (!ciByUser[c.user_id]) ciByUser[c.user_id] = new Set()
      ciByUser[c.user_id].add(c.date)
    })
    Object.entries(ciByUser).forEach(([uid, dates]) => {
      if (!scores.has(uid)) return
      const u = scores.get(uid)
      const datesSet = Array.from(dates)
      const sorted = [...datesSet].sort().reverse()
      let streak = 0
      let cursor = new Date(); cursor.setHours(0,0,0,0)
      const todayStr = cursor.toISOString().slice(0,10)
      // B-102: se hoje ainda não tem check-in, começar do dia anterior
      // (evita streak quebrar durante o dia)
      if (!datesSet.includes(todayStr)) {
        cursor.setDate(cursor.getDate() - 1)
      }
      for (let i = 0; i < 60; i++) {
        const d = cursor.toISOString().slice(0,10)
        if (datesSet.includes(d)) { streak++ } else { break }
        cursor.setDate(cursor.getDate() - 1)
      }
      u.streak = streak
      if (streak >= 3) {
        const bonus = Math.min(streak, 14) * SCORE_WEIGHTS.streakBonus
        u.score += bonus
        u.breakdown.bonus += bonus
      }
    })

    return Array.from(scores.values()).sort((a, b) => b.score - a.score)
  }, [tasks, completions, checkins, profiles])

  // ============================================================
  // KPIs originais (preservados)
  // ============================================================
  const originalKpis = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10)
    const doneToday = completions.filter(c =>
      c.reference_date === todayISO || (c.completed_at && c.completed_at.startsWith(todayISO))
    ).length
    const totalDone = tasks.filter(t => t.column_id === 'done').length
    const totalTasks = tasks.length
    const checkInsToday = checkins.filter(c => c.date === todayISO).length
    const activeRoutines = routines.filter(r => r.is_active).length
    return {
      doneToday,
      totalDone,
      totalTasks,
      checkInsToday,
      teamSize: profiles.length,
      activeRoutines,
    }
  }, [tasks, routines, completions, checkins, profiles])

  // ============================================================
  // Meu desempenho (current user)
  // ============================================================
  const myStats = useMemo(() => {
    const my = userScores.find(u => u.profile.id === profile?.id)
    if (!my) return null
    const myRank = userScores.findIndex(u => u.profile.id === profile?.id) + 1
    return { ...my, rank: myRank, totalRanked: userScores.length }
  }, [userScores, profile])

  // ============================================================
  // Por projeto
  // ============================================================
  const projectStats = useMemo(() => {
    return projects.map(p => {
      const projTasks = tasks.filter(t => t.project_id === p.id)
      const done = projTasks.filter(t => t.column_id === 'done').length
      const doing = projTasks.filter(t => t.column_id === 'doing').length
      const todo = projTasks.filter(t => t.column_id === 'todo').length
      const velocityPct = projTasks.length > 0 ? Math.round((done / projTasks.length) * 100) : 0
      return {
        ...p,
        tasksTotal: projTasks.length,
        tasksDone: done,
        tasksDoing: doing,
        tasksTodo: todo,
        velocityPct,
      }
    }).sort((a, b) => b.velocityPct - a.velocityPct)
  }, [projects, tasks])

  // ============================================================
  // Análises - distribuicoes
  // ============================================================
  const analytics = useMemo(() => {
    const byStatus = { todo: 0, doing: 0, done: 0 }
    tasks.forEach(t => { if (byStatus[t.column_id] !== undefined) byStatus[t.column_id]++ })

    const byPriority = { urgent: 0, high: 0, medium: 0 }
    tasks.forEach(t => { if (byPriority[t.priority] !== undefined) byPriority[t.priority]++ })

    const totalHours = tasks.reduce((s, t) => s + (parseFloat(t.hours_logged) || 0), 0)

    return { byStatus, byPriority, totalHours }
  }, [tasks])

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              Produtividade da equipe
            </div>
            <h1 className="text-2xl font-bold mb-1">📈 Visão consolidada</h1>
            <p className="text-sm text-zinc-300">
              {originalKpis.teamSize} colaboradores · {originalKpis.totalTasks} tarefas · {originalKpis.activeRoutines} rotinas ativas
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm font-semibold text-white"
              style={{ colorScheme: 'dark' }}
            >
              {PERIODS.map(p => (
                <option key={p.id} value={p.id} className="text-zinc-900">{p.label}</option>
              ))}
            </select>
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

        {/* 4 KPIs originais preservados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Concluídas hoje" value={originalKpis.doneToday} icon="✅" accent="emerald" />
          <Kpi label="Total concluídas" value={`${originalKpis.totalDone} / ${originalKpis.totalTasks}`} icon="📊" accent="violet" />
          <Kpi label="Check-ins hoje" value={`${originalKpis.checkInsToday} / ${originalKpis.teamSize}`} icon="📍" accent="sky" />
          <Kpi label="Rotinas ativas" value={originalKpis.activeRoutines} icon="⏰" accent="amber" />
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

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 text-sm text-rose-900">
          {error}
        </div>
      )}

      {loading && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center mb-6">
          <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2 text-zinc-400" />
          <span className="text-sm text-zinc-500">Carregando…</span>
        </div>
      )}

      {/* ============== TAB: MEU DESEMPENHO ============== */}
      {!loading && activeTab === 'me' && myStats && (
        <div className="space-y-6">
          {/* Score Card */}
          <div className="bg-gradient-to-br from-violet-500 to-violet-700 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Seu Score BX</div>
                <div className="text-5xl font-bold tracking-tight">{myStats.score}</div>
                <div className="text-sm opacity-80 mt-2">
                  Posição #{myStats.rank} de {myStats.totalRanked} · {period === '7d' ? '7 dias' : period === '30d' ? '30 dias' : period === '90d' ? '90 dias' : '12 meses'}
                </div>
              </div>
              <div className="text-6xl">
                {myStats.rank === 1 ? '🏆' : myStats.rank === 2 ? '🥈' : myStats.rank === 3 ? '🥉' : '⭐'}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ScoreBreak label="Tarefas" value={myStats.breakdown.tasks} icon={CheckCircle} />
              <ScoreBreak label="Rotinas" value={myStats.breakdown.routines} icon={Clock} />
              <ScoreBreak label="Check-ins" value={myStats.breakdown.checkins} icon={Target} />
              <ScoreBreak label="Bônus" value={myStats.breakdown.bonus} icon={Star} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Tarefas concluídas" value={myStats.tasksDone} sub={`de ${myStats.tasksTotal}`} icon={CheckCircle} accent="emerald" />
            <StatCard label="Pontuais" value={myStats.tasksOnTime} sub="no prazo" icon={Zap} accent="sky" />
            <StatCard label="Atrasadas" value={myStats.tasksLate} sub="precisam atenção" icon={AlertTriangle} accent="rose" />
            <StatCard label="Rotinas executadas" value={myStats.routinesDone} sub={`${myStats.checkIns} check-ins`} icon={Flame} accent="amber" />
          </div>

          {/* Como melhorar */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-zinc-800 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-violet-600" />
              Como melhorar seu Score
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-600">
              <div className="flex items-start gap-2 p-3 bg-zinc-50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-zinc-800">+10 por tarefa concluída</div>
                  <div>+15 se urgente · +5 se alta · +10 se no prazo</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-zinc-50 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-zinc-800">+8 por rotina executada</div>
                  <div>Diárias, semanais e mensais valem o mesmo</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-zinc-50 rounded-lg">
                <Target className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-zinc-800">+3 por check-in registrado</div>
                  <div>Onde você está · valeu pelo cliente · home office</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-zinc-50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-zinc-800">−5 por tarefa atrasada</div>
                  <div>Sem mexer no prazo, perde pontos automaticamente</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'me' && !myStats && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-500">
          Faça login para ver seu desempenho pessoal
        </div>
      )}

      {/* ============== TAB: EQUIPE ============== */}
      {!loading && activeTab === 'team' && (
        <div className="space-y-6">
          {/* Ranking — cards por pessoa */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200" style={{ background: '#2D2E39' }}>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-violet-400" />
                Ranking da Equipe — Score BX
                <span className="ml-auto text-xs font-semibold" style={{ color: '#6B7280' }}>
                  {userScores.length} colaboradores
                </span>
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, padding: 16 }}>
              {userScores.map((u, idx) => {
                const p = u.profile
                const initials = p.initials || (p.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                const avatarBg = p.avatar_color || '#5452C1'
                const medal = u.score > 0 ? (idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null) : null
                const scoreColor = u.score >= 100 ? '#10B981' : u.score >= 50 ? '#5452C1' : u.score > 0 ? '#6B7280' : '#EF4444'
                const scoreBg   = u.score >= 100 ? '#ECFDF5' : u.score >= 50 ? '#EEF2FF' : u.score > 0 ? '#F4F5F8' : '#FEF2F2'
                const maxScore = Math.max(...userScores.map(x => x.score), 1)
                const barPct = Math.max(0, Math.min(100, (u.score / maxScore) * 100))
                return (
                  <div key={p.id} style={{
                    background: 'white', border: '1px solid #EAECF0', borderRadius: 10,
                    padding: 14, position: 'relative', overflow: 'hidden',
                    borderTop: idx < 3 ? `3px solid ${idx===0?'#F59E0B':idx===1?'#94A3B8':'#B45309'}` : '1px solid #EAECF0',
                  }}>
                    {/* Position badge */}
                    <div style={{ position: 'absolute', top: 8, right: 10, fontSize: medal ? 16 : 10, fontWeight: 700, color: '#9CA3AF' }}>
                      {medal || `#${idx+1}`}
                    </div>
                    {/* Avatar + name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.full_name?.split(' ')[0] || '—'}
                        </div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.cargo || p.role || '—'}
                        </div>
                      </div>
                    </div>
                    {/* Score in big */}
                    <div style={{ background: scoreBg, borderRadius: 8, padding: '8px 10px', textAlign: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{u.score}</div>
                      <div style={{ fontSize: 9, color: scoreColor, opacity: .7, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>Score BX</div>
                    </div>
                    {/* Score bar */}
                    <div style={{ height: 3, background: '#F3F4F6', borderRadius: 99, marginBottom: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: barPct + '%', background: scoreColor, borderRadius: 99, transition: 'width .5s' }} />
                    </div>
                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
                      {[
                        { label: 'Tarefas', value: u.tasksTotal, color: '#374151' },
                        { label: 'Concl.', value: u.tasksDone, color: '#10B981' },
                        { label: 'Atr.', value: u.tasksLate || 0, color: u.tasksLate > 0 ? '#EF4444' : '#10B981' },
                      ].map(s => (
                        <div key={s.label} style={{ background: '#F9FAFB', borderRadius: 6, padding: '5px 4px', textAlign: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 8.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Streak */}
                    {u.streak >= 3 && (
                      <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>
                        🔥 {u.streak} dias seguidos
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {/* B-75: Total de horas registradas */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 md:col-span-2">
            <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-600" />
              Horas registradas no período
            </h2>
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <div className="text-4xl font-bold text-violet-700">{analytics.totalHours.toFixed(1)}h</div>
                <div className="text-xs text-zinc-500 mt-1">total do time</div>
              </div>
              {userScores.length > 0 && (
                <div className="flex-1 space-y-2">
                  {userScores
                    .map(u => ({
                      ...u,
                      hours: tasks.filter(t => t.assigned_to === u.profile.id && t.hours_logged).reduce((s, t) => s + (parseFloat(t.hours_logged) || 0), 0)
                    }))
                    .filter(u => u.hours > 0)
                    .sort((a, b) => b.hours - a.hours)
                    .slice(0, 5)
                    .map(u => {
                      const pct = analytics.totalHours > 0 ? (u.hours / analytics.totalHours) * 100 : 0
                      return (
                        <div key={u.profile.id} className="flex items-center gap-3">
                          <div className="text-xs font-semibold text-zinc-700 w-28 truncate">{u.profile.full_name?.split(' ')[0]}</div>
                          <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs font-bold text-zinc-700 w-12 text-right">{u.hours.toFixed(1)}h</div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============== TAB: POR PROJETO ============== */}
      {!loading && activeTab === 'projects' && (
        <div className="space-y-3">
          {projectStats.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-500">
              Nenhum projeto cadastrado
            </div>
          ) : (
            projectStats.map(p => {
              const analyst = profiles.find(x => x.id === p.analyst_id)
              return (
                <div key={p.id} className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-zinc-800 truncate">{p.name || '—'}</h3>
                        {p.priority && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                            p.priority === 'Alta' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {p.priority}
                          </span>
                        )}
                        {p.status && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase tracking-wide">
                            {p.status}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {p.type || '—'} · {analyst ? analyst.full_name : 'Sem analista'}
                        {p.deadline && ` · prazo ${new Date(p.deadline).toLocaleDateString('pt-BR')}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-violet-700">{p.velocityPct}%</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">velocidade</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full ${
                        p.velocityPct >= 75 ? 'bg-emerald-500' :
                        p.velocityPct >= 50 ? 'bg-violet-500' :
                        p.velocityPct >= 25 ? 'bg-amber-500' :
                        'bg-rose-500'
                      }`}
                      style={{ width: `${p.velocityPct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-zinc-50 rounded">
                      <div className="font-bold text-zinc-700">{p.tasksTodo}</div>
                      <div className="text-[10px] text-zinc-500 uppercase">A fazer</div>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded">
                      <div className="font-bold text-amber-700">{p.tasksDoing}</div>
                      <div className="text-[10px] text-amber-600 uppercase">Em andamento</div>
                    </div>
                    <div className="text-center p-2 bg-emerald-50 rounded">
                      <div className="font-bold text-emerald-700">{p.tasksDone}</div>
                      <div className="text-[10px] text-emerald-600 uppercase">Concluídas</div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ============== TAB: ANÁLISES ============== */}
      {!loading && activeTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-600" />
              Distribuição por status
            </h2>
            <div className="space-y-3">
              {Object.entries(analytics.byStatus).map(([status, count]) => {
                const total = tasks.length
                const pct = total > 0 ? (count / total) * 100 : 0
                const meta = {
                  todo:  { label: 'A fazer',     color: 'bg-zinc-400' },
                  doing: { label: 'Em andamento',color: 'bg-amber-500' },
                  done:  { label: 'Concluídas',  color: 'bg-emerald-500' },
                }[status]
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-zinc-700">{meta.label}</span>
                      <span className="font-bold text-zinc-900">{count} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className={`h-full ${meta.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-violet-600" />
              Distribuição por prioridade
            </h2>
            <div className="space-y-3">
              {Object.entries(analytics.byPriority).map(([priority, count]) => {
                const total = tasks.length
                const pct = total > 0 ? (count / total) * 100 : 0
                const meta = {
                  urgent: { label: 'Urgente', color: 'bg-rose-500' },
                  high:   { label: 'Alta',    color: 'bg-amber-500' },
                  medium: { label: 'Média',   color: 'bg-sky-500' },
                }[priority]
                return (
                  <div key={priority}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-zinc-700">{meta.label}</span>
                      <span className="font-bold text-zinc-900">{count} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className={`h-full ${meta.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5 md:col-span-2">
            <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-600" />
              Total de horas registradas
            </h2>
            <div className="text-4xl font-bold text-violet-700">
              {analytics.totalHours.toFixed(1)}h
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              somado de {tasks.length} tarefas no período de {PERIODS.find(p => p.id === period)?.label}
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

function Kpi({ label, value, icon, accent }) {
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
        <div className="text-base">{icon}</div>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, accent }) {
  const accents = {
    violet: 'text-violet-700 bg-violet-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    sky: 'text-sky-700 bg-sky-50',
    amber: 'text-amber-700 bg-amber-50',
    rose: 'text-rose-700 bg-rose-50',
  }
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accents[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-zinc-800">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function ScoreBreak({ label, value, icon: Icon }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3 h-3 opacity-80" />
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      </div>
      <div className="text-xl font-bold">{value > 0 ? '+' : ''}{value}</div>
    </div>
  )
}