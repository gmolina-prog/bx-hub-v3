import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import {
  FileText,
  Search,
  Filter,
  Activity,
  Clock,
  User,
  RefreshCw,
  Download,
  AlertCircle,
} from 'lucide-react'

// ============================================================================
// Logs.jsx v2 — Log de Atividades / Auditoria
// ----------------------------------------------------------------------------
// Le da tabela `activity_log` que JA EXISTE e tem ~33 eventos populados.
//
// Schema real validado em producao:
//   id          uuid
//   org_id      uuid
//   entity_type text   (ex: 'task')
//   entity_id   uuid
//   actor_id    uuid   (FK profiles.id)
//   action      text   (ex: "Movido para backlog", "Movido para doing")
//   metadata    jsonb
//   created_at  timestamptz
//   module      text   (NULL nos eventos atuais — tratado opcional)
//   details     text
//   project_id  uuid
//
// Como o action e texto livre, usamos heuristicas pra colorir e categorizar.
// ============================================================================

const PERIODS = [
  { value: '24h', label: 'Últimas 24h', hours: 24 },
  { value: '7d', label: 'Últimos 7 dias', hours: 24 * 7 },
  { value: '30d', label: 'Últimos 30 dias', hours: 24 * 30 },
  { value: 'today', label: 'Hoje', hours: null },
  { value: 'all', label: 'Tudo', hours: null },
]

function categorize(ev) {
  const action = (ev.action || '').toLowerCase()
  if (action.includes('moveu') || action.includes('movido')) return 'move'
  if (action.includes('cri') || action.includes('add') || action.includes('inser')) return 'create'
  if (action.includes('edit') || action.includes('atual') || action.includes('updat')) return 'edit'
  if (action.includes('exclu') || action.includes('delet') || action.includes('remov') || action.includes('arquiv')) return 'delete'
  if (action.includes('aprov') || action.includes('approve')) return 'approve'
  if (action.includes('login') || action.includes('access') || action.includes('aces')) return 'access'
  if (action.includes('falh') || action.includes('error') || action.includes('crit')) return 'critical'
  if (action.includes('alert') || action.includes('warn') || action.includes('aviso')) return 'alert'
  return 'other'
}

