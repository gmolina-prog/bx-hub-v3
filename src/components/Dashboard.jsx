import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import { MapPin, Bell, Clock, AlertTriangle, CheckCircle, Zap, TrendingUp, Users, Activity } from 'lucide-react'

// Leaflet via CDN — injetado uma vez
function useLeaflet() {
  const [ready, setReady] = useState(!!window.L)
  useEffect(() => {
    if (window.L) { setReady(true); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => setReady(true)
    document.head.appendChild(script)
  }, [])
  return ready
}

const STATUS_COLORS = {
  escritorio: '#5452C1',
  cliente:    '#10B981',
  remoto:     '#0EA5E9',
  viagem:     '#F59E0B',
}
const STATUS_LABELS = {
  escritorio: 'Escritório',
  cliente:    'Cliente',
  remoto:     'Remoto',
  viagem:     'Viagem',
}
// SP coords spread por status
const STATUS_COORDS = {
  escritorio: [-23.5613, -46.6558],
  cliente:    [-23.5955, -46.6889],
  remoto:     [-23.5629, -46.6823],
  viagem:     [-23.5329, -46.6395],
}

function MapCheckin({ members }) {
  const leafletReady = useLeaflet()
  const mapRef = useRef(null)
  const instanceRef = useRef(null)
  const markersRef = useRef({})

  useEffect(() => {
    if (!leafletReady || !mapRef.current) return
    if (instanceRef.current) return
    const L = window.L
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([-23.5613, -46.6558], 12)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    instanceRef.current = map
    members.forEach(m => addMarker(map, m))
  }, [leafletReady, members])

  function addMarker(map, m) {
    const L = window.L
    const color = STATUS_COLORS[m.status] || '#5452C1'
    const coords = STATUS_COORDS[m.status] || [-23.5613 + (Math.random()-0.5)*0.02, -46.6558 + (Math.random()-0.5)*0.02]
    const html = `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700;font-family:Montserrat,sans-serif;">${m.initials || '?'}</div>`
    const icon = L.divIcon({ className: '', html, iconSize: [32, 32], iconAnchor: [16, 16] })
    const marker = L.marker(coords, { icon }).addTo(map)
    marker.bindPopup(`<div style="font-family:Montserrat,sans-serif;padding:4px;"><b>${m.full_name}</b><br><span style="color:#71717A;font-size:11px;">${STATUS_LABELS[m.status] || m.status}</span></div>`)
    markersRef.current[m.id] = { marker, coords }
  }

  function flyTo(memberId) {
    if (!instanceRef.current) return
    const ref = markersRef.current[memberId]
    if (!ref) return
    instanceRef.current.flyTo(ref.coords, 16, { duration: 1.2 })
    ref.marker.openPopup()
  }

  return { mapRef, flyTo }
}

export default function Dashboard() {
  const { profile } = useData()
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [checkIns, setCheckIns] = useState([])
  const [activity, setActivity] = useState([])
  const [routines, setRoutines] = useState([])
  const [routineCompletions, setRoutineCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTeamMember, setActiveTeamMember] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [tasksRes, projRes, profRes, ciRes, actRes, routRes, compRes] = await Promise.allSettled([
      supabase.from('tasks').select('*').eq('org_id', profile.org_id).is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
      supabase.from('projects').select('*, companies(name,criticality)').eq('org_id', profile.org_id),
      supabase.from('profiles').select('*').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('check_ins').select('*').eq('org_id', profile.org_id).eq('date', today).order('check_in_time', { ascending: false }),
      supabase.from('activity_log').select('*, profiles(full_name,initials,avatar_color)').eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(12),
      supabase.from('routines').select('*').eq('org_id', profile.org_id).eq('is_active', true),
      supabase.from('routine_completions').select('*').eq('org_id', profile.org_id).eq('reference_date', today),
    ])
    if (tasksRes.status === 'fulfilled' && !tasksRes.value.error) setTasks(tasksRes.value.data || [])
    if (projRes.status === 'fulfilled' && !projRes.value.error) setProjects(projRes.value.data || [])
    if (profRes.status === 'fulfilled' && !profRes.value.error) setMembers(profRes.value.data || [])
    if (ciRes.status === 'fulfilled' && !ciRes.value.error) setCheckIns(ciRes.value.data || [])
    if (actRes.status === 'fulfilled' && !actRes.value.error) setActivity(actRes.value.data || [])
    if (routRes.status === 'fulfilled' && !routRes.value.error) setRoutines(routRes.value.data || [])
    if (compRes.status === 'fulfilled' && !compRes.value.error) setRoutineCompletions(compRes.value.data || [])
    setLoading(false)
  }, [profile, today])

  useEffect(() => { load() }, [load])

  // Enrich members with today's check-in status
  const membersWithStatus = members.map(m => {
    const ci = checkIns.find(c => c.user_id === m.id)
    return { ...m, status: ci?.status || 'pendente', location: ci?.location || '' }
  })

  const { mapRef, flyTo } = MapCheckin({ members: membersWithStatus })

  // KPIs
  const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.column_id !== 'done').length
  const inProgressCount = tasks.filter(t => t.column_id === 'doing').length
  const criticalProjects = projects.filter(p => p.companies?.criticality === 'critico').length
  const doneToday = routineCompletions.length
  const compliance = routines.length > 0 ? Math.round(doneToday / routines.length * 100) : 0

  // Status counts for map pills
  const statusCounts = membersWithStatus.reduce((acc, m) => { acc[m.status] = (acc[m.status] || 0) + 1; return acc }, {})

  function fmtRelTime(d) {
    const diff = Math.floor((Date.now() - new Date(d)) / 1000)
    if (diff < 60) return 'agora'
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
    return `${Math.floor(diff / 86400)}d atrás`
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const now = new Date()
  const dayNames = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
  const weekday = dayNames[now.getDay()]
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  const priorityTasks = tasks.filter(t => t.column_id !== 'done').sort((a, b) => {
    const pri = { urgent: 0, high: 1, medium: 2 }
    return (pri[a.priority] ?? 3) - (pri[b.priority] ?? 3)
  }).slice(0, 7)

  const dueBadge = (t) => {
    if (!t.due_date) return null
    const d = new Date(t.due_date)
    const diff = Math.ceil((d - new Date()) / 86400000)
    if (diff < 0) return { label: `${Math.abs(diff)}d`, cls: 'bg-red-500 text-white' }
    if (diff === 0) return { label: 'hoje', cls: 'bg-amber-400 text-white' }
    if (diff === 1) return { label: 'amanhã', cls: 'bg-sky-500 text-white' }
    return null
  }

  const priorityBorder = (t) => {
    if (t.priority === 'urgent') return 'border-l-red-500'
    if (t.priority === 'high') return 'border-l-amber-400'
    return 'border-l-sky-400'
  }

  const priorityBg = (t) => {
    if (t.priority === 'urgent') return 'bg-red-50'
    if (t.priority === 'high') return 'bg-amber-50'
    return 'bg-zinc-50'
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">

      {/* HERO: Mapa + Central de Comando */}
      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', height: 440 }}>

        {/* MAPA LEAFLET */}
        <div className="relative bg-zinc-200">
          <div ref={mapRef} className="w-full h-full" />
          {/* Pills de status */}
          <div className="absolute top-4 left-4 z-[500] flex gap-2 flex-wrap pointer-events-none">
            {Object.entries(statusCounts).filter(([k]) => k !== 'pendente').map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold shadow-md pointer-events-auto">
                <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] || '#aaa' }} />
                {count} {STATUS_LABELS[status] || status}
              </div>
            ))}
            {(statusCounts['pendente'] || 0) > 0 && (
              <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold shadow-md">
                <div className="w-2 h-2 rounded-full bg-zinc-400" />
                {statusCounts['pendente']} sem check-in
              </div>
            )}
          </div>
          {/* Legenda */}
          <div className="absolute bottom-4 left-4 z-[500] flex gap-4 bg-white/95 backdrop-blur px-3 py-2 rounded-full text-[10px] font-semibold shadow-md">
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-zinc-600">
                <div className="w-2 h-2 rounded-full border border-white shadow-sm" style={{ background: STATUS_COLORS[k] }} />
                {v}
              </div>
            ))}
          </div>
        </div>

        {/* CENTRAL DE COMANDO */}
        <div className="bg-zinc-800 text-white flex flex-col gap-3 p-6 overflow-y-auto">
          {/* Saudação + data */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-1">Central de comando</div>
              <div className="text-[22px] font-black leading-tight tracking-tight">{greeting()}, {profile?.full_name?.split(' ')[0] || 'Gabriel'}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-right shrink-0">
              <div className="text-[9px] text-white/50 font-bold uppercase tracking-wider">{weekday}</div>
              <div className="text-lg font-black leading-tight">{dateStr}</div>
              <div className="text-[9px] text-teal-400 font-bold uppercase tracking-wide mt-0.5">
                Q{Math.ceil((now.getMonth() + 1) / 3)} · Sem {Math.ceil(now.getDate() / 7 + (now.getMonth() * 4.33))}
              </div>
            </div>
          </div>

          {/* Alerta urgência */}
          {overdueCount > 0 && (
            <div className="flex items-center gap-3 bg-red-500/15 border border-red-500/30 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-wide text-red-300">Atenção</div>
                <div className="text-xs font-semibold text-white">{overdueCount} tarefa{overdueCount !== 1 ? 's' : ''} vencida{overdueCount !== 1 ? 's' : ''}</div>
              </div>
              <div className="text-[10px] font-bold bg-white text-zinc-800 px-2 py-1 rounded-lg cursor-pointer">Ver</div>
            </div>
          )}

          {/* Mini KPIs */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Vencidas',    val: overdueCount,    cls: overdueCount > 0 ? 'text-red-300' : 'text-white' },
              { label: 'Em andamento',val: inProgressCount, cls: 'text-blue-300' },
              { label: 'Críticos',    val: criticalProjects,cls: criticalProjects > 0 ? 'text-amber-300' : 'text-white' },
              { label: 'Conformidade',val: `${compliance}%`,cls: compliance >= 80 ? 'text-emerald-300' : 'text-amber-300' },
            ].map(k => (
              <div key={k.label} className="bg-white/5 border border-white/8 rounded-xl p-2.5">
                <div className="text-[8px] text-white/50 font-bold uppercase tracking-wider">{k.label}</div>
                <div className={`text-xl font-black leading-tight mt-1 ${k.cls}`}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Próxima reunião / placeholder */}
          <div className="flex items-center gap-3 bg-violet-600/80 rounded-xl p-3">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-white/70 font-bold uppercase tracking-wider">Projetos ativos</div>
              <div className="text-xs font-bold text-white">{projects.length} projeto{projects.length !== 1 ? 's' : ''} · {members.length} colaboradores</div>
            </div>
            <div className="text-[10px] font-black bg-white text-violet-700 px-2 py-1 rounded-lg">{tasks.filter(t => t.column_id !== 'done').length} tasks</div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-6 flex flex-col gap-5">

        {/* ROW 1: Tarefas prioritárias + Carga da equipe */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" />Tarefas prioritárias</div>
              {overdueCount > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{overdueCount} vencidas</span>}
            </div>
            <div className="space-y-1.5">
              {priorityTasks.length === 0 ? (
                <div className="text-xs text-zinc-400 py-4 text-center">Nenhuma tarefa pendente 🎉</div>
              ) : priorityTasks.map(t => {
                const badge = dueBadge(t)
                const assignee = members.find(m => m.id === t.assigned_to)
                return (
                  <div key={t.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-2 ${priorityBorder(t)} ${priorityBg(t)} cursor-pointer hover:opacity-80`}>
                    <div className="w-3.5 h-3.5 rounded border-2 border-zinc-300 shrink-0" />
                    <div className="flex-1 text-xs font-semibold text-zinc-800 truncate">{t.title}</div>
                    {badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.label}</span>}
                    {assignee && (
                      <div className="w-5 h-5 rounded-full text-[8px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: assignee.avatar_color || '#5452C1' }}>
                        {assignee.initials || '?'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" />Carga da equipe</div>
            </div>
            <div className="space-y-3">
              {members.slice(0, 6).map(m => {
                const count = tasks.filter(t => t.assigned_to === m.id && t.column_id !== 'done').length
                const max = 15
                const pct = Math.min(100, Math.round(count / max * 100))
                const barColor = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-500'
                const textColor = pct > 85 ? 'text-red-600' : pct > 60 ? 'text-amber-600' : 'text-emerald-600'
                return (
                  <div key={m.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full text-[8px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: m.avatar_color || '#5452C1' }}>
                          {m.initials || '?'}
                        </div>
                        <span className="text-xs font-semibold text-zinc-700 truncate max-w-[100px]">{m.full_name}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${textColor}`}>{count} tasks</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ROW 2: Projetos heatmap + Conformidade */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>

          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" />Heatmap operacional</div>
              <span className="text-[10px] font-bold text-zinc-500">{projects.length} projetos</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                  <th className="text-left px-5 py-2 font-bold">Projeto</th>
                  <th className="text-center px-3 py-2 font-bold">Vencidas</th>
                  <th className="text-center px-3 py-2 font-bold">Abertas</th>
                  <th className="text-center px-3 py-2 font-bold">Progresso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {projects.slice(0, 6).map(p => {
                  const pTasks = tasks.filter(t => t.project_id === p.id)
                  const overdue = pTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.column_id !== 'done').length
                  const open = pTasks.filter(t => t.column_id !== 'done').length
                  const progress = p.progress || 0
                  const flagColor = p.companies?.criticality === 'critico' ? 'bg-red-500' : p.companies?.criticality === 'alto' ? 'bg-amber-400' : 'bg-emerald-500'
                  const cell = (v, thresholds) => {
                    if (v === 0) return 'bg-zinc-100 text-zinc-400'
                    if (v >= thresholds[1]) return 'bg-red-100 text-red-700'
                    if (v >= thresholds[0]) return 'bg-amber-100 text-amber-700'
                    return 'bg-emerald-100 text-emerald-700'
                  }
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50 cursor-pointer">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-5 rounded-full shrink-0 ${flagColor}`} />
                          <span className="font-semibold text-zinc-800 truncate max-w-[140px]">{p.name}</span>
                          {p.companies?.name && <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-bold">{p.companies.name.split(' ')[0]}</span>}
                        </div>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-[10px] font-bold ${cell(overdue, [1, 3])}`}>{overdue}</span>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-[10px] font-bold ${cell(open, [5, 10])}`}>{open}</span>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`inline-block min-w-[36px] px-1.5 py-0.5 rounded text-[10px] font-bold ${parseInt(progress) >= 70 ? 'bg-emerald-100 text-emerald-700' : parseInt(progress) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{progress}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" />Conformidade rotinas</div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${compliance >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{compliance}%</span>
            </div>
            {/* Ring SVG */}
            <div className="flex items-center gap-4 mb-4">
              <svg width="90" height="90" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r="36" fill="none" stroke="#F4F4F5" strokeWidth="9" />
                <circle cx="45" cy="45" r="36" fill="none" stroke={compliance >= 80 ? '#10B981' : compliance >= 60 ? '#F59E0B' : '#EF4444'} strokeWidth="9"
                  strokeDasharray="226" strokeDashoffset={226 - (226 * compliance / 100)}
                  strokeLinecap="round" transform="rotate(-90 45 45)" />
                <text x="45" y="49" textAnchor="middle" fontSize="18" fontWeight="800" fill="#2D2E39" fontFamily="Montserrat">{compliance}%</text>
              </svg>
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-zinc-500">Total rotinas</span><span className="font-bold">{routines.length}</span></div>
                <div className="flex justify-between text-xs"><span className="text-zinc-500">Concluídas hoje</span><span className="font-bold text-emerald-600">{doneToday}</span></div>
                <div className="flex justify-between text-xs"><span className="text-zinc-500">Pendentes</span><span className={`font-bold ${routines.length - doneToday > 0 ? 'text-red-500' : 'text-zinc-600'}`}>{routines.length - doneToday}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: Equipe agora + Atividade recente */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" />Equipe agora</div>
              <span className="text-[10px] font-bold text-zinc-500">{members.length} colaboradores</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {membersWithStatus.map(m => {
                const isActive = activeTeamMember === m.id
                const statusColor = STATUS_COLORS[m.status] || '#A1A1AA'
                const statusDot = m.status !== 'pendente' ? statusColor : '#A1A1AA'
                return (
                  <div key={m.id} onClick={() => { setActiveTeamMember(m.id); flyTo(m.id) }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-l-2 transition-all ${isActive ? 'border-l-violet-500 bg-violet-50' : 'border-l-transparent bg-zinc-50 hover:bg-zinc-100'}`}>
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: m.avatar_color || '#5452C1' }}>
                        {m.initials || '?'}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: statusDot }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-zinc-800 truncate">{m.full_name}</div>
                      <div className="text-[10px] text-zinc-500 truncate">{m.location || STATUS_LABELS[m.status] || 'Sem check-in'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" />Atividade recente</div>
              <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />live</div>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {activity.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-4">Nenhuma atividade recente.</div>
              ) : activity.map(a => {
                const actor = a.profiles
                return (
                  <div key={a.id} className="flex gap-2.5 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-700 leading-snug">
                        <span className="font-bold">{actor?.full_name?.split(' ')[0] || 'Sistema'}</span> {a.action}
                        {a.details && <span className="text-zinc-500"> — {String(a.details).slice(0, 40)}</span>}
                      </div>
                      <div className="text-[9px] text-zinc-400 mt-0.5">{fmtRelTime(a.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
