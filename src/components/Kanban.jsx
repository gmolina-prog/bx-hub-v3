import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, Save, Trash2, Search, AlertCircle, Check, Clock, User, FolderOpen, Flag, MessageSquare, CheckSquare, MoreHorizontal, Archive } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'

const COLS = [
  { id: 'todo',  label: 'A Fazer',     color: '#9CA3AF' },
  { id: 'doing', label: 'Em Andamento', color: '#5452C1' },
  { id: 'done',  label: 'Concluído',   color: '#10B981' },
]

const PRIORITY = {
  urgent: { label: 'Urgente', color: '#DC2626', bg: '#FEE2E2' },
  high:   { label: 'Alta',    color: '#F59E0B', bg: '#FEF3C7' },
  medium: { label: 'Média',   color: '#3B82F6', bg: '#EFF6FF' },
  low:    { label: 'Baixa',   color: '#94A3B8', bg: '#F8FAFC' },
}

function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] || PRIORITY.medium
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: p.bg, color: p.color }}>{p.label}</span>
}

function daysUntil(d) {
  if (!d) return null
  return Math.ceil((new Date(d) - new Date()) / 86400000)
}

function DueBadge({ date, colId }) {
  const n = daysUntil(date)
  if (n === null) return null
  const done = colId === 'done'
  if (done) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 flex items-center gap-1"><Check className="w-2.5 h-2.5" />Concluído</span>
  if (n < 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{Math.abs(n)}d atraso</span>
  if (n === 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />Hoje</span>
  if (n <= 3) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{n}d</span>
  return <span className="text-[10px] text-zinc-400 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
}

// ═══════════════════════════════════════════════════════════════
// MODAL COMPLETO — fiel ao sistema original
// ═══════════════════════════════════════════════════════════════
function TaskModal({ task, projects, profiles, onClose, onSave, onDelete, onArchive }) {
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    priority: task.priority || 'medium',
    column_id: task.column_id || 'todo',
    assigned_to: task.assigned_to || '',
    project_id: task.project_id || '',
    due_date: task.due_date ? task.due_date.split('T')[0] : '',
    hours_logged: task.hours_logged || '',
    is_emergency: task.is_emergency || false,
  })
  const [subtasks, setSubtasks] = useState(Array.isArray(task.checklist) ? task.checklist : [])
  const [newSubtask, setNewSubtask] = useState('')
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [activeTab, setActiveTab] = useState('detalhes')
  const [saving, setSaving] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const { profile } = useData()

  // Load comments
  useEffect(() => {
    if (activeTab !== 'comentarios' || !task.id || task.id === 'new') return
    setLoadingComments(true)
    supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at')
      .then(({ data }) => { setComments(data || []); setLoadingComments(false) })
      .catch(() => setLoadingComments(false))
  }, [activeTab, task.id])

  async function handleSave() {
    setSaving(true)
    await onSave({ ...form, checklist: subtasks, id: task.id })
    setSaving(false)
  }

  async function addComment() {
    if (!newComment.trim() || !task.id || task.id === 'new') return
    const { data } = await supabase.from('task_comments').insert({
      task_id: task.id, org_id: profile.org_id,
      user_id: profile.id, user_name: profile.full_name, content: newComment, type: 'comment',
    }).select().single()
    if (data) setComments(prev => [...prev, data])
    setNewComment('')
  }

  function addSubtask() {
    if (!newSubtask.trim()) return
    setSubtasks(prev => [...prev, { id: Date.now(), title: newSubtask, done: false }])
    setNewSubtask('')
  }

  function toggleSubtask(id) {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s))
  }

  function deleteSubtask(id) {
    setSubtasks(prev => prev.filter(s => s.id !== id))
  }

  const doneSubtasks = subtasks.filter(s => s.done).length
  const subtaskPct = subtasks.length > 0 ? Math.round(doneSubtasks / subtasks.length * 100) : 0

  const tabs = [
    { id: 'detalhes', label: 'Detalhes' },
    { id: 'subtarefas', label: `Subtarefas ${subtasks.length > 0 ? `(${doneSubtasks}/${subtasks.length})` : ''}` },
    { id: 'comentarios', label: `Comentários ${comments.length > 0 ? `(${comments.length})` : ''}` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3 flex-wrap">
            <PriorityBadge priority={form.priority} />
            {form.is_emergency && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">🚨 Emergência</span>}
            {form.column_id && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{COLS.find(c => c.id === form.column_id)?.label}</span>}
          </div>
          <div className="flex items-center gap-2">
            {task.id !== 'new' && (
              <>
                <button onClick={() => onArchive && onArchive(task.id)} className="p-1.5 text-zinc-400 hover:text-amber-500 transition-colors" title="Arquivar">
                  <Archive className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(task.id)} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Title */}
        <div className="px-6 pt-4">
          <input
            className="w-full text-lg font-bold text-zinc-800 border-0 outline-none placeholder:text-zinc-300 focus:border-b-2 focus:border-violet-500 pb-1"
            placeholder="Título da tarefa…"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-zinc-100 px-6 mt-3">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${activeTab === t.id ? 'border-violet-500 text-violet-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── DETALHES ── */}
          {activeTab === 'detalhes' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Descrição</label>
                <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" rows={3}
                  value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição detalhada da tarefa…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Status</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.column_id} onChange={e => setForm(p => ({ ...p, column_id: e.target.value }))}>
                    {COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Prioridade</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                    {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Responsável</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.assigned_to || ''} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">— nenhum —</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Projeto</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={form.project_id || ''} onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}>
                    <option value="">— nenhum —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Prazo</label>
                  <input type="date" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                    value={form.due_date || ''} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Horas registradas</label>
                  <input type="number" min="0" step="0.5" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                    value={form.hours_logged || ''} onChange={e => setForm(p => ({ ...p, hours_logged: e.target.value }))} placeholder="0h" />
                </div>
              </div>
              {/* Emergência toggle */}
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                <div>
                  <div className="text-sm font-semibold text-zinc-800 flex items-center gap-2">🚨 Emergência</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Marcar como tarefa urgente de emergência</div>
                </div>
                <button onClick={() => setForm(p => ({ ...p, is_emergency: !p.is_emergency }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${form.is_emergency ? 'bg-red-500' : 'bg-zinc-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${form.is_emergency ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          )}

          {/* ── SUBTAREFAS ── */}
          {activeTab === 'subtarefas' && (
            <div>
              {subtasks.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-500">{doneSubtasks}/{subtasks.length} concluídas</span>
                    <span className="text-xs font-bold text-violet-600">{subtaskPct}%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${subtaskPct}%` }} />
                  </div>
                </div>
              )}
              <div className="space-y-2 mb-4">
                {subtasks.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg group">
                    <button onClick={() => toggleSubtask(s.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${s.done ? 'bg-violet-600 border-violet-600' : 'border-zinc-300 hover:border-violet-400'}`}>
                      {s.done && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <span className={`flex-1 text-sm ${s.done ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>{s.title}</span>
                    <button onClick={() => deleteSubtask(s.id)} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Nova subtarefa…" value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubtask()} />
                <button onClick={addSubtask} className="bg-violet-600 text-white px-3 py-2 rounded-lg hover:bg-violet-700 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── COMENTÁRIOS ── */}
          {activeTab === 'comentarios' && (
            <div>
              {loadingComments ? (
                <p className="text-xs text-zinc-400 text-center py-6">Carregando…</p>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">Nenhum comentário ainda.</p>
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  {comments.map(c => {
                    const prof = profiles.find(p => p.id === c.user_id)
                    return (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: prof?.avatar_color || '#5452C1' }}>
                          {prof?.initials || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-zinc-700">{c.user_name || prof?.full_name || 'Usuário'}</span>
                            <span className="text-[10px] text-zinc-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <div className="bg-zinc-50 rounded-xl px-3 py-2 text-sm text-zinc-700">{c.content}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {task.id !== 'new' && (
                <div className="flex gap-2 mt-4">
                  <textarea className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" rows={2}
                    placeholder="Adicionar comentário…" value={newComment} onChange={e => setNewComment(e.target.value)} />
                  <button onClick={addComment} disabled={!newComment.trim()} className="bg-violet-600 text-white px-3 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors self-end">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
          <div className="text-xs text-zinc-400">
            {task.id !== 'new' && task.created_at && `Criada em ${new Date(task.created_at).toLocaleDateString('pt-BR')}`}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-700 px-4 py-2">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
              <Save className="w-4 h-4" />{saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// KANBAN PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function Kanban() {
  const { profile } = useData()
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [modalTask, setModalTask] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [tasksR, projR, profR] = await Promise.allSettled([
      supabase.from('tasks').select('*').eq('org_id', profile.org_id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('projects').select('id,name').eq('org_id', profile.org_id).order('name'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
    ])
    if (tasksR.status === 'fulfilled' && !tasksR.value.error) setTasks(tasksR.value.data || [])
    if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
    if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase())
    const matchProj = filterProject === 'all' || t.project_id === filterProject
    const matchPrio = filterPriority === 'all' || t.priority === filterPriority
    return matchSearch && matchProj && matchPrio
  })

  function getColTasks(colId) {
    return filtered.filter(t => t.column_id === colId)
  }

  // Drag & Drop
  function onDragStart(e, task) {
    setDragging(task)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragOver(e, colId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(colId)
  }
  async function onDrop(e, colId) {
    e.preventDefault()
    if (!dragging || dragging.column_id === colId) { setDragging(null); setDragOver(null); return }
    const prev = dragging.column_id
    // Optimistic
    setTasks(t => t.map(x => x.id === dragging.id ? { ...x, column_id: colId } : x))
    setDragging(null); setDragOver(null)
    const { error: err } = await supabase.from('tasks').update({ column_id: colId }).eq('id', dragging.id)
    if (err) {
      setTasks(t => t.map(x => x.id === dragging.id ? { ...x, column_id: prev } : x))
      setError('Erro ao mover tarefa.')
    }
  }
  function onDragEnd() { setDragging(null); setDragOver(null) }

  async function saveTask(form) {
    setError(null)
    if (form.id === 'new') {
      const { error: err } = await supabase.from('tasks').insert({
        org_id: profile.org_id,
        title: form.title, description: form.description, priority: form.priority,
        column_id: form.column_id, assigned_to: form.assigned_to || null,
        project_id: form.project_id || null, created_by: profile.id,
        due_date: form.due_date || null, hours_logged: form.hours_logged ? parseFloat(form.hours_logged) : null,
        is_emergency: form.is_emergency || false, checklist: form.checklist || [],
      })
      if (err) { setError(err.message); return }
    } else {
      const { error: err } = await supabase.from('tasks').update({
        title: form.title, description: form.description, priority: form.priority,
        column_id: form.column_id, assigned_to: form.assigned_to || null,
        project_id: form.project_id || null,
        due_date: form.due_date || null, hours_logged: form.hours_logged ? parseFloat(form.hours_logged) : null,
        is_emergency: form.is_emergency || false, checklist: form.checklist || [],
      }).eq('id', form.id)
      if (err) { setError(err.message); return }
    }
    await load()
    setModalTask(null)
  }

  async function deleteTask(id) {
    if (!await confirm('Excluir esta tarefa?', { danger: true, confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return
    await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    await load(); setModalTask(null)
  }

  async function archiveTask(id) {
    await supabase.from('tasks').update({ is_archived: true }).eq('id', id)
    await load(); setModalTask(null)
  }

  function openNew(colId = 'todo') {
    setModalTask({ id: 'new', column_id: colId, title: '', priority: 'medium' })
  }

  const profMap = {}
  profiles.forEach(p => { profMap[p.id] = p })
  const projMap = {}
  projects.forEach(p => { projMap[p.id] = p })

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1">Execução</div>
            <h1 className="text-2xl font-bold mb-1">Kanban</h1>
            <p className="text-sm text-zinc-400">{tasks.length} tarefa{tasks.length !== 1 ? 's' : ''} · arraste entre colunas</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {COLS.map(c => (
              <div key={c.id} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[70px]">
                <div className="text-lg font-bold" style={{ color: c.id === 'done' ? '#10B981' : c.id === 'doing' ? '#8B89D4' : '#9CA3AF' }}>
                  {tasks.filter(t => t.column_id === c.id).length}
                </div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{c.label}</div>
              </div>
            ))}
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[70px]">
              <div className="text-lg font-bold text-red-400">{tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.column_id !== 'done').length}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Vencidas</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input className="flex-1 text-sm bg-transparent outline-none placeholder:text-zinc-400" placeholder="Buscar tarefas…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')}><X className="w-3 h-3 text-zinc-400" /></button>}
        </div>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="all">Todos os projetos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">Todas as prioridades</option>
          {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => openNew()} className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" /> Nova tarefa
        </button>
      </div>

      {/* Board */}
      {loading ? (
        <div className="text-center py-12 text-sm text-zinc-400">Carregando…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLS.map(col => {
            const colTasks = getColTasks(col.id)
            const isOver = dragOver === col.id
            return (
              <div key={col.id}
                className={`flex flex-col rounded-xl overflow-hidden transition-all ${isOver ? 'ring-2 ring-violet-400 ring-offset-2' : ''}`}
                onDragOver={e => onDragOver(e, col.id)}
                onDrop={e => onDrop(e, col.id)}
                onDragLeave={() => setDragOver(null)}>
                {/* Column header */}
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: col.id === 'done' ? '#ECFDF5' : col.id === 'doing' ? '#EEF2FF' : '#F9FAFB' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-bold text-zinc-700">{col.label}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#E5E5E5', color: '#6B7280' }}>{colTasks.length}</span>
                  </div>
                  <button onClick={() => openNew(col.id)} className="text-zinc-400 hover:text-violet-600 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Cards */}
                <div className="flex-1 p-3 space-y-3 min-h-[200px]" style={{ background: '#F8F9FC' }}>
                  {colTasks.length === 0 && (
                    <div className="text-center py-8 text-xs text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl">
                      {isOver ? 'Soltar aqui' : 'Sem tarefas'}
                    </div>
                  )}
                  {colTasks.map(t => {
                    const prof = profMap[t.assigned_to]
                    const proj = projMap[t.project_id]
                    const pr = PRIORITY[t.priority] || PRIORITY.medium
                    const subtasks = Array.isArray(t.checklist) ? t.checklist : []
                    const subDone = subtasks.filter(s => s.done).length
                    return (
                      <div key={t.id}
                        draggable
                        onDragStart={e => onDragStart(e, t)}
                        onDragEnd={onDragEnd}
                        onClick={() => setModalTask(t)}
                        className="bg-white rounded-xl shadow-sm border border-zinc-100 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all select-none"
                        style={{ borderLeft: `4px solid ${pr.color}`, opacity: dragging?.id === t.id ? 0.5 : 1 }}>
                        {/* Emergency badge */}
                        {t.is_emergency && <div className="px-3 pt-2.5 flex"><span className="text-[9px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">🚨 EMERGÊNCIA</span></div>}
                        <div className="p-3">
                          {/* Project tag */}
                          {proj && <div className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full inline-block mb-2">{proj.name}</div>}
                          {/* Title */}
                          <p className="text-sm font-semibold text-zinc-800 leading-tight mb-2">{t.title}</p>
                          {/* Subtask progress */}
                          {subtasks.length > 0 && (
                            <div className="mb-2">
                              <div className="flex items-center gap-1 mb-1">
                                <CheckSquare className="w-3 h-3 text-zinc-400" />
                                <span className="text-[10px] text-zinc-400">{subDone}/{subtasks.length}</span>
                              </div>
                              <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${subtasks.length > 0 ? subDone / subtasks.length * 100 : 0}%` }} />
                              </div>
                            </div>
                          )}
                          {/* Footer */}
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <PriorityBadge priority={t.priority} />
                            <DueBadge date={t.due_date} colId={t.column_id} />
                            {t.hours_logged && <span className="text-[10px] text-zinc-400 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{t.hours_logged}h</span>}
                            {prof && (
                              <div className="ml-auto w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: prof.avatar_color || '#5452C1' }} title={prof.full_name}>
                                {prof.initials || prof.full_name?.slice(0, 2)}
                              </div>
                            )}
                          </div>
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

      {/* Modal */}
      {modalTask && (
        <TaskModal
          task={modalTask}
          projects={projects}
          profiles={profiles}
          onClose={() => setModalTask(null)}
          onSave={saveTask}
          onDelete={deleteTask}
          onArchive={archiveTask}
        />
      )}
    </div>
  )
}
