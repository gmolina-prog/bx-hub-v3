import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'
import {
  Plus,
  Calendar as CalendarIcon,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Home,
  Plane,
  Circle,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react'

// ============================================================================
// Calendar.jsx v2 — Calendario da Equipe (Check-in primario)
// ----------------------------------------------------------------------------
// Le da tabela `check_ins` que JA EXISTE no v3 com 7 registros populados.
//
// Schema real validado:
//   id, user_id, org_id, location (texto: endereço completo),
//   client_name, activity, status (texto: 'escritorio', 'cliente', etc),
//   check_in_time (timestamptz), check_out_time (timestamptz),
//   date (date), notes, created_at, updated_at, latitude, longitude
//
// Tambem le `events` (calendar) que tem schema:
//   id, org_id, title, date, time, type, location, description,
//   participants (array), created_by, created_at
// ============================================================================

// status reais: confirmamos 'escritorio' no banco
// Os demais sao assumidos seguindo o padrao do antigo
const LOCATION_TYPES = [
  { id: 'escritorio', label: 'Escritório', icon: Building2, color: 'violet', emoji: '🏢' },
  { id: 'cliente',    label: 'No cliente', icon: User,      color: 'emerald', emoji: '👤' },
  { id: 'remoto',     label: 'Remoto',     icon: Home,      color: 'sky',     emoji: '🏠' },
  { id: 'viagem',     label: 'Viagem',     icon: Plane,     color: 'amber',   emoji: '✈' },
  { id: 'ausente',    label: 'Ausente',    icon: Circle,    color: 'rose',    emoji: '○' },
]

const LOC_COLORS = {
  violet:  'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  sky:     'bg-sky-100 text-sky-700',
  amber:   'bg-amber-100 text-amber-800',
  rose:    'bg-rose-100 text-rose-700',
}

const TABS = [
  { id: 'checkin', label: 'Agenda Check-in', icon: MapPin },
  { id: 'events',  label: 'Agenda Compromissos', icon: CalendarIcon },
]

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d, n) {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

function formatDateISO(d) {
  return d.toISOString().slice(0, 10)
}

function formatDateBR(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

export default function Calendar() {
  const { profile } = useData()
  usePageTitle('Agenda')
  const [activeTab, setActiveTab] = useState('checkin')
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventForm, setEventForm] = useState({ title: '', date: '', time: '', type: 'meeting', location: '', description: '' })
  const [submittingEvent, setSubmittingEvent] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [checkins, setCheckins] = useState([])
  const [events, setEvents] = useState([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [showCheckinForm, setShowCheckinForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkinForm, setCheckinForm] = useState({
    date: formatDateISO(new Date()),
    status: 'escritorio',
    location: '',
    client_name: '',
    activity: '',
  })

  useEscapeKey(() => { setShowEventForm(false); setShowCheckinForm(false) }, !!(showEventForm || showCheckinForm))
  useEffect(() => {
    if (profile?.org_id) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id, weekStart])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      // Profiles
      const { data: profilesData, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, initials, avatar_color, role, email')
        .eq('org_id', profile?.org_id)
        .order('full_name', { ascending: true })
      if (pErr) throw pErr
      setProfiles(profilesData || [])

      // check_ins for the week
      const weekEnd = addDays(weekStart, 7)
      try {
        const { data: checkinsData, error: cErr } = await supabase
          .from('check_ins')
          .select('*')
          .eq('org_id', profile?.org_id)
          .gte('date', formatDateISO(weekStart))
          .lt('date', formatDateISO(weekEnd))
        if (cErr) throw cErr
        setCheckins(checkinsData || [])
      } catch (e) {
        console.warn('check_ins query failed:', e.message)
        setCheckins([])
      }

      // events (calendar) — schema: title, date, time, type, location, participants
      try {
        const { data: eventsData } = await supabase
          .from('events')
          .select('*')
          .eq('org_id', profile?.org_id)
          .gte('date', formatDateISO(weekStart))
          .lt('date', formatDateISO(addDays(weekStart, 60)))
          .order('date', { ascending: true })
        setEvents(eventsData || [])
      } catch (e) {
        setEvents([])
      }
    } catch (err) {
      console.error('Error loading calendar:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitCheckin() {
    if (!checkinForm.date || !checkinForm.status) {
      toast.warning('Preencha data e local')
      return
    }
    setSubmitting(true)
    try {
      // Schema real check_ins: user_id, org_id, location, client_name,
      //   activity, status, check_in_time, check_out_time, date, notes
      const payload = {
        org_id: profile.org_id,
        user_id: profile.id,
        date: checkinForm.date,
        status: checkinForm.status,
        location: checkinForm.location?.trim() || null,
        client_name: checkinForm.client_name?.trim() || null,
        activity: checkinForm.activity?.trim() || null,
        check_in_time: new Date().toISOString(),
      }
      const { error: iErr } = await supabase
        .from('check_ins')
        .insert([payload])
      if (iErr) throw iErr
      setShowCheckinForm(false)
      setCheckinForm({ date: formatDateISO(new Date()), status: 'escritorio', location: '', client_name: '', activity: '' })
      await loadAll()
      toast.success('Check-in registrado')
    } catch (err) {
      toast.error(`Erro ao registrar check-in: ` + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitEvent() {
    if (!eventForm.title.trim() || !eventForm.date) {
      toast.warning('Preencha título e data')
      return
    }
    setSubmittingEvent(true)
    try {
      const { error } = await supabase.from('events').insert({
        org_id: profile.org_id,
        title: eventForm.title.trim(),
        date: eventForm.date,
        time: eventForm.time || null,
        type: eventForm.type,
        location: eventForm.location?.trim() || null,
        description: eventForm.description?.trim() || null,
        created_by: profile.id,
      })
      if (error) throw error
      setShowEventForm(false)
      setEventForm({ title: '', date: '', time: '', type: 'meeting', location: '', description: '' })
      await loadAll()
      toast.success('Compromisso criado')
    } catch (err) {
      toast.error('Erro ao criar compromisso: ' + err.message)
    } finally {
      setSubmittingEvent(false)
    }
  }

  // B-114: showSuccess migrado para toast.success()

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  // Map: user_id -> Map: dateISO -> checkin (last one if multiple)
  const checkinMatrix = useMemo(() => {
    const matrix = new Map()
    checkins.forEach(c => {
      if (!matrix.has(c.user_id)) matrix.set(c.user_id, new Map())
      // Pega o check-in mais recente do dia
      const existing = matrix.get(c.user_id).get(c.date)
      if (!existing || (c.created_at && existing.created_at && new Date(c.created_at) > new Date(existing.created_at))) {
        matrix.get(c.user_id).set(c.date, c)
      }
    })
    return matrix
  }, [checkins])

  const todayISO = formatDateISO(new Date())
  const todayCheckins = useMemo(() => {
    // Excluir check-ins com check_out_time preenchido (pessoa já saiu)
    return checkins.filter(c => c.date === todayISO && !c.check_out_time)
  }, [checkins, todayISO])

  const kpis = useMemo(() => {
    const counts = { escritorio: 0, cliente: 0, remoto: 0, viagem: 0, ausente: 0 }
    todayCheckins.forEach(c => {
      if (counts[c.status] !== undefined) counts[c.status]++
    })
    const checkedInUserIds = new Set(todayCheckins.map(c => c.user_id))
    const noCheckin = profiles.filter(p => !checkedInUserIds.has(p.id)).length
    return { ...counts, noCheckin, total: profiles.length }
  }, [todayCheckins, profiles])

  const upcomingEvents = useMemo(() => {
    const todayISO_ = todayISO
    return events
      .filter(e => e.date >= todayISO_)
      .slice(0, 8)
  }, [events, todayISO])

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1">
              Calendário da equipe
            </div>
            <h1 className="text-2xl font-bold mb-1">Onde cada pessoa está</h1>
            <p className="text-sm text-zinc-300">
              Semana {formatDateBR(weekStart)} — {formatDateBR(addDays(weekStart, 6))} ·{' '}
              {profiles.length} membros · {checkins.length} check-ins na semana
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold"
            >
              Esta semana
            </button>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
              title="Próxima semana"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCheckinForm(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Check-in hoje
            </button>
            <button
              onClick={() => setShowEventForm(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo compromisso
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Kpi label="Total equipe" value={kpis.total} accent="violet" />
          <Kpi label="🏢 Escritório" value={kpis.escritorio} accent="violet" />
          <Kpi label="👤 No cliente" value={kpis.cliente} accent="emerald" />
          <Kpi label="🏠 Remoto" value={kpis.remoto} accent="sky" />
          <Kpi label="✈ Viagem" value={kpis.viagem} accent="amber" />
          <Kpi label="Sem check-in" value={kpis.noCheckin} accent="rose" />
        </div>

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

      {/* Form check-in */}
      {showCheckinForm && (
        <div className="bg-white border-2 border-violet-300 rounded-xl p-5 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-violet-600" />
              Registrar check-in
            </h2>
            <button onClick={() => setShowCheckinForm(false)} className="p-1 hover:bg-zinc-100 rounded">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Data</label>
              <input
                type="date"
                value={checkinForm.date}
                onChange={(e) => setCheckinForm({ ...checkinForm, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Local</label>
              <select
                value={checkinForm.status}
                onChange={(e) => setCheckinForm({ ...checkinForm, status: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none bg-white"
              >
                {LOCATION_TYPES.map(l => (
                  <option key={l.id} value={l.id}>{l.emoji} {l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Cliente (opcional)</label>
              <input
                type="text"
                placeholder="Ex: KIMBERLIT, LogiSul..."
                value={checkinForm.client_name}
                onChange={(e) => setCheckinForm({ ...checkinForm, client_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Endereço (opcional)</label>
              <input
                type="text"
                placeholder="Ex: Rua Santa Cruz, Vila Gumercindo"
                value={checkinForm.location}
                onChange={(e) => setCheckinForm({ ...checkinForm, location: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Atividade (opcional)</label>
              <input
                type="text"
                placeholder="Ex: Reunião de diagnóstico, kickoff..."
                value={checkinForm.activity}
                onChange={(e) => setCheckinForm({ ...checkinForm, activity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCheckinForm(false)} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg">
              Cancelar
            </button>
            <button onClick={submitCheckin} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
              {submitting ? 'Salvando…' : 'Registrar check-in'}
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

      {/* TAB: Check-in matrix */}
      {!loading && activeTab === 'checkin' && (
        <>
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-violet-600" />
                Onde cada pessoa está · esta semana
              </h2>
              <div className="flex gap-3 text-[10px] font-semibold text-zinc-500">
                {LOCATION_TYPES.map(l => (
                  <span key={l.id}>{l.emoji} {l.label}</span>
                ))}
              </div>
            </div>

            {profiles.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-400">Nenhum membro encontrado na equipe</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid grid-cols-[200px_repeat(7,1fr)] bg-zinc-50 border-b border-zinc-200 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 min-w-[800px]">
                  <div className="px-5">Membro</div>
                  {days.map(d => {
                    const isToday = formatDateISO(d) === todayISO
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                    return (
                      <div
                        key={d.toISOString()}
                        className={`text-center ${isToday ? 'text-violet-600 bg-violet-50' : ''} ${isWeekend ? 'opacity-50' : ''}`}
                      >
                        {WEEKDAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}
                        <div className="font-semibold text-[9px] opacity-70">{d.getDate()}</div>
                      </div>
                    )
                  })}
                </div>

                {profiles.map(p => {
                  const userCheckins = checkinMatrix.get(p.id) || new Map()
                  const initials = p.initials || (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  const avatarStyle = p.avatar_color ? { background: p.avatar_color } : {}
                  const avatarClass = p.avatar_color
                    ? 'w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0'
                    : 'w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0'
                  return (
                    <div key={p.id} className="grid grid-cols-[200px_repeat(7,1fr)] py-3 border-b border-zinc-100 hover:bg-zinc-50 items-center min-w-[800px]">
                      <div className="px-5 flex items-center gap-3">
                        <div className={avatarClass} style={avatarStyle}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-zinc-800 truncate">{p.full_name || '—'}</div>
                          <div className="text-[10px] text-zinc-500 truncate">{p.role || ''}</div>
                        </div>
                      </div>
                      {days.map(d => {
                        const dateStr = formatDateISO(d)
                        const c = userCheckins.get(dateStr)
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6
                        if (!c) {
                          return (
                            <div key={dateStr} className={`text-center ${isWeekend ? 'opacity-30' : ''}`}>
                              <span className="text-zinc-300 text-xs">—</span>
                            </div>
                          )
                        }
                        const loc = LOCATION_TYPES.find(l => l.id === c.status) || LOCATION_TYPES[0]
                        const labelText = c.client_name || (loc.label.length > 8 ? loc.label.substring(0, 7) : loc.label)
                        const checkedOut = !!c.check_out_time
                        const checkoutHour = checkedOut
                          ? new Date(c.check_out_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                          : null
                        return (
                          <div key={dateStr} className="text-center px-1 space-y-0.5">
                            <span
                              className={`inline-block px-2 py-1 rounded-md text-[9px] font-bold ${checkedOut ? 'bg-zinc-100 text-zinc-400 line-through' : LOC_COLORS[loc.color]}`}
                              title={checkedOut
                                ? `Checkout às ${checkoutHour} · ${loc.label}${c.client_name ? ' · ' + c.client_name : ''}`
                                : `${loc.label}${c.client_name ? ' · ' + c.client_name : ''}${c.activity ? ' · ' + c.activity : ''}`}
                            >
                              {checkedOut ? '🚪' : loc.emoji} {labelText.length > 10 ? labelText.substring(0, 9) : labelText}
                            </span>
                            {checkedOut && (
                              <div className="text-[8px] text-zinc-400 leading-none">saiu {checkoutHour}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Resumo de hoje */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-600" />
                Resumo de hoje
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {LOCATION_TYPES.slice(0, 4).map(loc => {
                  const list = todayCheckins.filter(c => c.status === loc.id)
                  const names = list.map(c => {
                    const p = profiles.find(x => x.id === c.user_id)
                    const firstName = p?.full_name?.split(' ')[0] || ''
                    // Mostrar empresa alocada se disponível
                    return c.client_name ? `${firstName} (${c.client_name.split(' ')[0]})` : firstName
                  }).filter(Boolean)
                  return (
                    <div key={loc.id} className={`${LOC_COLORS[loc.color]} rounded-xl p-4`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{loc.emoji} {loc.label}</div>
                      <div className="text-3xl font-bold mt-1">{list.length}</div>
                      <div className="text-[10px] mt-1 truncate opacity-80">
                        {names.join(', ') || '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
              {kpis.noCheckin > 0 && (
                <div className="mt-4 p-3 bg-rose-50 border-l-4 border-rose-400 rounded-lg">
                  <div className="text-xs font-bold text-rose-700">⚠ {kpis.noCheckin} {kpis.noCheckin === 1 ? 'pessoa sem' : 'pessoas sem'} check-in hoje</div>
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-violet-600" />
                Próximos compromissos
              </h2>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-6 text-sm text-zinc-400">
                  Nenhum compromisso agendado.
                  <div className="text-xs mt-2 text-zinc-400">
                    Veja a aba "Agenda Compromissos" para mais.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.slice(0, 5).map(e => (
                    <div key={e.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 rounded-lg">
                      <div className="text-xs font-bold text-violet-700 w-20 flex-shrink-0">
                        {e.date}{e.time ? ` ${e.time.substring(0, 5)}` : ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-zinc-800 truncate">{e.title || 'Sem título'}</div>
                        {e.location && <div className="text-[10px] text-zinc-500 truncate">📍 {e.location}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* TAB: Events */}
      {showEventForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => e.target === e.currentTarget && setShowEventForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-zinc-800">Novo Compromisso</h3>
              <button onClick={() => setShowEventForm(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Título *</label>
                <input autoFocus className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={eventForm.title} onChange={e => setEventForm(p => ({...p, title: e.target.value}))} placeholder="Ex: Reunião com cliente..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Data *</label>
                  <input type="date" className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={eventForm.date} onChange={e => setEventForm(p => ({...p, date: e.target.value}))} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Horário</label>
                  <input type="time" className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={eventForm.time} onChange={e => setEventForm(p => ({...p, time: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tipo</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={eventForm.type} onChange={e => setEventForm(p => ({...p, type: e.target.value}))}>
                    <option value="meeting">Reunião</option>
                    <option value="deadline">Prazo</option>
                    <option value="court">Audiência</option>
                    <option value="call">Ligação</option>
                    <option value="visit">Visita</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Local</label>
                  <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={eventForm.location} onChange={e => setEventForm(p => ({...p, location: e.target.value}))} placeholder="Online, escritório..." />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Descrição</label>
                <textarea rows={2} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
                  value={eventForm.description} onChange={e => setEventForm(p => ({...p, description: e.target.value}))} placeholder="Detalhes adicionais..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={submitEvent} disabled={submittingEvent || !eventForm.title.trim() || !eventForm.date}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#5452C1' }}>
                  {submittingEvent ? 'Salvando…' : 'Criar Compromisso'}
                </button>
                <button onClick={() => setShowEventForm(false)} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'events' && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-violet-600" />
            Compromissos
            <span className="ml-2 text-xs text-zinc-500 font-semibold">{events.length}</span>
          </h2>
          {events.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <div className="text-sm font-semibold text-zinc-700">Nenhum compromisso encontrado</div>
              <div className="text-xs text-zinc-500 mt-1">A tabela <code className="bg-zinc-100 px-1 rounded">events</code> está vazia para o período.</div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {events.map(e => (
                <div key={e.id} className="py-3 flex items-center gap-3">
                  <div className="text-xs font-bold text-violet-700 w-28 flex-shrink-0">
                    {e.date}{e.time ? ` ${e.time.substring(0, 5)}` : ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-zinc-800 truncate">{e.title || 'Sem título'}</div>
                    {e.description && <div className="text-xs text-zinc-500 truncate">{e.description}</div>}
                    {e.location && <div className="text-[10px] text-zinc-400 truncate">📍 {e.location}</div>}
                  </div>
                  {e.type && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase tracking-wide flex-shrink-0">
                      {e.type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
