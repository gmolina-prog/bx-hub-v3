import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import { Search, X, FileText, Kanban, AlertCircle, Building2, Target, FolderOpen } from 'lucide-react'

const VL = '#5452C1'

const RESULT_TYPES = {
  task:          { label: 'Tarefa',    icon: Kanban,       color: '#5452C1', path: '/kanban'   },
  project:       { label: 'Projeto',   icon: FolderOpen,   color: '#10B981', path: '/timeline' },
  deal:          { label: 'Pipeline',  icon: Target,       color: '#F59E0B', path: '/captacao' },
  risk:          { label: 'Risco',     icon: AlertCircle,  color: '#EF4444', path: '/riscos'   },
  company:       { label: 'Empresa',   icon: Building2,    color: '#6B7280', path: '/cadastro' },
  note:          { label: 'Nota',      icon: FileText,     color: '#8B5CF6', path: '/notas'    },
}

export default function GlobalSearch({ onClose }) {
  const { profile } = useData()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const search = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const orgId = profile.org_id
      const [tasksR, projR, dealsR, risksR, compR, notesR] = await Promise.allSettled([
        supabase.from('tasks').select('id,title,column_id,priority').eq('org_id', orgId).or(`title.ilike.%${q}%,description.ilike.%${q}%`).is('deleted_at', null).limit(5),
        supabase.from('projects').select('id,name,type,status').eq('org_id', orgId).or(`name.ilike.%${q}%,type.ilike.%${q}%,status.ilike.%${q}%`).limit(5),
        supabase.from('pipeline_items').select('id,name,stage').eq('org_id', orgId).ilike('name', `%${q}%`).eq('is_archived', false).limit(5),
        supabase.from('risks').select('id,name,status').eq('org_id', orgId).ilike('name', `%${q}%`).limit(5),
        supabase.from('companies').select('id,name,segment').eq('org_id', orgId).or(`name.ilike.%${q}%,segment.ilike.%${q}%,trading_name.ilike.%${q}%`).limit(5),
        supabase.from('notes').select('id,title,status').eq('org_id', orgId).ilike('title', `%${q}%`).neq('status','archived').limit(5),
      ])

      const all = []
      const add = (res, type, labelFn, subFn) => {
        if (res.status === 'fulfilled' && !res.value.error) {
          ;(res.value.data || []).forEach(r => all.push({ type, id: r.id, label: labelFn(r), sub: subFn(r) }))
        }
      }
      add(tasksR,  'task',    r => r.title, r => `${({todo:'A Fazer',doing:'Executando',review:'Revisão',done:'Concluído'})[r.column_id] || r.column_id} · ${r.priority || ''}`)
      add(projR,   'project', r => r.name,  r => `${r.type || 'Projeto'} · ${r.status}`)
      add(dealsR,  'deal',    r => r.name,  r => r.stage || '')
      add(risksR,  'risk',    r => r.name,  r => r.status || '')
      add(compR,   'company', r => r.name,  r => r.segment || '')
      add(notesR,  'note',    r => r.title, r => 'Nota')

      setResults(all)
      setSelected(0)
    } catch (err) {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  function goTo(result) {
    navigate(RESULT_TYPES[result.type]?.path || '/')
    onClose()
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) goTo(results[selected])
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none bg-transparent"
            placeholder="Buscar tarefas, projetos, deals, riscos, empresas…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          {query && <button onClick={() => setQuery('')} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>}
          <kbd className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Resultados */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-xs text-zinc-400">Buscando…</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-400">Nenhum resultado para "{query}"</div>
          )}
          {!loading && query.length < 2 && (
            <div className="p-6 text-center">
              <Search className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">Digite 2+ caracteres para buscar</p>
              <div className="flex gap-2 justify-center mt-3 flex-wrap">
                {Object.entries(RESULT_TYPES).map(([k, v]) => {
                  const Icon = v.icon
                  return (
                    <span key={k} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-zinc-50 text-zinc-500">
                      <Icon className="w-3 h-3" style={{ color: v.color }} />{v.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
          {results.map((r, i) => {
            const T = RESULT_TYPES[r.type]
            const Icon = T.icon
            return (
              <button key={`${r.type}-${r.id}`}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i === selected ? 'bg-violet-50' : 'hover:bg-zinc-50'}`}
                onClick={() => goTo(r)}
                onMouseEnter={() => setSelected(i)}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: T.color + '18' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: T.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-zinc-800 truncate">{r.label}</div>
                  {r.sub && <div className="text-[10px] text-zinc-400 truncate">{r.sub}</div>}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: T.color + '18', color: T.color }}>
                  {T.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="border-t border-zinc-100 px-4 py-2 flex items-center gap-3 text-[10px] text-zinc-400">
            <span>↑↓ navegar</span>
            <span>↵ abrir módulo</span>
            <span>ESC fechar</span>
            <span className="ml-auto">{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
