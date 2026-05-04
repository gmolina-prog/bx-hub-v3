import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, Save, Trash2, Search, AlertCircle, Check, Clock, User, FolderOpen, Flag, MessageSquare, CheckSquare, MoreHorizontal, Archive, RefreshCw, Edit3, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { isLeaderRole } from '../lib/roles'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'

const VL = '#5452C1'

// ─── 5 Colunas de processo ────────────────────────────────────────────────────
const COLS = [
  { id: 'backlog',  label: 'Backlog',       color: '#94A3B8', bg: '#F8FAFC', emoji: '📋' },
  { id: 'todo',     label: 'A Fazer',        color: '#9CA3AF', bg: '#F9FAFB', emoji: '📌' },
  { id: 'doing',    label: 'Em Andamento',   color: '#5452C1', bg: '#EEF2FF', emoji: '⚡' },
  { id: 'review',   label: 'Em Revisão',     color: '#F59E0B', bg: '#FFFBEB', emoji: '🔍' },
  { id: 'done',     label: 'Concluído',      color: '#10B981', bg: '#ECFDF5', emoji: '✅' },
]

const PRIORITY = {
  urgent: { label: 'Urgente', color: '#DC2626', bg: '#FEE2E2' },
  high:   { label: 'Alta',    color: '#F59E0B', bg: '#FEF3C7' },
  medium: { label: 'Média',   color: '#3B82F6', bg: '#EFF6FF' },
  low:    { label: 'Baixa',   color: '#94A3B8', bg: '#F8FAFC' },
}

// ─── Semáforo de carga ────────────────────────────────────────────────────────
function getSemaforo(count) {
  if (count <= 2) return { color: '#10B981', bg: '#ECFDF5', label: 'Livre',         dot: '🟢' }
  if (count <= 5) return { color: '#F59E0B', bg: '#FFFBEB', label: 'Moderado',      dot: '🟡' }
  if (count <= 8) return { color: '#EF4444', bg: '#FEF2F2', label: 'Sobrecarregado', dot: '🔴' }
  return               { color: '#7C3AED', bg: '#F5F3FF', label: 'Crítico',         dot: '🚨' }
}