const CATEGORY_META = {
  move:     { label: 'Movimentação', color: 'text-violet-700', bg: 'bg-violet-50', dot: 'bg-violet-500' },
  create:   { label: 'Criação',      color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  edit:     { label: 'Edição',       color: 'text-sky-700', bg: 'bg-sky-50', dot: 'bg-sky-500' },
  delete:   { label: 'Exclusão',     color: 'text-rose-700', bg: 'bg-rose-50', dot: 'bg-rose-500' },
  approve:  { label: 'Aprovação',    color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  access:   { label: 'Acesso',       color: 'text-zinc-700', bg: 'bg-zinc-50', dot: 'bg-zinc-500' },
  alert:    { label: 'Alerta',       color: 'text-amber-800', bg: 'bg-amber-100', dot: 'bg-amber-600' },
  critical: { label: 'Crítico',      color: 'text-white',     bg: 'bg-rose-600',  dot: 'bg-rose-700' },
  other:    { label: 'Outro',        color: 'text-zinc-600', bg: 'bg-zinc-100', dot: 'bg-zinc-400' },
}

export default function Logs() {
  const { profile } = useData()
  const [events, setEvents] = useState([])
  const [profilesMap, setProfilesMap] = useState(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [actorId, setActorId] = useState('all')
  const [entityType, setEntityType] = useState('all')
  const [period, setPeriod] = useState('all')

  useEffect(() => {
    if (profile?.org_id) {
      loadProfiles()
      loadEvents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id, period])

  async function loadProfiles() {
    try {
      const { data, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, initials, avatar_color')
        .eq('org_id', profile?.org_id)
      if (pErr) throw pErr
      const m = new Map()
      ;(data || []).forEach(p => m.set(p.id, p))
      setProfilesMap(m)
    } catch (err) {
      console.warn('Could not load profiles for log mapping:', err.message)
    }
  }

  async function loadEvents() {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('activity_log')
        .select('*')
        .eq('org_id', profile?.org_id)
        .order('created_at', { ascending: false })
        .limit(500)

      const p = PERIODS.find(x => x.value === period)
      if (p && p.value !== 'all') {
        let cutoff
        if (p.value === 'today') {
          const d = new Date()
          d.setHours(0, 0, 0, 0)
          cutoff = d.toISOString()
        } else if (p.hours) {
          cutoff = new Date(Date.now() - p.hours * 3600 * 1000).toISOString()
        }
        if (cutoff) query = query.gte('created_at', cutoff)
      }

      const { data, error: qErr } = await query
      if (qErr) throw qErr
      setEvents(data || [])
    } catch (err) {
      console.error('Error loading activity_log:', err)
      setError(err.message || 'Erro ao carregar log')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return events.filter(ev => {
      if (category !== 'all' && categorize(ev) !== category) return false
      if (actorId !== 'all' && ev.actor_id !== actorId) return false
      if (entityType !== 'all' && ev.entity_type !== entityType) return false
      if (search) {
        const s = search.toLowerCase()
        const hay = `${ev.action || ''} ${ev.details || ''} ${ev.entity_type || ''} ${ev.module || ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [events, category, actorId, entityType, search])

  const kpis = useMemo(() => {
    const uniqueActors = new Set(filtered.map(e => e.actor_id).filter(Boolean)).size
    const byHour = {}
    filtered.forEach(e => {
      if (!e.created_at) return
      const h = new Date(e.created_at).getHours()
      byHour[h] = (byHour[h] || 0) + 1
    })
    const peakEntry = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]
    const cats = filtered.map(categorize)
    const criticals = cats.filter(c => c === 'critical').length
    const alerts = cats.filter(c => c === 'alert').length
    return {
      total: filtered.length,
      actors: uniqueActors,
      peak: peakEntry ? `${peakEntry[0]}h` : '—',
      criticals,
      alerts,
      byHour,
    }
  }, [filtered])

  const byCategory = useMemo(() => {
    const dist = {}
    filtered.forEach(e => {
      const c = categorize(e)
      dist[c] = (dist[c] || 0) + 1
    })
    return dist
  }, [filtered])

  const uniqueActors = useMemo(() => {
    const m = new Map()
    events.forEach(e => {
      if (e.actor_id && !m.has(e.actor_id)) {
        const p = profilesMap.get(e.actor_id)
        m.set(e.actor_id, p?.full_name || e.actor_id.substring(0, 8))
      }
    })
    return Array.from(m.entries())
  }, [events, profilesMap])

  const uniqueEntityTypes = useMemo(() => {
    const s = new Set()
    events.forEach(e => { if (e.entity_type) s.add(e.entity_type) })
    return Array.from(s)
  }, [events])

  function formatTime(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return '—'
    }
  }

  function formatFullDate(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('pt-BR') + ' ' + new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '—'
    }
  }

  function exportCSV() {
    const header = ['Data', 'Hora', 'Categoria', 'Usuário', 'Tipo', 'Ação', 'Módulo']
    const rows = filtered.map(e => {
      const cat = categorize(e)
      const p = profilesMap.get(e.actor_id)
      return [
        new Date(e.created_at).toLocaleDateString('pt-BR'),
        formatTime(e.created_at),
        CATEGORY_META[cat]?.label || cat,
        p?.full_name || '—',
        e.entity_type || '',
        (e.action || '').replace(/"/g, '""'),
        e.module || '',
      ]
    })
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bx-activity-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1">
              Auditoria e monitoramento
            </div>
            <h1 className="text-2xl font-bold mb-1">Log de atividades</h1>
            <p className="text-sm text-zinc-300">
              {kpis.total} eventos · {kpis.actors} usuários ativos
              {kpis.alerts > 0 && ` · ${kpis.alerts} alertas`}
              {kpis.criticals > 0 && ` · ${kpis.criticals} críticos`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadEvents}
              disabled={loading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Eventos" value={kpis.total} accent="violet" />
          <Kpi label="Usuários" value={kpis.actors} accent="emerald" />
          <Kpi label="Pico do dia" value={kpis.peak} accent="sky" />
          <Kpi label="Alertas" value={kpis.alerts} accent="amber" />
          <Kpi label="Críticos" value={kpis.criticals} accent="rose" />
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-rose-900">
            <div className="font-bold">Não foi possível carregar o log</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
          <Filter className="w-3 h-3" />
          Filtros
          <span className="ml-auto text-zinc-400 normal-case font-semibold">
            {filtered.length} resultados
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar evento, ação, descrição…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none bg-white"
          >
            <option value="all">Todas categorias</option>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none bg-white"
          >
            <option value="all">Todos usuários</option>
            {uniqueActors.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none bg-white"
          >
            {PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {uniqueEntityTypes.length > 1 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Entidade:</span>
            <button
              onClick={() => setEntityType('all')}
              className={`text-xs px-2 py-1 rounded-full font-semibold ${
                entityType === 'all' ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Tudo
            </button>
            {uniqueEntityTypes.map(et => (
              <button
                key={et}
                onClick={() => setEntityType(et)}
                className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  entityType === et ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {et}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-600" />
              Eventos por hora
            </h2>
            <span className="text-xs text-zinc-400 font-semibold">período atual</span>
          </div>
          <HourlyChart byHour={kpis.byHour} />
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-600" />
              Distribuição por categoria
            </h2>
            <span className="text-xs text-zinc-400 font-semibold">
              {Object.keys(byCategory).length} categorias
            </span>
          </div>
          <div className="space-y-3">
            {Object.entries(CATEGORY_META).map(([key, meta]) => {
              const count = byCategory[key] || 0
              if (count === 0) return null
              const pct = kpis.total > 0 ? (count / kpis.total) * 100 : 0
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-2 text-zinc-700 font-semibold">
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    <span className="font-bold text-zinc-900">{count}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className={meta.dot} style={{ width: `${pct}%`, height: '100%' }} />
                  </div>
                </div>
              )
            })}
            {Object.keys(byCategory).length === 0 && (
              <div className="text-xs text-zinc-400 text-center py-4">Nenhum evento no período</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-600" />
            Eventos recentes
          </h2>
          <span className="text-xs text-zinc-500 font-semibold">
            {filtered.length} {filtered.length === 1 ? 'evento' : 'eventos'}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2" />
            Carregando eventos…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <div className="text-sm font-semibold text-zinc-700">Nenhum evento no período</div>
            <div className="text-xs text-zinc-500 mt-1">
              {events.length === 0
                ? 'A tabela activity_log está vazia para esta organização.'
                : 'Tente ajustar os filtros.'}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.slice(0, 100).map(ev => {
              const cat = categorize(ev)
              const meta = CATEGORY_META[cat]
              const p = profilesMap.get(ev.actor_id)
              const userInitials = p?.initials || (p?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
              return (
                <div
                  key={ev.id}
                  className="px-5 py-3 hover:bg-zinc-50 transition-colors grid grid-cols-[110px_120px_1fr_180px_90px] gap-3 items-center text-sm"
                >
                  <div className="font-mono text-xs text-zinc-600" title={formatFullDate(ev.created_at)}>
                    {formatTime(ev.created_at)}
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} uppercase tracking-wide`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-zinc-800 truncate" title={ev.action}>
                    {ev.action || <span className="text-zinc-400 italic">sem descrição</span>}
                    {ev.details && (
                      <span className="text-xs text-zinc-500 ml-2">· {ev.details}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-600 truncate">
                    {p?.avatar_color ? (
                      <div
                        className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                        style={{ background: p.avatar_color }}
                      >
                        {userInitials}
                      </div>
                    ) : (
                      <User className="w-3 h-3 flex-shrink-0" />
                    )}
                    <span className="truncate">{p?.full_name || (ev.actor_id ? ev.actor_id.substring(0, 8) : '—')}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold text-right">
                    {ev.entity_type || '—'}
                  </div>
                </div>
              )
            })}
            {filtered.length > 100 && (
              <div className="px-5 py-4 text-center text-xs text-zinc-500 bg-zinc-50">
                Mostrando 100 de {filtered.length} eventos. Exporte para ver todos.
              </div>
            )}
          </div>
        )}
      </div>
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

function HourlyChart({ byHour }) {
  const max = Math.max(1, ...Object.values(byHour))
  const hours = Array.from({ length: 24 }, (_, i) => i)
  return (
    <div>
      <div className="flex items-end gap-1 h-28">
        {hours.map(h => {
          const v = byHour[h] || 0
          const pct = (v / max) * 100
          return (
            <div
              key={h}
              className="flex-1 bg-violet-200 hover:bg-violet-400 rounded-t transition-all relative group"
              style={{ height: `${Math.max(pct, 2)}%` }}
              title={`${h}h: ${v} eventos`}
            >
              {v > 0 && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  {v}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-zinc-400 font-semibold mt-2">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  )
}
