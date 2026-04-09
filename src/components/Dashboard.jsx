import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'

// Leaflet via CDN — carregado dinamicamente
function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) { resolve(window.L); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve(window.L)
    document.head.appendChild(script)
  })
}

import { RefreshCw } from 'lucide-react'

const CH = '#2D2E39', VL = '#5452C1'
const GREEN = '#10B981', AMBER = '#F59E0B', RED = '#EF4444', BLUE = '#3B82F6'

const CHECKIN_TYPES = {
  escritorio: { label: 'Escritório', icon: '🏢', color: BLUE, lat: -23.5951, lng: -46.6872 },
  cliente:    { label: 'No Cliente', icon: '🤝', color: GREEN, lat: -23.5700, lng: -46.6400 },
  remoto:     { label: 'Remoto',     icon: '🏠', color: '#8B5CF6', lat: null, lng: null },
  viagem:     { label: 'Em Viagem',  icon: '✈️', color: AMBER, lat: null, lng: null },
}

function fmtBRL(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(n || 0)
}

function relTime(d) {
  if (!d) return ''
  const diff = (Date.now() - new Date(d)) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Bom dia', icon: '🌅' }
  if (h < 18) return { text: 'Boa tarde', icon: '☀️' }
  return { text: 'Boa noite', icon: '🌙' }
}

