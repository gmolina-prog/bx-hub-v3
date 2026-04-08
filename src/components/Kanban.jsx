import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import {
  KanbanSquare,
  Plus,
  Search,
  Filter,
  User,
  Calendar,
  Clock,
  AlertCircle,
  Loader2,
  X,
  Trash2,
  Edit3,
  CheckCircle2,
  Circle,
  PlayCircle,
} from 'lucide-react'

// ============================================================================
// Kanban.jsx — Round 6 · Board de tarefas com DnD nativo
// ----------------------------------------------------------------------------
// 3 colunas fixas (todo/doing/done) lendo tasks do Supabase.
// Drag-and-drop HTML5 nativo (zero deps), optimistic updates com rollback.
// Modal de edição inline, filtros por projeto e prioridade.
// ============================================================================

const COLUMNS = [
  { id: 'todo', label: 'A Fazer', icon: Circle, color: 'zinc' },
  { id: 'doing', label: 'Em Execução', icon: PlayCircle, color: 'violet' },
  { id: 'done', label: 'Concluídas', icon: CheckCircle2, color: 'emerald' },
]

const PRIORITIES = [
  { id: 'urgent', label: 'Urgente', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  { id: 'high', label: 'Alta', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  { id: 'medium', label: 'Média', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { id: 'low', label: 'Baixa', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' },
]

export default function Kanban() {
  const { profile } = useData()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingId, setSavingId] = useState(null)

  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [profiles, setProfiles] = useState([])

  // Filtros
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('todos')
  const [priorityFilter, setPriorityFilter] = useState('todas')

  // DnD state
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  // Modal
  const [editingTask, setEditingTask] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTaskColumn, setNewTaskColumn] = useState('todo')

  useEffect(function () {
    if (profile?.org_id) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('Perfil sem org_id')

      const [tRes, prRes, profRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name').eq('org_id', orgId),
        supabase.from('profiles').select('id, full_name').eq('org_id', orgId).order('full_name', { ascending: true }),
      ])

      if (tRes.error) throw tRes.error
      if (prRes.error) throw prRes.error
      if (profRes.error) throw profRes.error

      setTasks(tRes.data || [])
      setProjects(prRes.data || [])
      setProfiles(profRes.data || [])
    } catch (err) {
      console.error('Kanban loadAll error:', err)
      setError(err.message || 'Erro ao carregar kanban')
    } finally {
      setLoading(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────
  const projectMap = useMemo(function () {
    const m = {}
    projects.forEach(function (p) { m[p.id] = p.name })
    return m
  }, [projects])

  const profileMap = useMemo(function () {
    const m = {}
    profiles.forEach(function (p) { m[p.id] = p.full_name })
    return m
  }, [profiles])

  const filteredTasks = useMemo(function () {
    return tasks.filter(function (t) {
      if (projectFilter !== 'todos' && t.project_id !== projectFilter) return false
      if (priorityFilter !== 'todas' && t.priority !== priorityFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const title = (t.title || '').toLowerCase()
        if (title.indexOf(q) === -1) return false
      }
      return true
    })
  }, [tasks, search, projectFilter, priorityFilter])

  const tasksByColumn = useMemo(function () {
    const grouped = { todo: [], doing: [], done: [] }
    filteredTasks.forEach(function (t) {
      const col = t.column_id || 'todo'
      if (grouped[col]) grouped[col].push(t)
    })
    return grouped
  }, [filteredTasks])

  // ──────────────────────────────────────────────────────────────────────
  // DnD handlers
  // ──────────────────────────────────────────────────────────────────────
  function handleDragStart(e, taskId) {
    setDraggedId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    // Firefox quirk: precisa setar dataTransfer pra drag funcionar
    try { e.dataTransfer.setData('text/plain', taskId) } catch (_) {}
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOverColumn(null)
  }

  function handleDragOver(e, columnId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColumn !== columnId) setDragOverColumn(columnId)
  }

  function handleDragLeave(e, columnId) {
    // Só limpa se saiu DE FATO da coluna (não de um filho)
    if (e.currentTarget.contains(e.relatedTarget)) return
    if (dragOverColumn === columnId) setDragOverColumn(null)
  }

  async function handleDrop(e, targetColumnId) {
    e.preventDefault()
    const taskId = draggedId
    setDraggedId(null)
    setDragOverColumn(null)
    if (!taskId) return

    const task = tasks.find(function (t) { return t.id === taskId })
    if (!task) return
    if (task.column_id === targetColumnId) return

    // Optimistic update
    const previousColumn = task.column_id
    setTasks(function (prev) {
      return prev.map(function (t) {
        if (t.id === taskId) return { ...t, column_id: targetColumnId }
        return t
      })
    })
    setSavingId(taskId)

    try {
      const { error: upErr } = await supabase
        .from('tasks')
        .update({ column_id: targetColumnId, updated_at: new Date().toISOString() })
        .eq('id', taskId)
      if (upErr) throw upErr
    } catch (err) {
      console.error('Drop update error:', err)
      // Rollback
      setTasks(function (prev) {
        return prev.map(function (t) {
          if (t.id === taskId) return { ...t, column_id: previousColumn }
          return t
        })
      })
      setError('Erro ao mover tarefa: ' + (err.message || 'desconhecido'))
    } finally {
      setSavingId(null)
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────
  async function saveTask(data) {
    try {
      if (data.id) {
        const { error: upErr } = await supabase
          .from('tasks')
          .update({
            title: data.title,
            priority: data.priority,
            project_id: data.project_id || null,
            assigned_to: data.assigned_to || null,
            due_date: data.due_date || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase
          .from('tasks')
          .insert({
            org_id: profile.org_id,
            title: data.title,
            column_id: data.column_id || 'todo',
            priority: data.priority || 'medium',
            project_id: data.project_id || null,
            assigned_to: data.assigned_to || null,
            due_date: data.due_date || null,
          })
        if (insErr) throw insErr
      }
      setEditingTask(null)
      setShowNewModal(false)
      loadAll()
    } catch (err) {
      console.error('saveTask error:', err)
      alert('Erro ao salvar: ' + (err.message || 'desconhecido'))
    }
  }

  async function deleteTask(taskId) {
    if (!confirm('Excluir esta tarefa? Esta ação não pode ser desfeita.')) return
    try {
      const { error: delErr } = await supabase.from('tasks').delete().eq('id', taskId)
      if (delErr) throw delErr
      setEditingTask(null)
      loadAll()
    } catch (err) {
      console.error('deleteTask error:', err)
      alert('Erro ao excluir: ' + (err.message || 'desconhecido'))
    }
  }

  // Badge de prioridade
  function PriorityBadge(props) {
    const pri = PRIORITIES.find(function (p) { return p.id === props.priority }) || PRIORITIES[2]
    return (
      <span className={'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ' + pri.bg + ' ' + pri.text + ' ' + pri.border}>
        {pri.label}
      </span>
    )
  }

  // Formatação de data
  function formatDate(iso) {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } catch (_) { return null }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-[1800px] mx-auto">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-violet animate-spin" />
          <span className="ml-3 text-sm text-zinc-500">Carregando board...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* HERO */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <KanbanSquare className="w-3 h-3" />
              Board de Tarefas
            </div>
            <h1 className="text-2xl font-bold mb-1">Kanban</h1>
            <p className="text-sm text-zinc-300">
              Arraste cards entre as colunas para atualizar o status · {tasks.length} tarefas totais
            </p>
          </div>
          <button
            onClick={function () { setNewTaskColumn('todo'); setShowNewModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-violet hover:bg-violet/90 rounded-lg text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova Tarefa
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          {COLUMNS.map(function (col) {
            return (
              <div key={col.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">{col.label}</div>
                <div className="text-2xl font-bold">{tasksByColumn[col.id].length}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={function (e) { setSearch(e.target.value) }}
            placeholder="Buscar por título..."
            className="w-full pl-10 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-violet focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={projectFilter}
            onChange={function (e) { setProjectFilter(e.target.value) }}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-700 focus:outline-none focus:border-violet"
          >
            <option value="todos">Todos projetos</option>
            {projects.map(function (p) {
              return <option key={p.id} value={p.id}>{p.name}</option>
            })}
          </select>
        </div>

        <select
          value={priorityFilter}
          onChange={function (e) { setPriorityFilter(e.target.value) }}
          className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-700 focus:outline-none focus:border-violet"
        >
          <option value="todas">Todas prioridades</option>
          {PRIORITIES.map(function (p) {
            return <option key={p.id} value={p.id}>{p.label}</option>
          })}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 flex-1">{error}</div>
          <button onClick={function () { setError(null) }} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(function (col) {
          const Icon = col.icon
          const columnTasks = tasksByColumn[col.id]
          const isDragOver = dragOverColumn === col.id

          return (
            <div
              key={col.id}
              onDragOver={function (e) { handleDragOver(e, col.id) }}
              onDragLeave={function (e) { handleDragLeave(e, col.id) }}
              onDrop={function (e) { handleDrop(e, col.id) }}
              className={'bg-zinc-50 rounded-xl p-3 min-h-[500px] transition-all ' + (isDragOver ? 'bg-violet/10 ring-2 ring-violet/40' : 'border border-zinc-200')}
            >
              {/* Header da coluna */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Icon className={'w-4 h-4 ' + (col.color === 'violet' ? 'text-violet' : col.color === 'emerald' ? 'text-emerald-600' : 'text-zinc-500')} />
                  <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-700">{col.label}</h2>
                  <span className="text-[10px] font-bold text-zinc-500 bg-white border border-zinc-200 rounded px-1.5 py-0.5">
                    {columnTasks.length}
                  </span>
                </div>
                <button
                  onClick={function () { setNewTaskColumn(col.id); setShowNewModal(true) }}
                  className="p-1 rounded hover:bg-white text-zinc-400 hover:text-violet transition-all"
                  title="Adicionar tarefa nesta coluna"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {columnTasks.length === 0 ? (
                  <div className={'text-center py-8 rounded-lg border-2 border-dashed transition-all ' + (isDragOver ? 'border-violet/50 bg-violet/5' : 'border-zinc-200')}>
                    <div className="text-xs text-zinc-400">
                      {isDragOver ? 'Solte aqui' : 'Vazio'}
                    </div>
                  </div>
                ) : (
                  columnTasks.map(function (task) {
                    const isDragging = draggedId === task.id
                    const isSaving = savingId === task.id
                    const projectName = projectMap[task.project_id] || null
                    const assigneeName = profileMap[task.assigned_to] || null
                    const dueText = formatDate(task.due_date)

                    return (
                      <div
                        key={task.id}
                        draggable={true}
                        onDragStart={function (e) { handleDragStart(e, task.id) }}
                        onDragEnd={handleDragEnd}
                        onClick={function () { setEditingTask(task) }}
                        className={
                          'bg-white border rounded-lg p-3 cursor-move hover:shadow-md hover:border-violet/30 transition-all select-none ' +
                          (isDragging ? 'opacity-40 scale-95' : 'opacity-100') + ' ' +
                          (isSaving ? 'ring-2 ring-violet/40 animate-pulse' : 'border-zinc-200')
                        }
                      >
                        {/* Topo: prioridade */}
                        <div className="flex items-center justify-between mb-2">
                          <PriorityBadge priority={task.priority} />
                          {isSaving && <Loader2 className="w-3 h-3 text-violet animate-spin" />}
                        </div>

                        {/* Título */}
                        <div className="text-sm font-semibold text-zinc-800 mb-2 leading-snug">
                          {task.title || 'Sem título'}
                        </div>

                        {/* Projeto */}
                        {projectName && (
                          <div className="text-[10px] text-zinc-500 mb-2 truncate">
                            📁 {projectName}
                          </div>
                        )}

                        {/* Rodapé: assignee + due date */}
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-2 border-t border-zinc-100">
                          {assigneeName ? (
                            <div className="flex items-center gap-1 truncate max-w-[60%]">
                              <User className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{assigneeName.split(' ')[0]}</span>
                            </div>
                          ) : <div />}
                          {dueText && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{dueText}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 text-center text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
        BX Hub v3 · Kanban · {filteredTasks.length} de {tasks.length} tarefas visíveis
      </div>

      {/* MODAL: Editar tarefa */}
      {editingTask && (
        <TaskModal
          task={editingTask}
          projects={projects}
          profiles={profiles}
          onClose={function () { setEditingTask(null) }}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}

      {/* MODAL: Nova tarefa */}
      {showNewModal && (
        <TaskModal
          task={{ title: '', priority: 'medium', column_id: newTaskColumn, project_id: '', assigned_to: '', due_date: '' }}
          projects={projects}
          profiles={profiles}
          onClose={function () { setShowNewModal(false) }}
          onSave={saveTask}
          isNew={true}
        />
      )}
    </div>
  )
}

// ============================================================================
// TaskModal — componente interno reutilizado para novo/editar
// ============================================================================
function TaskModal(props) {
  const [form, setForm] = useState({
    id: props.task.id || null,
    title: props.task.title || '',
    priority: props.task.priority || 'medium',
    column_id: props.task.column_id || 'todo',
    project_id: props.task.project_id || '',
    assigned_to: props.task.assigned_to || '',
    due_date: props.task.due_date ? props.task.due_date.slice(0, 10) : '',
  })

  function handleSubmit() {
    if (!form.title.trim()) {
      alert('Título é obrigatório')
      return
    }
    props.onSave(form)
  }

  function update(key, value) {
    setForm(function (prev) {
      const next = { ...prev }
      next[key] = value
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={props.onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={function (e) { e.stopPropagation() }}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 text-white p-5 rounded-t-2xl flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-300 mb-1">
              {props.isNew ? 'Nova Tarefa' : 'Editar Tarefa'}
            </div>
            <h2 className="text-lg font-bold">{props.isNew ? 'Criar nova tarefa' : (props.task.title || 'Editar')}</h2>
          </div>
          <button onClick={props.onClose} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-600 mb-1 block">Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={function (e) { update('title', e.target.value) }}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-violet focus:bg-white"
              autoFocus={true}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-zinc-600 mb-1 block">Status</label>
              <select
                value={form.column_id}
                onChange={function (e) { update('column_id', e.target.value) }}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-violet"
              >
                <option value="todo">A Fazer</option>
                <option value="doing">Em Execução</option>
                <option value="done">Concluída</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-zinc-600 mb-1 block">Prioridade</label>
              <select
                value={form.priority}
                onChange={function (e) { update('priority', e.target.value) }}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-violet"
              >
                <option value="urgent">Urgente</option>
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-600 mb-1 block">Projeto</label>
            <select
              value={form.project_id}
              onChange={function (e) { update('project_id', e.target.value) }}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-violet"
            >
              <option value="">— Sem projeto —</option>
              {props.projects.map(function (p) {
                return <option key={p.id} value={p.id}>{p.name}</option>
              })}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-600 mb-1 block">Responsável</label>
            <select
              value={form.assigned_to}
              onChange={function (e) { update('assigned_to', e.target.value) }}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-violet"
            >
              <option value="">— Não atribuído —</option>
              {props.profiles.map(function (p) {
                return <option key={p.id} value={p.id}>{p.full_name}</option>
              })}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-600 mb-1 block">Data Limite</label>
            <input
              type="date"
              value={form.due_date}
              onChange={function (e) { update('due_date', e.target.value) }}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-violet"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-100 flex items-center justify-between gap-3">
          {!props.isNew && props.onDelete && (
            <button
              onClick={function () { props.onDelete(form.id) }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={props.onClose}
            className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-semibold bg-violet hover:bg-violet/90 text-white rounded-lg transition-all"
          >
            {props.isNew ? 'Criar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
