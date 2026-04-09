import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, Save, Trash2, AlertCircle, Search, ChevronDown, Paperclip, MessageSquare, Clock, CheckSquare, Square } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

// 5 colunas exatamente como no mockup
const COLUMNS = [
  { id: 'backlog',  label: 'Backlog',       dot: '#A1A1AA', wip: null },
  { id: 'todo',     label: 'A fazer',        dot: '#0EA5E9', wip: null },
  { id: 'doing',    label: 'Em andamento',   dot: '#5452C1', wip: 10 },
  { id: 'review',   label: 'Em revisão',     dot: '#F59E0B', wip: null },
  { id: 'done',     label: 'Concluído',      dot: '#10B981', wip: null },
]

const PRIORITIES = [
  { value: 'urgent', label: 'Urgente',  border: 'border-l-red-500',   bg: 'bg-red-50',    badge: 'bg-red-100 text-red-700' },
  { value: 'high',   label: 'Alta',     border: 'border-l-amber-400', bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700' },
  { value: 'medium', label: 'Média',    border: 'border-l-sky-400',   bg: '',             badge: 'bg-sky-100 text-sky-700' },
  { value: 'low',    label: 'Baixa',    border: 'border-l-zinc-300',  bg: '',             badge: 'bg-zinc-100 text-zinc-600' },
]

function PriBorder(priority) { return PRIORITIES.find(p => p.value === priority)?.border || 'border-l-zinc-300' }
function PriBg(priority) { return PRIORITIES.find(p => p.value === priority)?.bg || '' }
function PriBadge(priority) { return PRIORITIES.find(p => p.value === priority)?.badge || 'bg-zinc-100 text-zinc-600' }
function PriLabel(priority) { return PRIORITIES.find(p => p.value === priority)?.label || priority }

function fmtDate(d) {
  if (!d) return ''
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}d atrás`, cls: 'bg-red-500 text-white' }
  if (diff === 0) return { label: 'Hoje', cls: 'bg-amber-400 text-white' }
  if (diff === 1) return { label: 'Amanhã', cls: 'bg-sky-500 text-white' }
  return { label: new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), cls: 'bg-zinc-100 text-zinc-600' }
}

// ── MODAL DE TAREFA ──────────────────────────────────────────────────────────
function TaskModal({ task, projects, profiles, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    column_id: task?.column_id || 'todo',
    priority: task?.priority || 'medium',
    assigned_to: task?.assigned_to || '',
    project_id: task?.project_id || '',
    due_date: task?.due_date || '',
    hours_logged: task?.hours_logged || '',
  })
  const [subtasks, setSubtasks] = useState(task?.subtasks || [])
  const [newSubtask, setNewSubtask] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (!form.title.trim()) { setError('Título obrigatório'); return }
    setSaving(true); setError(null)
    await onSave({ ...form, subtasks, id: task?.id })
    setSaving(false)
  }

  function addSubtask() {
    if (!newSubtask.trim()) return
    setSubtasks(prev => [...prev, { text: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }

  function toggleSubtask(i) {
    setSubtasks(prev => prev.map((s, idx) => idx === i ? { ...s, done: !s.done } : s))
  }

  function removeSubtask(i) {
    setSubtasks(prev => prev.filter((_, idx) => idx !== i))
  }

  const doneSubtasks = subtasks.filter(s => s.done).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="text-sm font-bold text-zinc-800">{task?.id ? 'Editar tarefa' : 'Nova tarefa'}</div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

          {/* Título */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Título *</label>
            <input className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-violet-500"
              value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Nome da tarefa…" />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Descrição</label>
            <textarea className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
              rows={3} value={form.description || ''} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Descreva a tarefa…" />
          </div>

          {/* Row: Status + Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Status</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.column_id} onChange={e => setForm(p => ({...p, column_id: e.target.value}))}>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Prioridade</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))}>
                {PRIORITIES.map(pr => <option key={pr.value} value={pr.value}>{pr.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Responsável + Projeto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Responsável</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.assigned_to} onChange={e => setForm(p => ({...p, assigned_to: e.target.value}))}>
                <option value="">— nenhum —</option>
                {profiles.map(pr => <option key={pr.id} value={pr.id}>{pr.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Projeto</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.project_id} onChange={e => setForm(p => ({...p, project_id: e.target.value}))}>
                <option value="">— nenhum —</option>
                {projects.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Prazo + Horas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Prazo</label>
              <input type="date" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.due_date} onChange={e => setForm(p => ({...p, due_date: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Horas registradas</label>
              <input type="number" min="0" step="0.5" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="0.0h" value={form.hours_logged || ''} onChange={e => setForm(p => ({...p, hours_logged: e.target.value}))} />
            </div>
          </div>

          {/* Subtarefas / Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Checklist {subtasks.length > 0 && `(${doneSubtasks}/${subtasks.length})`}
              </label>
            </div>
            {subtasks.length > 0 && (
              <div className="mb-3 bg-zinc-50 rounded-xl p-3 space-y-2">
                {/* Progress bar */}
                {subtasks.length > 0 && (
                  <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round(doneSubtasks / subtasks.length * 100)}%` }} />
                  </div>
                )}
                {subtasks.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button onClick={() => toggleSubtask(i)} className="shrink-0 text-zinc-400 hover:text-violet-600">
                      {s.done ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
                    </button>
                    <span className={`flex-1 text-xs ${s.done ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>{s.text}</span>
                    <button onClick={() => removeSubtask(i)} className="text-zinc-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
                placeholder="Adicionar subitem…" value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()} />
              <button onClick={addSubtask} disabled={!newSubtask.trim()} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100">
          <button onClick={handleSave} disabled={saving || !form.title.trim()}
            className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />{saving ? 'Salvando…' : 'Salvar'}
          </button>
          {task?.id && (
            <button onClick={() => { if(window.confirm('Excluir esta tarefa?')) onDelete(task.id) }}
              className="flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-red-500 border border-zinc-200 hover:border-red-300 px-4 py-2.5 rounded-xl transition-colors">
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          )}
          <button onClick={onClose} className="ml-auto text-sm text-zinc-500 hover:text-zinc-700 px-4 py-2.5">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── KANBAN PRINCIPAL ─────────────────────────────────────────────────────────
export default function Kanban() {
  const { profile } = useData()
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [dragging, setDragging] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [modal, setModal] = useState(null)   // null | 'new' | task object
  const [newColId, setNewColId] = useState('todo')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [tasksRes, projRes, profRes] = await Promise.allSettled([
      supabase.from('tasks').select('*').eq('org_id', profile.org_id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('projects').select('id,name').eq('org_id', profile.org_id).order('name'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
    ])
    if (tasksRes.status === 'fulfilled' && !tasksRes.value.error) setTasks(tasksRes.value.data || [])
    if (projRes.status === 'fulfilled' && !projRes.value.error) setProjects(projRes.value.data || [])
    if (profRes.status === 'fulfilled' && !profRes.value.error) setProfilesList(profRes.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  function filteredTasks(colId) {
    return tasks.filter(t => {
      if (t.column_id !== colId) return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      if (filterProject !== 'all' && t.project_id !== filterProject) return false
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false
      return true
    })
  }

  // DnD
  function handleDragStart(e, task) {
    setDragging(task)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e, colId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colId)
  }
  function handleDragLeave() { setDragOverCol(null) }
  async function handleDrop(e, colId) {
    e.preventDefault()
    setDragOverCol(null)
    if (!dragging || dragging.column_id === colId) { setDragging(null); return }
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === dragging.id ? { ...t, column_id: colId } : t))
    setDragging(null)
    const { error } = await supabase.from('tasks').update({ column_id: colId }).eq('id', dragging.id)
    if (error) { setError(error.message); await load() }
  }
  function handleDragEnd() { setDragging(null); setDragOverCol(null) }

  async function saveTask(form) {
    setSaving(true)
    const subtasksJson = form.subtasks ? JSON.stringify(form.subtasks) : null
    if (form.id) {
      const { error } = await supabase.from('tasks').update({
        title: form.title, description: form.description, column_id: form.column_id,
        priority: form.priority, assigned_to: form.assigned_to || null,
        project_id: form.project_id || null, due_date: form.due_date || null,
        hours_logged: form.hours_logged ? parseFloat(form.hours_logged) : null,
        updated_at: new Date().toISOString(),
      }).eq('id', form.id)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('tasks').insert({
        org_id: profile.org_id, title: form.title, description: form.description,
        column_id: form.column_id, priority: form.priority,
        assigned_to: form.assigned_to || null, project_id: form.project_id || null,
        due_date: form.due_date || null,
      })
      if (error) { setError(error.message); setSaving(false); return }
    }
    await load(); setModal(null); setSaving(false)
  }

  async function deleteTask(id) {
    await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    await load(); setModal(null)
  }

  const projectName = (id) => projects.find(p => p.id === id)?.name || ''
  const profileFor = (id) => profiles.find(p => p.id === id)

  const totalTasks = tasks.length
  const doingCount = tasks.filter(t => t.column_id === 'doing').length
  const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.column_id !== 'done').length
  const doneToday = tasks.filter(t => t.column_id === 'done' && t.updated_at?.startsWith(new Date().toISOString().split('T')[0])).length

  return (
    <div className="flex flex-col min-h-screen">
      {/* HERO */}
      <div className="bg-zinc-800 text-white px-8 py-7">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-1">Fluxo de trabalho</div>
            <h1 className="text-[26px] font-black leading-tight tracking-tight">Kanban operacional</h1>
            <div className="text-xs text-white/60 mt-1">{totalTasks} tarefas no board · {doingCount} em andamento{doingCount > 10 ? ' · WIP excedido' : ''}</div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 bg-white/8 border border-white/12 text-white text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-white/15 transition-colors">
              <Search className="w-3.5 h-3.5" />Filtros
            </button>
            <button onClick={() => { setNewColId('todo'); setModal('new') }}
              className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-violet-500 transition-colors">
              <Plus className="w-3.5 h-3.5" />Nova tarefa
            </button>
          </div>
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Total no board',    val: totalTasks,   cls: 'text-indigo-200' },
            { label: 'Em andamento',      val: doingCount,   cls: 'text-blue-300' },
            { label: 'Bloqueadas',        val: 0,            cls: 'text-red-300' },
            { label: 'Vencidas',          val: overdueCount, cls: overdueCount > 0 ? 'text-red-300' : 'text-white' },
            { label: 'Concluídas hoje',   val: doneToday,    cls: 'text-emerald-300' },
            { label: 'Cycle time médio',  val: '—',          cls: 'text-white' },
          ].map(k => (
            <div key={k.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="text-[9px] text-white/50 font-bold uppercase tracking-wider">{k.label}</div>
              <div className={`text-2xl font-black leading-tight mt-1 ${k.cls}`}>{k.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-zinc-200 flex-wrap">
        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 w-56">
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input className="flex-1 text-sm bg-transparent outline-none placeholder:text-zinc-400" placeholder="Buscar tarefas…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')}><X className="w-3 h-3 text-zinc-400" /></button>}
        </div>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="all">Todos os projetos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">Todas as prioridades</option>
          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {/* Avatares da equipe */}
        <div className="flex ml-2">
          {profiles.slice(0, 5).map((pr, i) => (
            <div key={pr.id} className="w-7 h-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-white" style={{ background: pr.avatar_color || '#5452C1', marginLeft: i > 0 ? -6 : 0 }}>
              {pr.initials || '?'}
            </div>
          ))}
          {profiles.length > 5 && <div className="w-7 h-7 rounded-full text-[10px] font-bold text-zinc-600 bg-zinc-100 flex items-center justify-center border-2 border-white" style={{ marginLeft: -6 }}>+{profiles.length - 5}</div>}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* BOARD */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">Carregando…</div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3.5 p-6 min-w-max min-h-full">
            {COLUMNS.map(col => {
              const colTasks = filteredTasks(col.id)
              const wipExceeded = col.wip && colTasks.length > col.wip
              const isDragTarget = dragOverCol === col.id
              return (
                <div key={col.id} className={`w-64 shrink-0 flex flex-col rounded-xl transition-all ${isDragTarget ? 'ring-2 ring-violet-400' : ''}`}
                  onDragOver={e => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, col.id)}>
                  {/* Col header */}
                  <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${isDragTarget ? 'bg-violet-100' : 'bg-zinc-100'}`}>
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wide">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
                      {col.label}
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${wipExceeded ? 'bg-amber-400 text-white' : 'bg-white text-zinc-700'}`}>
                      {colTasks.length}{col.wip ? ` / ${col.wip}` : ''}
                    </div>
                  </div>

                  {/* Cards */}
                  <div className={`flex-1 flex flex-col gap-2 p-2 rounded-b-xl min-h-40 ${isDragTarget ? 'bg-violet-50' : 'bg-zinc-100'}`}>
                    {colTasks.map(task => {
                      const assignee = profileFor(task.assigned_to)
                      const due = fmtDate(task.due_date)
                      const proj = projectName(task.project_id)
                      const isDone = task.column_id === 'done'
                      return (
                        <div key={task.id}
                          draggable
                          onDragStart={e => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setModal(task)}
                          className={`bg-white rounded-xl px-3 pt-3 pb-2.5 cursor-pointer border-l-[3px] hover:shadow-md transition-all select-none ${PriBorder(task.priority)} ${PriBg(task.priority)} ${isDone ? 'opacity-65' : ''}`}>
                          {/* Tags */}
                          <div className="flex gap-1 mb-1.5 flex-wrap">
                            {proj && <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 uppercase tracking-wide">{proj.split(' ')[0]}</span>}
                            {task.priority === 'urgent' && <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 uppercase tracking-wide">Urgente</span>}
                            {task.priority === 'high' && <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 uppercase tracking-wide">Alta</span>}
                          </div>
                          {/* Título */}
                          <div className={`text-xs font-bold text-zinc-800 leading-snug mb-2 ${isDone ? 'line-through' : ''}`}>{task.title}</div>
                          {/* Meta row */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                              {task.hours_logged > 0 && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{task.hours_logged}h</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {due && <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded ${due.cls}`}>{due.label}</span>}
                              {assignee && (
                                <div className="w-5 h-5 rounded-full text-[8px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: assignee.avatar_color || '#5452C1' }}>
                                  {assignee.initials || '?'}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Checklist hint */}
                          {task.subtasks?.length > 0 && (
                            <div className="mt-1.5 text-[9.5px] text-zinc-400 flex items-center gap-1">
                              <CheckSquare className="w-2.5 h-2.5" />
                              {task.subtasks.filter(s => s.done).length}/{task.subtasks.length} subitens
                            </div>
                          )}
                          {/* Progress */}
                          {task.subtasks?.length > 0 && (
                            <div className="mt-1.5 h-1 bg-zinc-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round(task.subtasks.filter(s => s.done).length / task.subtasks.length * 100)}%` }} />
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Add button */}
                    <button onClick={() => { setNewColId(col.id); setModal('new') }}
                      className="mt-1 py-2 border-2 border-dashed border-zinc-300 rounded-xl text-xs font-semibold text-zinc-400 hover:border-violet-400 hover:text-violet-500 transition-colors">
                      + Adicionar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <TaskModal
          task={modal === 'new' ? { column_id: newColId } : modal}
          projects={projects}
          profiles={profiles}
          onClose={() => setModal(null)}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}
    </div>
  )
}