// Mini gauge SVG
function Gauge({ score }) {
  const color = score >= 80 ? GREEN : score >= 60 ? AMBER : RED
  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 40 ? 'Atenção' : 'Crítico'
  const pct = Math.max(0, Math.min(100, score)) / 100
  const endAngle = Math.PI * pct
  const ex = 110 + 100 * Math.cos(Math.PI - endAngle)
  const ey = 130 - 100 * Math.sin(Math.PI - endAngle)
  const large = pct > 0.5 ? 1 : 0
  return (
    <div className="text-center">
      <svg width="220" height="140">
        <defs>
          <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={RED} />
            <stop offset="50%" stopColor={AMBER} />
            <stop offset="100%" stopColor={GREEN} />
          </linearGradient>
        </defs>
        <path d="M 30 130 A 100 100 0 0 1 190 130" stroke="#E8E8EE" strokeWidth="12" fill="none" strokeLinecap="round" />
        {pct > 0 && <path d={`M 30 130 A 100 100 0 ${large} 1 ${ex} ${ey}`} stroke="url(#gGrad)" strokeWidth="12" fill="none" strokeLinecap="round" />}
        <text x="110" y="102" fontSize="42" fontWeight="700" textAnchor="middle" fill={color} fontFamily="Montserrat">{score}</text>
        <text x="110" y="122" fontSize="12" textAnchor="middle" fill="#999" fontFamily="Montserrat">{label}</text>
      </svg>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useData()
  usePageTitle('Dashboard')
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const clockRef = useRef(null)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const [tasksR, pipeR, projR, ciR, profR, routR, actR] = await Promise.allSettled([
      supabase.from('tasks').select('id,column_id,priority,assigned_to,due_date,title,project_id,updated_at').eq('org_id', profile.org_id).is('deleted_at', null).limit(500),
      supabase.from('pipeline_items').select('id,stage,value,probability,name').eq('org_id', profile.org_id).eq('is_archived', false).limit(200),
      supabase.from('projects').select('id,name,status,deadline').eq('org_id', profile.org_id),
      supabase.from('check_ins').select('id,user_id,date,status,location,latitude,longitude').eq('org_id', profile.org_id).eq('date', today),
      supabase.from('profiles').select('id,full_name,initials,avatar_color,role,cargo').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('routines').select('id,is_active,frequency').eq('org_id', profile.org_id).eq('is_active', true),
      supabase.from('activity_log').select('id,actor_id,entity_type,action,metadata,created_at,module').eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(10),
    ])

    const tasks    = tasksR.status === 'fulfilled' && !tasksR.value.error ? tasksR.value.data || [] : []
    const actLog   = actR.status   === 'fulfilled' && !actR.value.error   ? actR.value.data  || [] : []
    const pipeline = pipeR.status === 'fulfilled' && !pipeR.value.error ? pipeR.value.data || [] : []
    const projects = projR.status === 'fulfilled' && !projR.value.error ? projR.value.data || [] : []
    const checkins = ciR.status === 'fulfilled' && !ciR.value.error ? ciR.value.data || [] : []
    const profiles = profR.status === 'fulfilled' && !profR.value.error ? profR.value.data || [] : []
    const routines = routR.status === 'fulfilled' && !routR.value.error ? routR.value.data || [] : []

    const now = new Date()
    const todo = tasks.filter(t => t.column_id === 'todo' || t.column_id === 'backlog').length
    const doing = tasks.filter(t => t.column_id === 'doing').length
    const done = tasks.filter(t => t.column_id === 'done').length
    const overdue  = tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.column_id !== 'done').length
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 2)
    const dueSoon  = tasks.filter(t => t.due_date && t.column_id !== 'done' && new Date(t.due_date) >= now && new Date(t.due_date) < tomorrow)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 5)
    const doneWeek = tasks.filter(t => t.column_id === 'done' && t.updated_at && (now - new Date(t.updated_at)) < 604800000).length

    const pipeTotal = pipeline.reduce((s, p) => s + (p.value || 0), 0)
    const pipeWeighted = pipeline.reduce((s, p) => s + (p.value || 0) * (p.probability || 0) / 100, 0)

    // B-116: 'active' e 'Em andamento' são o mesmo estado — ambos contam como ativo
    const INACTIVE_STATUSES = ['Cancelado','Completo','cancelled','complete','Concluído','concluido','Pausado','pausado']
    const activeProjs = projects.filter(p => !INACTIVE_STATUSES.includes(p.status))
    const profMap = {}
    profiles.forEach(p => { profMap[p.id] = p })

    const ciByStatus = { escritorio: 0, cliente: 0, remoto: 0, viagem: 0 }
    checkins.forEach(c => { const s = (c.status || '').toLowerCase().replace(/ /g, ''); if (ciByStatus[s] !== undefined) ciByStatus[s]++ })

    const memberLoad = {}
    tasks.filter(t => t.column_id !== 'done').forEach(t => {
      const name = profMap[t.assigned_to]?.full_name || 'Não atribuído'
      memberLoad[name] = (memberLoad[name] || 0) + 1
    })
    const memberLoadArr = Object.entries(memberLoad).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

    // B-105: usar activity_log se disponível, fallback para tasks recentes
    const recentActivity = actLog.length > 0 ? actLog : [...tasks]
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)).slice(0, 5)

    // Saúde do hub: base 100, descontos por problemas, bônus por resultados
    let health = 100
    health -= overdue * 8                            // cada tarefa vencida -8
    health -= Math.max(0, (doing + todo) - 10) * 2  // excesso de WIP -2 por item
    health += Math.min(20, doneWeek * 3)             // tarefas entregues esta semana (máx +20)
    if (pipeTotal > 1000000) health += 10
    else if (pipeTotal > 500000) health += 5
    const ciPct = profiles.length > 0 ? checkins.length / profiles.length : 0
    if (ciPct >= 0.8) health += 5                    // +5 se 80%+ da equipe fez check-in
    else if (ciPct < 0.3 && profiles.length > 2) health -= 5  // equipe sem check-in
    health = Math.max(0, Math.min(100, Math.round(health)))

    const statusIcon = overdue >= 3 ? '🔴' : overdue >= 1 ? '🟡' : '🟢'
    const statusText = overdue >= 3 ? `${overdue} alertas críticos` : overdue >= 1 ? `${overdue} tarefa(s) vencida(s)` : 'Operação estável — 0 alertas'

    const pipeStages = [
      { label: 'Indicação', id: 'indicacao', color: '#9CA3AF' },
      { label: 'Comitê',    id: 'comite',    color: AMBER },
      { label: 'Liberado',  id: 'liberado',  color: GREEN },
    ].map(st => ({
      ...st,
      count: pipeline.filter(p => p.stage === st.id).length,
      value: pipeline.filter(p => p.stage === st.id).reduce((s, p) => s + (p.value || 0), 0),
    }))

    const firstName = profile.full_name?.split(' ')[0] || 'Gabriel'

    setData({ tasks, pipeline, projects, checkins, profiles, routines, todo, doing, done, overdue, doneWeek, pipeTotal, pipeWeighted, activeProjs, profMap, ciByStatus, memberLoadArr, recentActivity, health, statusIcon, statusText, pipeStages, firstName, ciPct, dueSoon, actLog })
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  // B-121: refresh automático a cada 2 minutos
  useEffect(() => {
    const interval = setInterval(() => { load() }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  // Mapa Leaflet
  useEffect(() => {
    if (!data || !mapRef.current) return
    loadLeaflet().then(L => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
      const map = L.map(mapRef.current, { zoom: 12, zoomControl: true, attributionControl: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      leafletMapRef.current = map

      const office = [-23.6195, -46.6988] // Av. Dr. Chucri Zaidan 1550, Vila Cordeiro
      const positioned = []

      // Marcar escritório
      L.circle(office, { radius: 200, color: BLUE, fillColor: BLUE, fillOpacity: 0.15 }).addTo(map)

      // Offset deterministico por user_id (sem Math.random — posição consistente)
      function deterministicOffset(uid, scale) {
        let h1 = 0, h2 = 0
        for (let i = 0; i < uid.length; i++) { h1 = ((h1 << 5) - h1) + uid.charCodeAt(i); h1 |= 0 }
        for (let i = uid.length - 1; i >= 0; i--) { h2 = ((h2 << 5) - h2) + uid.charCodeAt(i); h2 |= 0 }
        return [(h1 / 0x7fffffff) * scale, (h2 / 0x7fffffff) * scale]
      }

      // Markers por check-in
      data.checkins.forEach(ci => {
        const prof = data.profMap[ci.user_id]
        if (!prof) return
        const initials = prof.initials || prof.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
        const color = prof.avatar_color || VL
        const s = (ci.status || '').toLowerCase()
        let lat, lng
        if (ci.latitude && ci.longitude) {
          lat = parseFloat(ci.latitude); lng = parseFloat(ci.longitude)
        } else {
          const [dLat, dLng] = deterministicOffset(ci.user_id, 0.004)
          lat = office[0] + dLat; lng = office[1] + dLng
        }
        positioned.push([lat, lng])

        const icon = L.divIcon({
          html: `<div style="background:${color};color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:Montserrat,sans-serif;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${initials}</div>`,
          className: '', iconAnchor: [16, 16],
        })
        const typeInfo = CHECKIN_TYPES[s] || { icon: '📍', label: s }
        L.marker([lat, lng], { icon }).addTo(map)
          .bindPopup(`<b style="font-family:Montserrat">${prof.full_name}</b><br>${typeInfo.icon} ${typeInfo.label}<br>${ci.location || ''}`)
      })

      // Membros sem check-in — posição determinística no entorno do escritório
      data.profiles.filter(p => !data.checkins.find(c => c.user_id === p.id)).forEach(p => {
        const initials = p.initials || p.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
        const [dLat, dLng] = deterministicOffset(p.id, 0.008)
        const lat = office[0] + dLat
        const lng = office[1] + dLng
        positioned.push([lat, lng])
        const icon = L.divIcon({
          html: `<div style="background:#9CA3AF;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:Montserrat,sans-serif;border:2px solid white;opacity:0.6">${initials}</div>`,
          className: '', iconAnchor: [14, 14],
        })
        L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${p.full_name}</b><br>Sem check-in hoje`)
      })

      if (positioned.length > 0) map.fitBounds(L.latLngBounds([office, ...positioned]).pad(0.3))
      else map.setView(office, 13)
    })
    return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null } }
  }, [data])

  // Clock
  useEffect(() => {
    const tick = () => { if (clockRef.current) clockRef.current.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <div className="p-6 text-center text-sm text-zinc-400">Carregando…</div>
  if (!data) return null

  const { todo, doing, done, overdue, pipeTotal, pipeWeighted, activeProjs, profiles, checkins, ciByStatus, memberLoadArr, recentActivity, health, statusIcon, statusText, pipeStages, firstName, ciPct, dueSoon = [], actLog = [] } = data
  const gr = greeting()
  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="p-6 max-w-[1600px] mx-auto font-['Montserrat',system-ui,sans-serif]">

      {/* ── HERO GREETING ── */}
      <div className="rounded-2xl p-7 mb-6 relative overflow-hidden text-white" style={{ background: CH }}>
        <div className="absolute top-[-30px] right-[-30px] w-48 h-48 rounded-full" style={{ background: `radial-gradient(circle, ${VL}33 0%, transparent 70%)` }} />
        <div className="flex justify-between items-start relative z-10 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{gr.icon}</span>
              <h1 className="text-2xl font-bold">{gr.text}, {firstName}!</h1>
            </div>
            <p className="text-sm text-zinc-400 ml-11">{dateStr}</p>
            <div className="mt-3 ml-11 inline-flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 text-sm">
              <span>{statusIcon}</span><span>{statusText}</span>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div ref={clockRef} className="text-4xl font-bold tracking-widest" />
            <p className="text-xs text-zinc-500">BX Project Hub v3</p>
            <button onClick={load} title="Atualizar dados"
              className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-zinc-300 transition-colors">
              <RefreshCw className="w-3 h-3" /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* ── MAPA + EQUIPE HOJE ── */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <div>
            <h2 className="text-sm font-bold text-zinc-800">Localização da Equipe</h2>
            <p className="text-xs text-zinc-500">{checkins.length}/{profiles.length} check-ins hoje</p>
          </div>
          <button onClick={() => navigate('/time')} className="text-xs font-semibold text-violet-600 hover:text-violet-700">Ver Time →</button>
        </div>
        <div className="flex flex-col md:flex-row">
          {/* Mapa */}
          <div ref={mapRef} className="flex-1 min-h-[280px]" style={{ zIndex: 0 }} />
          {/* Painel check-in */}
          <div className="w-full md:w-64 shrink-0 border-t md:border-t-0 md:border-l border-zinc-100 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Status Hoje</div>
            {Object.entries(CHECKIN_TYPES).map(([key, t]) => (
              <div key={key} className={`flex items-center justify-between px-3 py-2 rounded-lg mb-1.5 ${ciByStatus[key] > 0 ? 'bg-zinc-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{t.icon}</span>
                  <span className="text-xs font-medium text-zinc-700">{t.label}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: ciByStatus[key] > 0 ? t.color : '#DDD' }}>{ciByStatus[key] || 0}</span>
              </div>
            ))}
            {profiles.length - checkins.length > 0 && (
              <div className="mt-2 text-center text-xs text-zinc-400 bg-zinc-50 rounded-lg py-2">{profiles.length - checkins.length} sem check-in</div>
            )}
            {/* Lista de membros com avatar */}
            <div className="mt-4 space-y-2">
              {profiles.slice(0, 6).map(p => {
                const ci = checkins.find(c => c.user_id === p.id)
                const s = ci ? (ci.status || '').toLowerCase() : null
                const t = s ? CHECKIN_TYPES[s] : null
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: p.avatar_color || VL }}>
                      {p.initials || p.full_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs text-zinc-700 flex-1 truncate">{p.full_name?.split(' ')[0]}</span>
                    <span className="text-sm">{t ? t.icon : '⚪'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── HEALTH SCORE + SEMÁFORO ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-zinc-700 mb-2 text-center">Saúde Operacional</h3>
          <Gauge score={health} />
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-zinc-700 mb-4">Semáforo Executivo</h3>
          {[
            { icon: '📋', name: 'Tarefas', color: overdue === 0 ? GREEN : overdue <= 3 ? AMBER : RED, status: overdue === 0 ? 'Tudo em dia' : `${overdue} atrasadas`, metric: `${todo + doing} abertas` },
            { icon: '💰', name: 'Pipeline', color: pipeTotal > 1000000 ? GREEN : pipeTotal > 500000 ? AMBER : RED, status: pipeTotal > 1000000 ? 'Strong' : pipeTotal > 500000 ? 'Moderate' : 'Baixo', metric: fmtBRL(pipeTotal) },
            { icon: '📍', name: 'Equipe', color: ciPct > 0.7 ? GREEN : ciPct > 0.3 ? AMBER : RED, status: `${Math.round(ciPct * 100)}%`, metric: `${checkins.length}/${profiles.length} check-ins` },
            { icon: '📁', name: 'Projetos', color: activeProjs.length > 0 ? GREEN : AMBER, status: `${activeProjs.length} ativos`, metric: `${data.projects.length} total` },
          ].map(s => (
            <div key={s.name} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg mb-2" style={{ borderLeft: `3px solid ${s.color}` }}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{s.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-zinc-800">{s.name}</p>
                  <p className="text-[10px] text-zinc-500">{s.status}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="w-3 h-3 rounded-full mb-1 ml-auto" style={{ background: s.color }} />
                <p className="text-xs font-semibold text-zinc-700">{s.metric}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-3 flex items-center gap-2">
        <span className="w-5 h-0.5 bg-violet-600 rounded inline-block" />Métricas Operacionais
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Projetos Ativos', value: activeProjs.length, sub: `${data.projects.length} total`, color: AMBER, icon: '📁', to: '/portfolio' },
          { label: 'Pipeline Total', value: fmtBRL(pipeTotal), sub: `${fmtBRL(pipeWeighted)} pond.`, color: GREEN, icon: '💰', to: '/captacao' },
          { label: 'Tarefas Abertas', value: todo + doing, sub: `${done} concluídas`, color: BLUE, icon: '📋', to: '/kanban' },
          { label: 'Vencidas', value: overdue, sub: overdue === 0 ? 'tudo em dia' : 'ação imediata', color: overdue > 0 ? RED : GREEN, icon: overdue > 0 ? '🚨' : '✅', to: '/kanban' },
          { label: 'Check-ins', value: `${checkins.length}/${profiles.length}`, sub: `${Math.round(ciPct * 100)}%`, color: '#8B5CF6', icon: '📍', to: '/time' },
          { label: 'Rotinas Ativas', value: data.routines?.length || 0, sub: 'configuradas', color: '#06B6D4', icon: '⏱️', to: '/rotinas' },
        ].map((k, i) => (
          <div key={i} onClick={() => navigate(k.to)} className="rounded-xl p-4 cursor-pointer hover:opacity-90 transition-all" style={{ background: CH, borderLeft: `4px solid ${k.color}` }}>
            <div className="flex justify-between items-start mb-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{k.label}</p>
              <span className="text-base opacity-80">{k.icon}</span>
            </div>
            <p className="text-xl font-bold text-white">{k.value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── VISÃO OPERACIONAL ── */}
      <div className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-3 flex items-center gap-2">
        <span className="w-5 h-0.5 bg-violet-600 rounded inline-block" />Visão Operacional
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Funil Pipeline */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-zinc-800 mb-4">Funil Pipeline</h3>
          {pipeStages.map((st, i) => (
            <div key={st.id} className="flex items-center gap-3 mb-2">
              <div className="flex-1 rounded-lg px-4 py-3 flex justify-between items-center" style={{ background: `${st.color}18`, borderLeft: `4px solid ${st.color}`, marginLeft: `${i * 5}%`, transition: 'all 0.3s' }}>
                <span className="text-xs font-semibold text-zinc-700">{st.label}</span>
                <div className="text-right">
                  <span className="text-base font-bold" style={{ color: st.color }}>{st.count}</span>
                  <span className="text-xs text-zinc-400 ml-2">{fmtBRL(st.value)}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="mt-3 p-3 rounded-lg flex justify-between" style={{ background: CH }}>
            <div><p className="text-[9px] text-zinc-400 uppercase">Total</p><p className="text-white font-bold text-sm mt-0.5">{fmtBRL(pipeTotal)}</p></div>
            <div className="text-right"><p className="text-[9px] text-zinc-400 uppercase">Ponderado</p><p className="font-bold text-sm mt-0.5" style={{ color: VL }}>{fmtBRL(pipeWeighted)}</p></div>
          </div>
        </div>

        {/* Carga por membro */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-zinc-800 mb-4">Carga por Membro</h3>
          {memberLoadArr.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-6">Sem tarefas atribuídas</p>
          ) : memberLoadArr.slice(0, 7).map(m => {
            const max = memberLoadArr[0].count || 1
            const pct = Math.max(8, m.count / max * 100)
            const color = m.count > 8 ? RED : m.count > 5 ? AMBER : VL
            return (
              <div key={m.name} className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-700">{m.name.split(' ')[0]}</span>
                  <span className="text-xs font-bold" style={{ color }}>{m.count}</span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Atividade recente — usa activity_log se disponível */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-zinc-800 mb-4">Atividade Recente</h3>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-6">Nenhuma atividade</p>
          ) : actLog.length > 0 ? (
            // B-105: mostrar activity_log com ações reais
            actLog.slice(0, 5).map(ev => {
              const actor = data.profMap?.[ev.actor_id]
              const ENTITY_PT = { task: '📋', project: '📁', pipeline_item: '💰', note: '📒', company: '🏢' }
              const icon = ENTITY_PT[ev.entity_type] || '⚡'
              const meta = ev.metadata && typeof ev.metadata === 'object' ? ev.metadata : {}
              const desc = ev.action === 'created' ? `criou ${ev.entity_type === 'task' ? 'tarefa' : ev.entity_type || 'item'}${meta.title ? ` "${meta.title}"` : ''}`
                : ev.action === 'completed' ? `concluiu tarefa${meta.title ? ` "${meta.title}"` : ''}`
                : ev.action === 'moved' ? `moveu para ${meta.to || '?'}`
                : ev.action === 'stage_changed' ? `avançou deal para "${meta.to || '?'}"`
                : ev.action || 'ação'
              return (
                <div key={ev.id} className="border-b border-zinc-50 pb-2 mb-2 last:border-0 flex items-start gap-2">
                  <span className="text-base mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-800 truncate">
                      <span className="font-semibold">{actor?.full_name?.split(' ')[0] || '—'}</span> {desc}
                    </p>
                    <span className="text-[10px] text-zinc-400">{relTime(ev.created_at)}</span>
                  </div>
                </div>
              )
            })
          ) : (
            // Fallback: tasks recentes
            recentActivity.map(t => {
              const sColor = t.column_id === 'done' ? GREEN : t.column_id === 'doing' ? BLUE : AMBER
              const sLabel = t.column_id === 'done' ? 'Concluído' : t.column_id === 'doing' ? 'Executando' : 'A Fazer'
              return (
                <div key={t.id} className="border-b border-zinc-50 pb-2 mb-2 last:border-0">
                  <p className="text-xs font-medium text-zinc-800 truncate mb-1">{(t.title || 'Sem título').slice(0, 45)}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${sColor}18`, color: sColor }}>{sLabel}</span>
                    <span className="text-[10px] text-zinc-400">{relTime(t.updated_at)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── VENCENDO EM BREVE ── */}
      {dueSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
              ⏰ Vencendo Hoje / Amanhã
            </h3>
            <button onClick={() => navigate('/kanban')} className="text-xs font-semibold text-amber-700 hover:text-amber-900">Ver no Kanban →</button>
          </div>
          <div className="space-y-2">
            {dueSoon.map(t => {
              const due = new Date(t.due_date)
              const isToday = due.toDateString() === new Date().toDateString()
              const assignee = data.profMap?.[t.assigned_to]
              return (
                <div key={t.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-amber-100">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isToday ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {isToday ? 'HOJE' : 'AMANHÃ'}
                  </span>
                  <span className="text-xs font-semibold text-zinc-800 truncate flex-1">{t.title || '—'}</span>
                  {assignee && (
                    <div className="w-6 h-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                      style={{ background: assignee.avatar_color || '#5452C1' }}
                      title={assignee.full_name}>
                      {assignee.initials || assignee.full_name?.slice(0, 2)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── PROJETOS ── */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-zinc-800">Saúde dos Projetos</h3>
          <button onClick={() => navigate('/portfolio')} className="text-xs font-semibold text-violet-600 hover:text-violet-700">Ver Portfolio →</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeProjs.slice(0, 6).map(p => {
            const projTasks = data.tasks.filter(t => t.project_id === p.id)
            const projDone = projTasks.filter(t => t.column_id === 'done').length
            const projOverdue = projTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.column_id !== 'done').length
            const pct = projTasks.length > 0 ? Math.round(projDone / projTasks.length * 100) : 0
            const hColor = projOverdue > 2 ? RED : projOverdue > 0 ? AMBER : GREEN
            const hIcon = projOverdue > 2 ? '🔴' : projOverdue > 0 ? '🟡' : '🟢'
            return (
              <div key={p.id} className="p-3 border border-zinc-100 rounded-xl" style={{ borderLeft: `4px solid ${hColor}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{hIcon}</span>
                    <span className="text-xs font-bold text-zinc-800 truncate max-w-[140px]">{p.name}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${hColor}18`, color: hColor }}>{pct}%</span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: hColor }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