function SemaforoCarga({ tasks, profiles, filterAssignee, onFilter }) {
  const active = tasks.filter(t => t.column_id !== 'done' && t.column_id !== 'backlog')
  const byMember = {}
  active.forEach(t => {
    if (!t.assigned_to) return
    byMember[t.assigned_to] = (byMember[t.assigned_to] || 0) + 1
  })

  // Apoio: tasks where member is collaborator
  const apoioByMember = {}
  active.forEach(t => {
    const collabs = Array.isArray(t.custom_field_values?.collaborators) ? t.custom_field_values.collaborators : []
    collabs.forEach(uid => {
      if (!apoioByMember[uid]) apoioByMember[uid] = []
      apoioByMember[uid].push(t)
    })
  })

  const [expandedMembers, setExpandedMembers] = React.useState({})

  if (!profiles.length) return null

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-600" />
          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Semáforo de Carga</span>
        </div>
        <span className="text-[10px] text-zinc-400">{active.length} tarefas ativas</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {profiles.map(p => {
          const count = byMember[p.id] || 0
          const apoioTasks = apoioByMember[p.id] || []
          const sem = getSemaforo(count)
          const isFiltered = filterAssignee === p.id
          const isExpanded = expandedMembers[p.id]
          const hasApoio = apoioTasks.length > 0

          return (
            <div key={p.id} className={`rounded-xl border transition-all ${isFiltered ? 'ring-2 ring-violet-500 ring-offset-1' : ''}`}
              style={{ background: sem.bg, borderColor: sem.color + '44' }}>
              {/* Card principal do membro */}
              <button
                onClick={() => onFilter(isFiltered ? 'all' : p.id)}
                className="flex items-center gap-2 px-3 py-1.5 text-left w-full">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: p.avatar_color || VL }}>
                  {(p.initials || p.full_name?.slice(0,2) || '??').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-zinc-700 truncate max-w-[80px]">
                    {p.full_name?.split(' ')[0]}
                  </div>
                  <div className="text-[9px] font-semibold" style={{ color: sem.color }}>
                    {count} tarefa{count !== 1 ? 's' : ''} · {sem.label}
                  </div>
                </div>
                <div className="text-sm shrink-0">{sem.dot}</div>
                {/* Badge apoio + toggle */}
                {hasApoio && (
                  <button
                    onClick={e => { e.stopPropagation(); setExpandedMembers(prev => ({...prev, [p.id]: !prev[p.id]})) }}
                    className="flex items-center gap-1 ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border transition-all hover:opacity-80"
                    style={{ background: 'white', color: VL, borderColor: VL + '44' }}
                    title={`${apoioTasks.length} tarefa${apoioTasks.length>1?'s':''} de apoio`}>
                    <span>apoio {apoioTasks.length}</span>
                    <span style={{ fontSize: 8 }}>{isExpanded ? '▲' : '▼'}</span>
                  </button>
                )}
              </button>

              {/* Apoio tasks expandido */}
              {hasApoio && isExpanded && (
                <div className="border-t px-3 py-2 space-y-1.5" style={{ borderColor: sem.color + '33', background: 'rgba(255,255,255,0.6)' }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: sem.color }}>
                    Apoio / Colaborador
                  </div>
                  {apoioTasks.map(t => {
                    const pr = PRIORITY[t.priority] || PRIORITY.medium
                    const colLabel = COLS.find(c => c.id === t.column_id)?.label || t.column_id
                    return (
                      <div key={t.id} className="flex items-start gap-1.5 bg-white rounded-lg px-2 py-1.5 border border-zinc-100">
                        <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: pr.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-semibold text-zinc-700 truncate">{t.title}</div>
                          <div className="text-[9px] text-zinc-400">{colLabel}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── % por projeto no header ──────────────────────────────────────────────────
function ProjectProgress({ tasks, projects, colId }) {
  if (colId !== 'doing' && colId !== 'review') return null
  const withProject = tasks.filter(t => t.project_id)
  if (!withProject.length) return null

  const projIds = [...new Set(withProject.map(t => t.project_id))]
  const items = projIds.map(pid => {
    const proj = projects.find(p => p.id === pid)
    const projTasks = tasks.filter(t => t.project_id === pid)
    const done = tasks.filter(t => t.project_id === pid && t.column_id === 'done').length
    const total = tasks.filter(t => t.project_id === pid).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { pid, name: proj?.name, pct, colCount: projTasks.length }
  }).filter(i => i.colCount > 0)

  if (!items.length) return null

  return (
    <div className="mt-2 space-y-1">
      {items.slice(0, 3).map(i => (
        <div key={i.pid} className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-500 truncate flex-1 max-w-[100px]">{i.name}</span>
          <div className="flex-1 h-1 bg-zinc-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${i.pct}%`, background: i.pct === 100 ? '#10B981' : VL }} />
          </div>
          <span className="text-[9px] font-bold shrink-0"
            style={{ color: i.pct === 100 ? '#10B981' : VL }}>{i.pct}%</span>
        </div>
      ))}
    </div>
  )
}

// ─── TaskModal ────────────────────────────────────────────────────────────────
function TaskModal({ task, projects, profiles, allTasks, onClose, onSave, onDelete, onArchive }) {
  const { profile } = useData()

  const [form, setForm] = useState({
    title:        task.title        || '',
    description:  task.description  || '',
    priority:     task.priority     || 'medium',
    column_id:    task.column_id    || 'todo',
    assigned_to:  task.assigned_to  || '',
    project_id:   task.project_id   || '',
    due_date:     task.due_date ? task.due_date.split('T')[0] : '',
    is_emergency: task.is_emergency || false,
    is_starred:   task.is_starred   || false,
    tags:         Array.isArray(task.tags) ? task.tags : [],
    cover_color:  task.cover_color  || '',
    collaborators: Array.isArray(task.custom_field_values?.collaborators)
                   ? task.custom_field_values.collaborators : [],
    next_action:  task.next_action  || '',
    waiting_for:  task.waiting_for  || '',
    client_impact: task.client_impact || false,
  })

  const [subtasks,        setSubtasks]        = useState(Array.isArray(task.checklist) ? task.checklist : [])
  const [newSubtask,      setNewSubtask]       = useState('')
  const [comments,        setComments]         = useState([])
  const [newComment,      setNewComment]       = useState('')
  const [loadingComments, setLoadingComments]  = useState(false)
  const [commentTab,      setCommentTab]       = useState('comments') // 'comments' | 'history'
  const [saving,          setSaving]           = useState(false)
  const commentsEndRef  = useRef(null)
  const titleRef        = useRef(null)
  const commentInputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 60)
    if (!task.id || task.id === 'new') return
    setLoadingComments(true)
    supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at')
      .then(({ data }) => { setComments(data || []); setLoadingComments(false) })
      .catch(() => setLoadingComments(false))
  }, [task.id])

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments.length])

  const doneSubtasks = subtasks.filter(s => s.done).length
  const subPct = subtasks.length > 0 ? Math.round(doneSubtasks / subtasks.length * 100) : 0
  const accentColor = form.is_emergency ? '#DC2626' : (form.cover_color || VL)
  const proj = projects.find(p => p.id === form.project_id)

  // Prazo
  const today = new Date(); today.setHours(0,0,0,0)
  const dueDate = form.due_date ? new Date(form.due_date) : null
  const daysLeft = dueDate ? Math.ceil((dueDate - today) / 86400000) : null
  const isOverdue = daysLeft !== null && daysLeft < 0 && form.column_id !== 'done'
  const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && form.column_id !== 'done'

  function toggleSubtask(i) { setSubtasks(prev => prev.map((s,j) => j===i ? {...s,done:!s.done} : s)) }
  function addSubtask() {
    if (!newSubtask.trim()) return
    setSubtasks(prev => [...prev, { id: Date.now().toString(), text: newSubtask.trim(), done: false, assigned_to: null, due_date: null }])
    setNewSubtask('')
  }
  function removeSubtask(i) { setSubtasks(prev => prev.filter((_,j) => j!==i)) }

  async function addComment() {
    if (!newComment.trim() || !task.id || task.id === 'new') return
    const trimmed = newComment.trim()
    setNewComment('')
    const { data, error } = await supabase.from('task_comments').insert({
      task_id: task.id, org_id: profile.org_id,
      user_id: profile.id, user_name: profile.full_name,
      content: trimmed, type: 'comment',
    }).select().single()
    if (!error && data) setComments(prev => [...prev, data])
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const { _newTag: _nt, ...cleanForm } = form
    await onSave({ ...cleanForm, checklist: subtasks, id: task.id,
      _prevEmergency: task.is_emergency, _prevAssignedTo: task.assigned_to })
    setSaving(false)
  }

  // Agrupar comentários por data
  function groupByDate(comments) {
    const groups = []
    let lastDate = null
    comments.forEach(cm => {
      const d = new Date(cm.created_at)
      const today = new Date(); today.setHours(0,0,0,0)
      const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
      let label = d >= today ? 'Hoje' : d >= yesterday ? 'Ontem' : d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})
      if (label !== lastDate) { groups.push({ type:'divider', label }); lastDate = label }
      groups.push({ type:'comment', ...cm })
    })
    return groups
  }

  const grouped = groupByDate(comments)

  // Assigned profile
  const assignedProf = profiles.find(p => p.id === form.assigned_to)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,16,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 'min(98vw, 1240px)', maxWidth: 1240, height: '88vh', borderTop: `3px solid ${accentColor}` }}>

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div className="shrink-0 px-7 pt-5 pb-5 border-b border-zinc-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">

              {/* Linha 1: breadcrumb — só projeto */}
              {proj && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accentColor }} />
                  <span className="text-xs text-zinc-400 font-medium">{proj.name}</span>
                </div>
              )}

              {/* Linha 2: título grande */}
              <textarea ref={titleRef} rows={2}
                className="w-full text-2xl font-bold text-zinc-800 resize-none border-0 outline-none placeholder:text-zinc-300 leading-snug mb-2"
                placeholder="Título da tarefa…"
                value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} />

              {/* Linha 3: descrição itálica */}
              <textarea rows={2}
                className="w-full text-sm italic text-zinc-400 resize-none border-0 outline-none placeholder:text-zinc-300 leading-relaxed mb-4"
                placeholder="Descrição, contexto, links…"
                value={form.description || ''} onChange={e => setForm(p => ({...p, description: e.target.value}))} />

              {/* Linha 4: seletores em pills — separados do breadcrumb */}
              <div className="flex items-center gap-2 flex-wrap">
                <select className="text-xs font-bold px-3 py-1.5 rounded-full border-0 outline-none cursor-pointer"
                  style={{ background: PRIORITY[form.priority]?.bg, color: PRIORITY[form.priority]?.color }}
                  value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))}>
                  {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className="text-xs font-bold px-3 py-1.5 rounded-full border border-zinc-200 outline-none cursor-pointer bg-white text-zinc-600"
                  value={form.column_id} onChange={e => setForm(p => ({...p, column_id: e.target.value}))}>
                  {COLS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
                <button onClick={() => setForm(p => ({...p, is_emergency: !p.is_emergency}))}
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${form.is_emergency ? 'bg-red-50 border-red-300 text-red-700' : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all ${form.is_emergency ? 'bg-red-500 border-red-500' : 'border-zinc-300 bg-white'}`}>
                    {form.is_emergency && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  Emergência
                </button>
                <button onClick={() => setForm(p => ({...p, is_starred: !p.is_starred}))}
                  className={`text-xl px-1 leading-none ${form.is_starred ? 'text-amber-400' : 'text-zinc-300 hover:text-amber-400'}`}>
                  {form.is_starred ? '★' : '☆'}
                </button>
              </div>
            </div>

            {/* Botões topo direito */}
            <div className="flex items-center gap-1.5 shrink-0">
              {task.id !== 'new' && <>
                <button onClick={() => onArchive?.(task.id)} title="Arquivar"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-amber-500 border border-zinc-200 hover:border-amber-200 transition-colors">
                  <Archive className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(task.id)} title="Excluir"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 border border-zinc-200 hover:border-red-200 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>}
              <button onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 border border-zinc-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── CORPO: 3 colunas ───────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* COL 1: Checklist + Próxima ação */}
          <div className="shrink-0 border-r border-zinc-100 bg-zinc-50/40 flex flex-col overflow-hidden" style={{width: 276}}>
            <div className="flex-1 overflow-y-auto px-5 pt-5 pb-2">

              {/* Checklist header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Checklist</span>
                {subtasks.length > 0 && <span className="text-[10px] font-semibold shrink-0" style={{ color: subPct===100?'#10B981':accentColor }}>{doneSubtasks}/{subtasks.length}</span>}
              </div>
              {subtasks.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width:`${subPct}%`, background: subPct===100?'#10B981':accentColor }} />
                  </div>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: subPct===100?'#10B981':accentColor }}>{subPct}%</span>
                </div>
              )}

              {/* Items */}
              <div className="space-y-0.5 mb-3">
                {subtasks.map((s,i) => (
                  <div key={i} className="flex flex-col gap-0.5 group py-1.5 rounded-lg hover:bg-white/70 px-1 -mx-1">
                    <div className="flex items-start gap-2">
                      <button onClick={() => toggleSubtask(i)}
                        className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                        style={s.done ? {background:accentColor,borderColor:accentColor} : {borderColor:'#D1D5DB',background:'white'}}>
                        {s.done && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </button>
                      <span className={`text-xs flex-1 leading-snug select-none ${s.done?'line-through text-zinc-400':'text-zinc-700'}`}>{s.text}</span>
                      <button onClick={() => removeSubtask(i)}
                        className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-zinc-300 hover:text-red-500 shrink-0 text-sm leading-none">×</button>
                    </div>
                    {/* Responsável + Prazo por subtarefa */}
                    <div className="flex items-center gap-2 pl-6">
                      <select className="text-[10px] text-zinc-400 border border-zinc-100 rounded px-1 py-0.5 bg-transparent focus:outline-none focus:border-violet-400 cursor-pointer"
                        value={s.assigned_to || ''}
                        onChange={e => setSubtasks(prev => prev.map((st,idx) => idx===i ? {...st, assigned_to: e.target.value||null} : st))}>
                        <option value="">+ Responsável</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name?.split(' ')[0]}</option>)}
                      </select>
                      <input type="date" className="text-[10px] text-zinc-400 border border-zinc-100 rounded px-1 py-0.5 bg-transparent focus:outline-none focus:border-violet-400 cursor-pointer"
                        value={s.due_date || ''}
                        onChange={e => setSubtasks(prev => prev.map((st,idx) => idx===i ? {...st, due_date: e.target.value||null} : st))} />
                    </div>
                  </div>
                ))}
                {subtasks.length === 0 && <p className="text-xs text-zinc-400 italic py-1">Sem itens ainda.</p>}
              </div>

              {/* Próxima ação */}
              <div className="border-t border-zinc-200 pt-3">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Próxima ação</div>
                <textarea rows={3}
                  className="w-full text-xs border-0 border-l-2 bg-violet-50 px-2.5 py-2 focus:outline-none resize-none placeholder:text-zinc-400 text-zinc-700 rounded-r-lg"
                  style={{ borderLeftColor: accentColor }}
                  placeholder="O que precisa acontecer agora…"
                  value={form.next_action || ''} onChange={e => setForm(p => ({...p, next_action: e.target.value}))} />
              </div>
            </div>

            {/* Input novo item */}
            <div className="shrink-0 px-5 py-3 border-t border-zinc-200 bg-white">
              <div className="flex gap-1.5">
                <input className="flex-1 text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500 placeholder:text-zinc-300 bg-white"
                  placeholder="Novo item… (Enter)" value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); addSubtask() }}} />
                <button onClick={addSubtask} disabled={!newSubtask.trim()}
                  className="px-2 py-1.5 text-xs font-semibold text-zinc-500 bg-white border border-zinc-200 rounded-lg hover:border-violet-400 hover:text-violet-600 disabled:opacity-40">+</button>
              </div>
            </div>
          </div>

          {/* COL 2: Comentários expandidos */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

            {/* Aba header */}
            <div className="shrink-0 px-5 py-2 border-b border-zinc-100 bg-zinc-50/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Discussão</span>
                {comments.length > 0 && (
                  <span className="text-[10px] text-zinc-400 bg-white border border-zinc-200 rounded-full px-1.5 py-0.5">{comments.length}</span>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setCommentTab('comments')}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all ${commentTab==='comments' ? 'text-violet-700 bg-violet-50 border border-violet-200' : 'text-zinc-400 hover:text-zinc-600'}`}>
                  Comentários
                </button>
                <button onClick={() => setCommentTab('history')}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all ${commentTab==='history' ? 'text-violet-700 bg-violet-50 border border-violet-200' : 'text-zinc-400 hover:text-zinc-600'}`}>
                  Histórico
                </button>
              </div>
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {commentTab === 'history' ? (
                <div className="space-y-3">
                  {task.id !== 'new' && (
                    <>
                      {task.created_at && (
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
                          <span className="text-xs text-zinc-500">Tarefa criada</span>
                          <span className="text-[10px] text-zinc-400 ml-auto">{new Date(task.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                      {task.updated_at && task.updated_at !== task.created_at && (
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                          <span className="text-xs text-zinc-500">Última atualização</span>
                          <span className="text-[10px] text-zinc-400 ml-auto">{new Date(task.updated_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                    </>
                  )}
                  {comments.length === 0 && <p className="text-xs text-zinc-400 italic">Nenhuma atividade ainda.</p>}
                </div>
              ) : loadingComments ? (
                <div className="text-xs text-zinc-400 py-4">Carregando…</div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col h-full">
                  {/* Descrição destacada quando não há comentários */}
                  {form.description?.trim() && (
                    <div className="mb-4 p-4 bg-zinc-50 border border-zinc-100 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Descrição</span>
                      </div>
                      <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{form.description}</p>
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center flex-1 text-center py-6">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center mb-2">
                      <MessageSquare className="w-5 h-5 text-zinc-300" />
                    </div>
                    <p className="text-xs text-zinc-400">Sem comentários ainda.</p>
                    <button onClick={() => commentInputRef.current?.focus()}
                      className="mt-2 text-xs font-semibold hover:underline" style={{color:VL}}>Iniciar discussão</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {grouped.map((item, idx) => {
                    if (item.type === 'divider') return (
                      <div key={`d-${idx}`} className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-zinc-100" />
                        <span className="text-[10px] text-zinc-400 shrink-0">{item.label}</span>
                        <div className="flex-1 h-px bg-zinc-100" />
                      </div>
                    )
                    const isMine = item.user_id === profile?.id
                    const p = profiles.find(pr => pr.id === item.user_id)
                    const avatarColor = p?.avatar_color || (isMine ? VL : '#10B981')
                    const initials = (p?.initials || p?.full_name?.slice(0,2) || item.user_name?.slice(0,2) || '?').toUpperCase()
                    const isReply = item.parent_comment_id
                    return (
                      <div key={item.id || idx} className={`flex gap-2.5 ${isReply ? 'pl-5' : ''}`}>
                        <div className={`${isReply ? 'w-6 h-6' : 'w-7 h-7'} rounded-full flex items-center justify-center font-bold text-white shrink-0 mt-0.5`}
                          style={{ background: avatarColor, fontSize: isReply ? 8 : 10 }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-bold text-zinc-700">{item.user_name?.split(' ')[0]}</span>
                            <span className="text-[10px] text-zinc-400">
                              {new Date(item.created_at).toLocaleString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                            </span>
                          </div>
                          <div className={`text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl ${isMine ? 'text-white' : 'bg-zinc-100 text-zinc-700'}`}
                            style={isMine ? { background: accentColor, borderRadius: '4px 16px 16px 16px' } : { borderRadius: '4px 16px 16px 16px' }}>
                            {item.content}
                          </div>
                          <div className="flex items-center gap-3 mt-1 pl-1">
                            <button className="text-[10px] text-zinc-400 hover:text-zinc-600">Responder</button>
                            <button className="text-[10px] text-emerald-600 hover:text-emerald-700">✓ Resolução</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>

            {/* Input comentário */}
            {task.id !== 'new' && (
              <div className="shrink-0 border-t border-zinc-100 px-4 py-3 bg-white">
                <div className="flex gap-2.5 items-end">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{background: profile?.avatar_color||VL}}>
                    {(profile?.initials || profile?.full_name?.slice(0,2) || 'EU').toUpperCase()}
                  </div>
                  <div className="flex-1 border border-zinc-200 rounded-xl overflow-hidden focus-within:border-violet-400 transition-colors">
                    <textarea ref={commentInputRef} rows={2}
                      className="w-full text-sm px-3.5 pt-2.5 pb-1 resize-none outline-none placeholder:text-zinc-400 leading-relaxed bg-white"
                      placeholder="Escrever comentário… @ para mencionar · Enter para enviar"
                      value={newComment} onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); addComment() }}} />
                    <div className="flex justify-end px-2 pb-2">
                      <button onClick={addComment} disabled={!newComment.trim()}
                        className="px-3 py-1 text-xs font-bold text-white rounded-lg disabled:opacity-30 transition-opacity"
                        style={{background:accentColor}}>Enviar</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COL 3: Sidebar metadados */}
          <div className="shrink-0 border-l border-zinc-100 bg-zinc-50/40 flex flex-col overflow-hidden" style={{width: 280}}>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

              {/* PRAZO — destaque */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Prazo</label>
                <div className={`rounded-xl p-2.5 ${isOverdue ? 'bg-red-50 border border-red-200' : isDueSoon ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-zinc-200'}`}>
                  <input type="date"
                    className={`w-full text-sm font-semibold bg-transparent outline-none ${isOverdue ? 'text-red-700' : isDueSoon ? 'text-amber-700' : 'text-zinc-700'}`}
                    value={form.due_date||''} onChange={e => setForm(p => ({...p, due_date: e.target.value}))} />
                  {isOverdue && <div className="text-[10px] font-bold text-red-600 mt-1">{Math.abs(daysLeft)}d de atraso</div>}
                  {isDueSoon && !isOverdue && <div className="text-[10px] font-bold text-amber-600 mt-1">Vence em {daysLeft}d</div>}
                </div>
              </div>

              {/* AGUARDANDO */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Aguardando</label>
                <input className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-400 bg-white placeholder:text-zinc-400"
                  placeholder="Ex: aprovação do sócio…"
                  value={form.waiting_for || ''} onChange={e => setForm(p => ({...p, waiting_for: e.target.value}))} />
                {form.waiting_for && (
                  <div className="flex items-center gap-1.5 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-[10px] text-amber-800">{form.waiting_for}</span>
                  </div>
                )}
              </div>

              {/* IMPACTO NO CLIENTE */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Impacto no cliente</label>
                <div className="flex gap-2">
                  <button onClick={() => setForm(p => ({...p, client_impact: true}))}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${form.client_impact ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                    Sim
                  </button>
                  <button onClick={() => setForm(p => ({...p, client_impact: false}))}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${!form.client_impact ? 'bg-zinc-100 border-zinc-200 text-zinc-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                    Não
                  </button>
                </div>
              </div>

              <div className="h-px bg-zinc-200" />

              {/* RESPONSÁVEL */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Responsável</label>
                {assignedProf && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{background: assignedProf.avatar_color||VL}}>
                      {(assignedProf.initials||assignedProf.full_name?.slice(0,2)||'?').toUpperCase()}
                    </div>
                    <span className="text-xs text-zinc-700 font-medium">{assignedProf.full_name?.split(' ').slice(0,2).join(' ')}</span>
                  </div>
                )}
                <select className="w-full text-xs bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500"
                  value={form.assigned_to||''} onChange={e => setForm(p => ({...p, assigned_to: e.target.value}))}>
                  <option value="">— nenhum —</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              {/* COLABORADORES */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Colaboradores {(form.collaborators||[]).length > 0 && `(${(form.collaborators||[]).length})`}
                </label>
                {(form.collaborators||[]).length > 0 && (
                  <div className="flex items-center gap-0.5 mb-2 flex-wrap">
                    {(form.collaborators||[]).map((uid,i) => {
                      const cp = profiles.find(p => p.id === uid); if (!cp) return null
                      return (
                        <div key={uid} className="flex items-center gap-1 bg-white border border-zinc-200 rounded-full pl-0.5 pr-1.5 py-0.5">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
                            style={{background: cp.avatar_color||VL}}>
                            {(cp.initials||cp.full_name?.slice(0,2)||'?').toUpperCase()}
                          </div>
                          <span className="text-[10px] text-zinc-600">{cp.full_name?.split(' ')[0]}</span>
                          <button onClick={() => setForm(p => ({...p, collaborators: p.collaborators.filter(id => id!==uid)}))}
                            className="text-zinc-300 hover:text-red-500 text-xs">×</button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <select className="w-full text-xs bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500"
                  value="" onChange={e => {
                    const uid = e.target.value
                    if (!uid || (form.collaborators||[]).includes(uid) || uid===form.assigned_to) return
                    setForm(p => ({...p, collaborators: [...(p.collaborators||[]), uid]}))
                  }}>
                  <option value="">+ Adicionar colaborador…</option>
                  {profiles.filter(p => p.id!==form.assigned_to && !(form.collaborators||[]).includes(p.id))
                    .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              {/* PROJETO */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Projeto</label>
                <select className="w-full text-xs bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500"
                  value={form.project_id||''} onChange={e => setForm(p => ({...p, project_id: e.target.value}))}>
                  <option value="">— nenhum —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* TAGS */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Tags</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {(form.tags||[]).map((tag,i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                      {tag}
                      <button onClick={() => setForm(p => ({...p,tags:p.tags.filter((_,j)=>j!==i)}))} className="hover:text-red-600 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input className="flex-1 min-w-0 text-xs bg-white border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 placeholder:text-zinc-300"
                    placeholder="Nova tag… (Enter)" value={form._newTag||''}
                    onChange={e => setForm(p => ({...p,_newTag:e.target.value}))}
                    onKeyDown={e => { if (e.key==='Enter' && form._newTag?.trim()) setForm(p => ({...p,tags:[...(p.tags||[]),p._newTag.trim()],_newTag:''})) }} />
                  <button onClick={() => { if (form._newTag?.trim()) setForm(p => ({...p,tags:[...(p.tags||[]),p._newTag.trim()],_newTag:''})) }}
                    className="px-2 py-1.5 bg-white border border-zinc-200 text-xs text-zinc-500 rounded-lg hover:border-violet-400 hover:text-violet-600">+</button>
                </div>
              </div>

              <div className="h-px bg-zinc-200" />

              {/* Timestamps */}
              {task.id !== 'new' && (
                <div className="space-y-1">
                  {task.updated_at && task.updated_at !== task.created_at && (
                    <div className="text-[10px] text-zinc-400">
                      Última mov.: <span className="text-zinc-500 font-medium">{new Date(task.updated_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
                    </div>
                  )}
                  {task.created_at && (
                    <div className="text-[10px] text-zinc-400">
                      Criado: <span className="text-zinc-500">{new Date(task.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer: salvar */}
            <div className="shrink-0 border-t border-zinc-100 p-3.5 bg-white">
              <button onClick={handleSave} disabled={!form.title.trim()||saving}
                className="w-full py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 hover:opacity-90 flex items-center justify-center gap-2"
                style={{background:accentColor}}>
                {saving ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando…</> : task.id==='new' ? '+ Criar tarefa' : 'Salvar alterações'}
              </button>
              {task.id !== 'new' && (
                <button onClick={onClose} className="w-full mt-1.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-600">Cancelar</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ─── Kanban Principal ─────────────────────────────────────────────────────────
export default function Kanban() {
  const { profile } = useData()
  usePageTitle('Kanban')
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterDue, setFilterDue] = useState('all')
  const [modalTask, setModalTask] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  useEscapeKey(() => { setModalTask(null) }, !!(modalTask))

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    setLoading(true)
    try {
      const [tasksR, projR, profR] = await Promise.allSettled([
        supabase.from('tasks').select('*').eq('org_id', profile.org_id).is('deleted_at', null).eq('is_archived', false).order('created_at', { ascending: false }).limit(500),
        supabase.from('projects').select('id,name').eq('org_id', profile.org_id).eq('is_archived', false).order('name'),
        supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
      ])
      if (tasksR.status === 'fulfilled' && !tasksR.value.error) setTasks(tasksR.value.data || [])
      if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
      if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    } catch (err) { console.error('[Kanban] load:', err.message) }
    finally { setLoading(false) }
  }, [profile])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(() => { load() }, 90000)
    return () => clearInterval(interval)
  }, [load])

  const filtered = tasks.filter(t => {
    const matchSearch  = !search || t.title?.toLowerCase().includes(search.toLowerCase())
    const matchProj    = filterProject  === 'all' || t.project_id  === filterProject
    const matchPrio    = filterPriority === 'all' || t.priority     === filterPriority
    const matchUser    = filterAssignee === 'all' || t.assigned_to  === filterAssignee
    const now = new Date(); now.setHours(0,0,0,0)
    const due = t.due_date ? new Date(t.due_date) : null
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1)
    const nextWeek  = new Date(now); nextWeek.setDate(now.getDate()+7)
    const matchDue =
      filterDue==='all'     ? true :
      filterDue==='overdue' ? (due && due<now && t.column_id!=='done') :
      filterDue==='today'   ? (due && due>=now && due<tomorrow) :
      filterDue==='week'    ? (due && due>=now && due<nextWeek) : true
    return matchSearch && matchProj && matchPrio && matchUser && matchDue
  })

  function getColTasks(colId) {
    return [...filtered.filter(t => t.column_id===colId)].sort((a,b) => {
      if (a.is_emergency && !b.is_emergency) return -1
      if (!a.is_emergency && b.is_emergency) return 1
      const ord = { urgent:0, high:1, medium:2, low:3 }
      return (ord[a.priority]??2) - (ord[b.priority]??2)
    })
  }

  // Drag & Drop
  function onDragStart(e, task) { setDragging(task); e.dataTransfer.effectAllowed='move' }
  function onDragOver(e, colId) { e.preventDefault(); e.dataTransfer.dropEffect='move'; setDragOver(colId) }
  async function onDrop(e, colId) {
    e.preventDefault()
    if (!dragging || dragging.column_id===colId) { setDragging(null); setDragOver(null); return }
    const prev = dragging.column_id
    setTasks(t => t.map(x => x.id===dragging.id ? {...x, column_id:colId} : x))
    setDragging(null); setDragOver(null)
    const { error: err } = await supabase.from('tasks').update({ column_id:colId }).eq('id', dragging.id).eq('org_id', profile.org_id)
    if (!err) logActivity(supabase, { org_id:profile.org_id, actor_id:profile.id, entity_type:'task', entity_id:dragging.id, action:colId==='done'?'completed':'moved', module:'kanban', metadata:{to:colId} })
    if (err) { setTasks(t => t.map(x => x.id===dragging.id ? {...x,column_id:prev} : x)); setError('Erro ao mover tarefa.') }
  }
  function onDragEnd() { setDragging(null); setDragOver(null) }

  async function saveTask(form) {
    setError(null)
    const payload = {
      org_id: profile.org_id,
      title: form.title, description: form.description, priority: form.priority,
      column_id: form.column_id, assigned_to: form.assigned_to||null,
      project_id: form.project_id||null,
      due_date: form.due_date||null,
      hours_estimated: form.hours_estimated ? parseFloat(form.hours_estimated) : null,
      hours_logged: form.hours_logged ? parseFloat(form.hours_logged) : null,
      is_emergency: form.is_emergency||false, checklist: form.checklist||[],
      cover_color: form.cover_color||null, is_starred: form.is_starred||false,
      tags: form.tags||[], blocked_by: form.blocked_by||null,
      custom_field_values: { ...(form.custom_field_values||{}), collaborators: form.collaborators||[] },
    }
    if (form.id === 'new') {
      const { error: err } = await supabase.from('tasks').insert({ ...payload, created_by: profile.id })
      if (err) { setError(err.message); return }
      logActivity(supabase, { org_id:profile.org_id, actor_id:profile.id, entity_type:'task', entity_id:null, action:'created', module:'kanban', metadata:{title:form.title} })
    } else {
      const { error: err } = await supabase.from('tasks').update(payload).eq('id', form.id).eq('org_id', profile.org_id)
      if (err) { setError(err.message); return }
      logActivity(supabase, { org_id:profile.org_id, actor_id:profile.id, entity_type:'task', entity_id:form.id, action:'updated', module:'kanban', metadata:{title:form.title} })
    }
    if (form.assigned_to && form.assigned_to!==profile.id && (form.id==='new' || form.assigned_to!==form._prevAssignedTo)) {
      notifyAssignee(form)
    }
    if (form.is_emergency && !form._prevEmergency) fireEmergencyAlert(form)
    await load(); setModalTask(null)
  }

  async function notifyAssignee(form) {
    try {
      await supabase.from('notifications').insert({
        org_id: profile.org_id, user_id: form.assigned_to, type: 'task_assigned',
        title: '📋 Nova tarefa atribuída',
        message: `"${form.title}" foi atribuída a você por ${profile.full_name||'alguém'}.`,
        entity_type: 'task', entity_id: form.id!=='new' ? form.id : null, is_read: false,
      })
    } catch (err) { console.warn('[Kanban] notifyAssignee:', err.message) }
  }

  async function fireEmergencyAlert(form) {
    try {
      const { data: allProfiles } = await supabase.from('profiles').select('id,full_name,role').eq('org_id', profile.org_id).eq('is_active', true)
      const leaders = (allProfiles||[]).filter(p => isLeaderRole(p.role))
      const msg = `🚨 EMERGÊNCIA — "${form.title}" marcada por ${profile.full_name||'Alguém'}`
      const notifs = leaders.filter(l => l.id!==profile.id).map(l => ({
        org_id:profile.org_id, user_id:l.id, type:'emergency',
        title:'🚨 Alerta de Emergência', message:msg,
        entity_type:'task', entity_id:form.id!=='new'?form.id:null, is_read:false,
      }))
      if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
      const { data: channels } = await supabase.from('chat_channels').select('id,is_general').eq('org_id', profile.org_id).order('is_general',{ascending:false}).limit(5)
      const ch = channels?.find(c => c.is_general) || channels?.[0]
      if (ch) await supabase.from('chat_messages').insert({
        org_id:profile.org_id, channel_id:ch.id, sender_id:profile.id,
        content:`🚨 *EMERGÊNCIA*\n\n**Tarefa:** ${form.title}\n**Acionado por:** ${profile.full_name||'Alguém'}\n**Prioridade:** MÁXIMA — ação imediata necessária.`,
        reactions:{}, read_by:[profile.id], mentions:leaders.map(l=>l.id),
      })
      toast.success('🚨 Alerta de emergência enviado para a liderança', 6000)
    } catch (err) { console.error('[Emergency]', err.message) }
  }

  async function deleteTask(id) {
    if (!await confirm('Excluir esta tarefa?', { danger:true, confirmLabel:'Excluir', cancelLabel:'Cancelar' })) return
    const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    await load(); setModalTask(null)
  }

  async function archiveTask(id) {
    const { error } = await supabase.from('tasks').update({ is_archived:true }).eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao arquivar: ' + error.message); return }
    await load(); setModalTask(null); toast.success('Tarefa arquivada')
  }

  function exportCSV() {
    const rows = [
      ['Título','Status','Prioridade','Responsável','Projeto','Vencimento','H.Est','H.Log','Emergência'],
      ...filtered.map(t => {
        const prof = profMap[t.assigned_to]; const proj = projMap[t.project_id]
        const colLabel = COLS.find(c => c.id===t.column_id)?.label || t.column_id
        return [`"${(t.title||'').replace(/"/g,'""')}"`, colLabel, t.priority||'', prof?.full_name||'', proj?.name||'',
          t.due_date?t.due_date.slice(0,10):'', t.hours_estimated||'', t.hours_logged||'', t.is_emergency?'Sim':''].join(',')
      })
    ]
    const blob = new Blob([rows.join('\n')], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`kanban_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const profMap = {}; profiles.forEach(p => { profMap[p.id] = p })
  const projMap = {}; projects.forEach(p => { projMap[p.id] = p })

  // KPIs do hero
  const kpis = {
    total: tasks.length,
    doing: tasks.filter(t => t.column_id==='doing').length,
    review: tasks.filter(t => t.column_id==='review').length,
    done: tasks.filter(t => t.column_id==='done').length,
    overdue: tasks.filter(t => t.due_date && new Date(t.due_date)<new Date() && t.column_id!=='done').length,
    blocked: tasks.filter(t => t.blocked_by).length,
  }

  return (
    <div className="p-6 max-w-[1800px] mx-auto">

      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1">Execução</div>
            <h1 className="text-2xl font-bold mb-1">Kanban</h1>
            <p className="text-sm text-zinc-400">{kpis.total} tarefa{kpis.total!==1?'s':''} · 5 estágios de processo</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label:'Backlog',      val: tasks.filter(t=>t.column_id==='backlog').length, color:'#94A3B8' },
              { label:'A Fazer',      val: tasks.filter(t=>t.column_id==='todo').length,    color:'#9CA3AF' },
              { label:'Andamento',    val: kpis.doing,  color:'#8B89D4' },
              { label:'Em Revisão',   val: kpis.review, color:'#F59E0B' },
              { label:'Concluído',    val: kpis.done,   color:'#10B981' },
              { label:'Vencidas',     val: kpis.overdue, color:'#EF4444' },
              { label:'Bloqueadas',   val: kpis.blocked, color:'#7C3AED' },
            ].map(k => (
              <div key={k.label} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[72px]">
                <div className="text-lg font-bold" style={{color:k.color}}>{k.val}</div>
                <div className="text-[9px] text-zinc-400 uppercase tracking-wider">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Semáforo de carga */}
      <SemaforoCarga tasks={tasks} profiles={profiles} filterAssignee={filterAssignee} onFilter={setFilterAssignee} />

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input className="flex-1 text-sm bg-transparent outline-none placeholder:text-zinc-400"
            placeholder="Buscar tarefas…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')}><X className="w-3 h-3 text-zinc-400" /></button>}
        </div>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="all">Todos os projetos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">Todas as prioridades</option>
          {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterDue} onChange={e => setFilterDue(e.target.value)}>
          <option value="all">Todos os prazos</option>
          <option value="overdue">⚠ Atrasadas</option>
          <option value="today">📅 Vencendo hoje</option>
          <option value="week">📆 Esta semana</option>
        </select>
        <button onClick={() => setFilterAssignee(filterAssignee===profile?.id?'all':profile?.id)}
          className={`flex items-center gap-1.5 text-xs font-semibold border px-3 py-2 rounded-lg transition-all whitespace-nowrap ${filterAssignee===profile?.id?'bg-violet-600 text-white border-violet-600':'text-zinc-600 border-zinc-200 hover:border-violet-300'}`}>
          👤 Minhas tarefas
        </button>
        {(filterProject!=='all'||filterPriority!=='all'||filterAssignee!=='all'||filterDue!=='all'||search) && (
          <button onClick={() => { setFilterProject('all'); setFilterPriority('all'); setFilterAssignee('all'); setFilterDue('all'); setSearch('') }}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 border border-rose-200 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 whitespace-nowrap">
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
        <button onClick={load} title="Atualizar" className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50">
          <RefreshCw className="w-4 h-4 text-zinc-500" />
        </button>
        {isLeaderRole(profile?.role) && (
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 border border-zinc-200 px-3 py-2 rounded-lg hover:bg-zinc-50">
            ↓ CSV
          </button>
        )}
        <button onClick={() => setModalTask({ id:'new', column_id:'todo', title:'', priority:'medium' })}
          className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700">
          <Plus className="w-4 h-4" /> Nova tarefa
        </button>
      </div>

      {(filterProject!=='all'||filterPriority!=='all'||filterAssignee!=='all'||filterDue!=='all'||search) && (
        <div className="flex items-center gap-2 px-1 mb-3">
          <span className="text-xs text-zinc-500">
            Exibindo <span className="font-bold text-violet-700">{filtered.length}</span> de {tasks.length} tarefas
          </span>
        </div>
      )}

      {/* Board — 5 colunas */}
      {loading ? (
        <div className="text-center py-12 text-sm text-zinc-400">Carregando…</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {COLS.map(col => {
            const colTasks = getColTasks(col.id)
            const isOver = dragOver === col.id

            // % conclusão dos projetos nesta coluna
            const projIdsInCol = [...new Set(colTasks.filter(t=>t.project_id).map(t=>t.project_id))]
            const projStats = projIdsInCol.map(pid => {
              const total = tasks.filter(t=>t.project_id===pid).length
              const done  = tasks.filter(t=>t.project_id===pid && t.column_id==='done').length
              const pct   = total>0 ? Math.round(done/total*100) : 0
              return { pid, name: projMap[pid]?.name, pct, inCol: colTasks.filter(t=>t.project_id===pid).length }
            })

            return (
              <div key={col.id}
                className={`flex flex-col rounded-xl overflow-hidden transition-all ${isOver?'ring-2 ring-violet-400 ring-offset-1':''}`}
                onDragOver={e => onDragOver(e, col.id)}
                onDrop={e => onDrop(e, col.id)}
                onDragLeave={() => setDragOver(null)}>

                {/* Header da coluna — estilo Captação */}
                {(() => {
                  const colTheme = {
                    backlog: { header: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8', text: '#475569', badge: '#64748B' },
                    todo:    { header: '#F9FAFB', border: '#E5E7EB', dot: '#9CA3AF', text: '#4B5563', badge: '#6B7280' },
                    doing:   { header: '#EEF2FF', border: '#DDD6FE', dot: '#818CF8', text: '#4338CA', badge: '#6366F1' },
                    review:  { header: '#FFFBEB', border: '#FDE68A', dot: '#EAB308', text: '#713F12', badge: '#CA8A04' },
                    done:    { header: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E', text: '#14532D', badge: '#16A34A' },
                  }
                  const th = colTheme[col.id] || colTheme.todo
                  const urgentCount = colTasks.filter(t => t.priority === 'urgent').length
                  const overdueCount = colTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && col.id !== 'done').length
                  return (
                    <div className="px-3 py-3 rounded-t-xl border-b" style={{ background: th.header, borderColor: th.border }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: th.dot }} />
                          <span className="text-xs font-bold text-zinc-700">{col.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border"
                            style={{ color: th.text, borderColor: th.border }}>{colTasks.length}</span>
                        </div>
                        <button onClick={() => setModalTask({ id:'new', column_id:col.id, title:'', priority:'medium' })}
                          className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-violet-600 hover:bg-white/80 transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Info row — totais como no Reembolso */}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold" style={{ color: th.text }}>
                          {colTasks.length === 0 ? '—' : colTasks.length}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {urgentCount > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                              {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {overdueCount > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {!urgentCount && !overdueCount && (
                            <span className="text-[10px] text-zinc-400">
                              {colTasks.length === 0 ? 'Vazio' : `tarefa${colTasks.length > 1 ? 's' : ''}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* % por projeto */}
                      {projStats.length > 0 && (
                        <div className="mt-2.5 space-y-1.5 border-t pt-2" style={{ borderColor: th.border }}>
                          {projStats.slice(0,3).map(s => (
                            <div key={s.pid} className="flex items-center gap-1.5">
                              <span className="text-[9px] text-zinc-500 truncate w-16 shrink-0">{s.name?.slice(0,12)}</span>
                              <div className="flex-1 h-1 bg-white/70 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width:`${s.pct}%`, background: s.pct===100?'#10B981':th.dot }} />
                              </div>
                              <span className="text-[9px] font-bold shrink-0" style={{ color: s.pct===100?'#16A34A':th.text }}>{s.pct}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 min-h-[180px]" style={{ background:'#F8F9FC' }}>
                  {colTasks.length === 0 && (
                    <div className="text-center py-6 text-[10px] text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl">
                      {isOver ? '↓ Soltar aqui' : 'Sem tarefas'}
                    </div>
                  )}
                  {colTasks.map(t => {
                    const prof      = profMap[t.assigned_to]
                    const proj      = projMap[t.project_id]
                    const pr        = PRIORITY[t.priority] || PRIORITY.medium
                    const subs      = Array.isArray(t.checklist) ? t.checklist : []
                    const subDone   = subs.filter(s=>s.done).length
                    const subPct    = subs.length>0 ? Math.round(subDone/subs.length*100) : 0
                    const collabs   = Array.isArray(t.custom_field_values?.collaborators) ? t.custom_field_values.collaborators : []
                    const today2    = new Date(); today2.setHours(0,0,0,0)
                    const dueDate2  = t.due_date ? new Date(t.due_date) : null
                    const daysLeft  = dueDate2 ? Math.ceil((dueDate2 - today2)/86400000) : null
                    const overdue   = daysLeft !== null && daysLeft < 0 && t.column_id !== 'done'
                    const dueSoon   = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && t.column_id !== 'done'
                    const accentColor = t.is_emergency ? '#DC2626' : (t.cover_color || pr.color)
                    const isDone    = t.column_id === 'done'
                    const urgency = overdue
                      ? { label: `Parado · ${Math.abs(daysLeft)}d atraso`, bg:'#FEF2F2', color:'#B91C1C', border:'#FECACA' }
                      : dueSoon
                      ? { label: `Vence em ${daysLeft}d`, bg:'#FFFBEB', color:'#D97706', border:'#FDE68A' }
                      : { label: pr.label, bg: pr.bg, color: pr.color, border: pr.bg }
                    const colIdx  = COLS.findIndex(c => c.id === t.column_id)
                    const prevCol = COLS[colIdx - 1]
                    const nextCol = COLS[colIdx + 1]
                    return (
                      <div key={t.id} draggable
                        onDragStart={e => onDragStart(e,t)} onDragEnd={onDragEnd}
                        onClick={() => setModalTask(t)}
                        className="bg-white rounded-xl cursor-pointer overflow-hidden transition-all"
                        style={{
                          opacity: dragging?.id===t.id ? 0.3 : isDone ? 0.72 : 1,
                          boxShadow: overdue ? '0 0 0 1.5px #FECACA' : '0 1px 3px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(0,0,0,0.05)',
                          borderLeft: `3px solid ${overdue ? '#EF4444' : accentColor}`,
                        }}
                        onMouseEnter={e => { if(!isDone){e.currentTarget.style.boxShadow='0 6px 16px rgba(0,0,0,0.12)';e.currentTarget.style.transform='translateY(-2px)'}}}
                        onMouseLeave={e => {e.currentTarget.style.boxShadow=overdue?'0 0 0 1.5px #FECACA':'0 1px 3px rgba(0,0,0,0.07)';e.currentTarget.style.transform='translateY(0)'}}>
                        <div className="px-3 pt-3 pb-2">
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                              style={{ background: urgency.bg, color: urgency.color, borderColor: urgency.border }}>
                              {urgency.label}
                            </span>
                            {t.is_starred && <span className="text-amber-400 text-[11px]">★</span>}
                            {t.is_emergency && <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Emergência</span>}
                            {t.client_impact && <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full ml-auto">⚠ Cliente</span>}
                          </div>
                          {proj && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor + 'CC' }} />
                              <span className="text-[10px] text-zinc-400 font-medium truncate">{proj.name}</span>
                            </div>
                          )}
                          <div className={`text-xs font-semibold leading-snug mb-2 line-clamp-3 ${isDone ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                            {t.title}
                          </div>
                          {t.next_action && (
                            <div className="mb-2 rounded-r-lg px-2 py-1.5"
                              style={{ background: overdue ? '#FEF2F2' : '#F5F3FF', borderLeft: `2px solid ${overdue ? '#FCA5A5' : accentColor + '88'}` }}>
                              <div className="text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: overdue ? '#B91C1C' : '#9CA3AF' }}>Próxima ação</div>
                              <div className="text-[10px] leading-snug line-clamp-2" style={{ color: overdue ? '#7F1D1D' : '#374151' }}>{t.next_action}</div>
                            </div>
                          )}
                          {Array.isArray(t.tags) && t.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap mb-2">
                              {t.tags.slice(0,3).map((tag,i) => (
                                <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{tag}</span>
                              ))}
                            </div>
                          )}
                          {subs.length > 0 && (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width:`${subPct}%`, background: subPct===100?'#22C55E':accentColor }} />
                              </div>
                              <span className="text-[9px] font-semibold shrink-0" style={{ color: subPct===100?'#16A34A':'#6B7280' }}>{subDone}/{subs.length}</span>
                              {daysLeft !== null && <><div className="w-px h-3 bg-zinc-200" /><span className="text-[9px] font-semibold" style={{ color: overdue?'#B91C1C':dueSoon?'#D97706':'#9CA3AF' }}>{overdue?`${Math.abs(daysLeft)}d`:daysLeft===0?'hoje':`${daysLeft}d`}</span></>}
                            </div>
                          )}
                          {subs.length === 0 && daysLeft !== null && (
                            <div className="mb-2">
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: overdue?'#B91C1C':dueSoon?'#D97706':'#9CA3AF', background: overdue?'#FEF2F2':dueSoon?'#FFFBEB':'#F9FAFB' }}>
                                {isDone?'✓':overdue?`${Math.abs(daysLeft)}d atraso`:daysLeft===0?'Vence hoje':`${daysLeft}d restantes`}
                              </span>
                            </div>
                          )}
                          {t.waiting_for && (
                            <div className="flex items-center gap-1.5 mb-2 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              <span className="text-[9px] text-amber-800 font-medium truncate">{t.waiting_for}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              {collabs.slice(0,2).map((uid,i) => {
                                const cp=profMap[uid]; if(!cp) return null
                                return <div key={uid} title={cp.full_name} className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white ring-[1.5px] ring-white"
                                  style={{background:cp.avatar_color||'#8B5CF6',marginLeft:i>0?-5:0}}>{(cp.initials||cp.full_name?.slice(0,2)||'?').toUpperCase()}</div>
                              })}
                              {prof && <div title={prof.full_name} className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white ring-[1.5px] ring-white"
                                style={{background:prof.avatar_color||VL,marginLeft:collabs.length>0?-5:0}}>{(prof.initials||prof.full_name?.slice(0,2)||'?').toUpperCase()}</div>}
                              {!prof && !collabs.length && <span className="text-[9px] text-zinc-400 italic">Sem resp.</span>}
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-zinc-100 flex">
                          {prevCol ? (
                            <button onClick={e=>{e.stopPropagation()}} className="flex-1 text-[9px] py-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-colors text-center truncate px-1">← {prevCol.label}</button>
                          ) : <div className="flex-1" />}
                          {prevCol && nextCol && <div className="w-px bg-zinc-100" />}
                          {nextCol ? (
                            <button onClick={e=>{e.stopPropagation()}} className="flex-1 text-[9px] py-1.5 font-semibold transition-colors text-center truncate px-1 hover:bg-zinc-50" style={{color:accentColor}}>{nextCol.label} →</button>
                          ) : <div className="flex-1" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalTask && (
        <TaskModal task={modalTask} projects={projects} profiles={profiles} allTasks={tasks}
          onClose={() => setModalTask(null)} onSave={saveTask} onDelete={deleteTask} onArchive={archiveTask} />
      )}
    </div>
  )
}
