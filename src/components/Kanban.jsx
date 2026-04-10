import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, Save, Trash2, Search, AlertCircle, Check, Clock, User, FolderOpen, Flag, MessageSquare, CheckSquare, MoreHorizontal, Archive, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { isLeaderRole } from '../lib/roles'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { toast, confirm } from './Toast'

// v2-card-redesign
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
  const { profile } = useData()
  const VL = '#5452C1', CH = '#2D2E39'

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
    tags:         Array.isArray(task.tags)       ? task.tags       : [],
    cover_color:  task.cover_color  || '',
    collaborators: Array.isArray(task.custom_field_values?.collaborators)
                   ? task.custom_field_values.collaborators : [],
  })

  const [subtasks,        setSubtasks]        = useState(Array.isArray(task.checklist) ? task.checklist : [])
  const [newSubtask,      setNewSubtask]      = useState('')
  const [comments,        setComments]        = useState([])
  const [newComment,      setNewComment]      = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [showAllChecklist, setShowAllChecklist] = useState(false)
  const commentsEndRef = useRef(null)
  const titleRef       = useRef(null)
  const commentInputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 60)
    if (!task.id || task.id === 'new') return
    setLoadingComments(true)
    supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at')
      .then(({ data }) => { setComments(data || []); setLoadingComments(false) })
      .catch(() => setLoadingComments(false))
  }, [task.id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  const doneSubtasks = subtasks.filter(s => s.done).length
  const subPct       = subtasks.length > 0 ? Math.round(doneSubtasks / subtasks.length * 100) : 0

  const accentColor  = form.is_emergency ? '#DC2626' : (form.cover_color || VL)

  function toggleSubtask(i) {
    setSubtasks(prev => prev.map((s, j) => j === i ? { ...s, done: !s.done } : s))
  }
  function addSubtask() {
    if (!newSubtask.trim()) return
    setSubtasks(prev => [...prev, { text: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }
  function removeSubtask(i) {
    setSubtasks(prev => prev.filter((_, j) => j !== i))
  }

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

  const COVER_COLORS = ['#5452C1','#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#EC4899','#2D2E39','#6B7280']

  // Checklist: mostrar 4 por padrão, expandir ao clicar
  const visibleSubtasks = showAllChecklist ? subtasks : subtasks.slice(0, 4)
  const hiddenCount     = subtasks.length - 4

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,16,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="bg-white rounded-2xl shadow-2xl flex overflow-hidden"
        style={{
          width: '96vw', maxWidth: 1100, height: '90vh',
          borderTop: `3px solid ${accentColor}`,
        }}>

        {/* ════════════════════════════════════════════
            COLUNA ESQUERDA — conteúdo (flex col, 3 zonas)
            ════════════════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* ZONA 1 — Header + Título + Descrição (fixo, shrink-0) */}
          <div className="shrink-0 border-b border-zinc-100">
            {/* Header de ações */}
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full border-0 focus:outline-none cursor-pointer"
                  style={{ background: PRIORITY[form.priority]?.bg, color: PRIORITY[form.priority]?.color }}
                  value={form.priority}
                  onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-zinc-200 focus:outline-none cursor-pointer bg-white text-zinc-600"
                  value={form.column_id}
                  onChange={e => setForm(p => ({ ...p, column_id: e.target.value }))}>
                  {COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                {form.is_emergency && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700">🚨 Emergência</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setForm(p => ({ ...p, is_starred: !p.is_starred }))}
                  className={`p-1.5 rounded-lg text-sm transition-colors ${form.is_starred ? 'text-amber-400' : 'text-zinc-300 hover:text-amber-400'}`}>⭐</button>
                {task.id !== 'new' && <>
                  <button onClick={() => onArchive?.(task.id)} className="p-1.5 text-zinc-400 hover:text-amber-500 rounded-lg transition-colors"><Archive className="w-4 h-4" /></button>
                  <button onClick={() => onDelete(task.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </>}
                <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Título */}
            <div className="px-7 pb-2">
              <textarea ref={titleRef} rows={2}
                className="w-full text-xl font-bold text-zinc-800 resize-none border-0 outline-none placeholder:text-zinc-300 leading-snug"
                placeholder="Título da tarefa…"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>

            {/* Descrição */}
            <div className="px-7 pb-4">
              <textarea rows={2}
                className="w-full text-sm text-zinc-500 resize-none border-0 outline-none placeholder:text-zinc-300 leading-relaxed"
                placeholder="Descrição, contexto, links…"
                value={form.description || ''}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>

          {/* ZONA 2 — Checklist (fixo, shrink-0) */}
          <div className="shrink-0 border-b border-zinc-100 bg-zinc-50/50">
            <div className="px-7 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Checklist</span>
                  {subtasks.length > 0 && (
                    <span className="text-[11px] font-bold" style={{ color: subPct === 100 ? '#10B981' : accentColor }}>
                      {doneSubtasks}/{subtasks.length} · {subPct}%
                    </span>
                  )}
                </div>
                {subtasks.length > 0 && (
                  <div className="flex-1 mx-4 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${subPct}%`, background: subPct === 100 ? '#10B981' : accentColor }} />
                  </div>
                )}
              </div>

              {/* Itens */}
              <div className="space-y-1.5">
                {visibleSubtasks.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 group">
                    <button onClick={() => toggleSubtask(i)}
                      className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                      style={s.done
                        ? { background: accentColor, borderColor: accentColor }
                        : { borderColor: '#D1D5DB' }}>
                      {s.done && <Check className="w-2.5 h-2.5 text-white" />}
                    </button>
                    <span className={`text-sm flex-1 leading-snug ${s.done ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>{s.text}</span>
                    <button onClick={() => removeSubtask(i)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-opacity text-sm px-1">×</button>
                  </div>
                ))}

                {/* Expandir checklist */}
                {!showAllChecklist && hiddenCount > 0 && (
                  <button onClick={() => setShowAllChecklist(true)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-600 pl-6 transition-colors">
                    + {hiddenCount} item{hiddenCount !== 1 ? 's' : ''} oculto{hiddenCount !== 1 ? 's' : ''}
                  </button>
                )}
                {showAllChecklist && subtasks.length > 4 && (
                  <button onClick={() => setShowAllChecklist(false)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-600 pl-6 transition-colors">
                    Recolher
                  </button>
                )}
              </div>

              {/* Input novo item */}
              <div className="flex gap-2 mt-2.5">
                <input
                  className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500 placeholder:text-zinc-300 bg-white"
                  placeholder="Adicionar item… (Enter)"
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubtask()} />
                <button onClick={addSubtask}
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-500 bg-white border border-zinc-200 rounded-lg hover:border-violet-400 hover:text-violet-600 transition-colors whitespace-nowrap">
                  + Item
                </button>
              </div>
            </div>
          </div>

          {/* ZONA 3 — Comentários (rola) + Input fixo */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Lista de comentários — rola */}
            <div className="flex-1 overflow-y-auto px-7 py-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Comentários</span>
                {comments.length > 0 && <span className="text-[11px] text-zinc-400">{comments.length}</span>}
              </div>

              {loadingComments ? (
                <div className="text-xs text-zinc-400 py-3">Carregando…</div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center mb-2">
                    <MessageSquare className="w-5 h-5 text-zinc-300" />
                  </div>
                  <p className="text-xs text-zinc-400">Sem comentários ainda.</p>
                  <button onClick={() => commentInputRef.current?.focus()}
                    className="mt-2 text-xs font-semibold hover:underline" style={{ color: VL }}>
                    Iniciar discussão
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((cm, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                        style={{ background: VL }}>
                        {(cm.user_name || '?').slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-xs font-bold text-zinc-700">{cm.user_name?.split(' ')[0]}</span>
                          <span className="text-[10px] text-zinc-400">
                            {new Date(cm.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-600 leading-relaxed bg-zinc-50 rounded-xl px-4 py-2.5">
                          {cm.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>

            {/* Input de comentário — FIXO no rodapé esquerdo */}
            {task.id !== 'new' && (
              <div className="shrink-0 border-t border-zinc-100 px-7 py-4 bg-white">
                <div className="flex gap-3 items-end">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: profile?.avatar_color || VL }}>
                    {profile?.initials || profile?.full_name?.slice(0,2) || 'EU'}
                  </div>
                  <div className="flex-1 relative">
                    <textarea ref={commentInputRef} rows={2}
                      className="w-full text-sm border border-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-500 resize-none placeholder:text-zinc-300 leading-relaxed pr-16"
                      placeholder="Escrever comentário… (Enter para enviar)"
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() }
                      }} />
                    <button onClick={addComment} disabled={!newComment.trim()}
                      className="absolute right-2 bottom-2 px-3 py-1.5 text-xs font-bold text-white rounded-lg disabled:opacity-30 transition-opacity"
                      style={{ background: VL }}>
                      ↵
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            COLUNA DIREITA — metadados + salvar
            ════════════════════════════════════════════ */}
        <div className="w-72 shrink-0 border-l border-zinc-100 flex flex-col overflow-hidden bg-zinc-50/30">

          {/* Metadados — rola */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* Responsável */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Responsável</label>
              <select className="w-full text-sm bg-white border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
                value={form.assigned_to || ''}
                onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                <option value="">— nenhum —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>

            {/* Colaboradores */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Colaboradores {(form.collaborators||[]).length > 0 && <span className="font-normal">({(form.collaborators||[]).length})</span>}
              </label>
              {(form.collaborators||[]).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(form.collaborators||[]).map(uid => {
                    const prof = profiles.find(p => p.id === uid)
                    if (!prof) return null
                    return (
                      <div key={uid} className="flex items-center gap-1 bg-white border border-violet-200 rounded-full pl-0.5 pr-2 py-0.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ background: prof.avatar_color || VL }}>
                          {prof.initials || prof.full_name?.slice(0,2)}
                        </div>
                        <span className="text-[10px] text-zinc-600">{prof.full_name?.split(' ')[0]}</span>
                        <button onClick={() => setForm(p => ({ ...p, collaborators: p.collaborators.filter(id => id !== uid) }))}
                          className="text-zinc-300 hover:text-red-500 text-xs ml-0.5 leading-none">×</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <select className="w-full text-sm bg-white border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
                value=""
                onChange={e => {
                  const uid = e.target.value
                  if (!uid || (form.collaborators||[]).includes(uid) || uid === form.assigned_to) return
                  setForm(p => ({ ...p, collaborators: [...(p.collaborators||[]), uid] }))
                }}>
                <option value="">+ Adicionar colaborador…</option>
                {profiles.filter(p => p.id !== form.assigned_to && !(form.collaborators||[]).includes(p.id))
                  .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>

            {/* Projeto */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Projeto</label>
              <select className="w-full text-sm bg-white border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
                value={form.project_id || ''}
                onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}>
                <option value="">— nenhum —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Prazo */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Prazo</label>
              <input type="date" className="w-full text-sm bg-white border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
                value={form.due_date || ''}
                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
              {form.due_date && (
                <div className="mt-1.5">
                  <DueBadge date={form.due_date} colId={form.column_id} />
                </div>
              )}
            </div>

            {/* Cor do card */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">Cor do card</label>
              <div className="flex gap-2 flex-wrap">
                {COVER_COLORS.map(col => (
                  <button key={col}
                    onClick={() => setForm(p => ({ ...p, cover_color: p.cover_color === col ? '' : col }))}
                    className={`w-6 h-6 rounded-full transition-all ${form.cover_color === col ? 'ring-2 ring-offset-2 ring-zinc-500 scale-110' : 'hover:scale-110'}`}
                    style={{ background: col }} />
                ))}
                {form.cover_color && (
                  <button onClick={() => setForm(p => ({ ...p, cover_color: '' }))}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 self-center ml-1">limpar</button>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Tags</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {(form.tags||[]).map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${accentColor}18`, color: accentColor }}>
                    {tag}
                    <button onClick={() => setForm(p => ({ ...p, tags: p.tags.filter((_,j) => j !== i) }))} className="hover:text-red-600 ml-0.5 leading-none">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  className="flex-1 min-w-0 text-xs bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500 placeholder:text-zinc-300"
                  placeholder="Nova tag… (Enter)"
                  value={form._newTag || ''}
                  onChange={e => setForm(p => ({ ...p, _newTag: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && form._newTag?.trim()) {
                      setForm(p => ({ ...p, tags: [...(p.tags||[]), p._newTag.trim()], _newTag: '' }))
                    }
                  }} />
                <button onClick={() => { if (form._newTag?.trim()) setForm(p => ({ ...p, tags: [...(p.tags||[]), p._newTag.trim()], _newTag: '' })) }}
                  className="px-2 py-1.5 bg-white border border-zinc-200 text-xs text-zinc-500 rounded-lg hover:border-violet-400 hover:text-violet-600 transition-colors">+</button>
              </div>
            </div>

            {/* Emergência */}
            <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${form.is_emergency ? 'bg-red-50 border-red-200' : 'bg-white border-zinc-200'}`}>
              <div>
                <div className="text-xs font-semibold text-zinc-700">🚨 Emergência</div>
                <div className={`text-[10px] mt-0.5 ${form.is_emergency ? 'text-red-500 font-semibold' : 'text-zinc-400'}`}>
                  {form.is_emergency ? 'Ativa — notifica liderança' : 'Desativada'}
                </div>
              </div>
              <button onClick={() => setForm(p => ({ ...p, is_emergency: !p.is_emergency }))}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${form.is_emergency ? 'bg-red-500' : 'bg-zinc-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-all ${form.is_emergency ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {task.id !== 'new' && task.created_at && (
              <div className="text-[10px] text-zinc-400 border-t border-zinc-100 pt-3">
                Criado em {new Date(task.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}
              </div>
            )}
          </div>

          {/* Botão Salvar — FIXO no rodapé direito */}
          <div className="shrink-0 border-t border-zinc-100 p-5 bg-white">
            <button onClick={handleSave} disabled={!form.title.trim() || saving}
              className="w-full py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              style={{ background: accentColor }}>
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando…</>
                : task.id === 'new' ? '+ Criar tarefa' : 'Salvar alterações'}
            </button>
            {task.id !== 'new' && (
              <button onClick={onClose} className="w-full mt-2 py-2 text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
                Cancelar
              </button>
            )}
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
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterDue,      setFilterDue]      = useState('all')  // all | today | overdue | week
  const [modalTask, setModalTask] = useState(null)
 useEscapeKey(() => { setModalTask(null) }, !!(modalTask))
   const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  function exportCSV() {
    // B-164: exporta tasks filtradas (respeita filtros ativos) + coluna Emergência
    const exportTasks = (filterProject !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all' || filterDue !== 'all' || search) ? filtered : tasks
    const rows = [
      ['Título','Status','Prioridade','Responsável','Projeto','Vencimento','Horas','Emergência'],
      ...exportTasks.map(t => {
        const prof = profMap[t.assigned_to]
        const proj = projMap[t.project_id]
        const col  = { todo: 'A Fazer', doing: 'Executando', review: 'Revisão', done: 'Concluído' }
        return [
          `"${(t.title || '').replace(/"/g,'""')}"`,
          col[t.column_id] || t.column_id,
          t.priority || '',
          prof?.full_name || '',
          proj?.name || '',
          t.due_date ? t.due_date.slice(0,10) : '',
          t.hours_logged || '',
          t.is_emergency ? 'Sim' : '',
        ].join(',')
      })
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `kanban_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [tasksR, projR, profR] = await Promise.allSettled([
      supabase.from('tasks').select('*').eq('org_id', profile.org_id).is('deleted_at', null).eq('is_archived', false).order('created_at', { ascending: false }).limit(500),
      supabase.from('projects').select('id,name').eq('org_id', profile.org_id).order('name'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
    ])
    if (tasksR.status === 'fulfilled' && !tasksR.value.error) setTasks(tasksR.value.data || [])
    if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
    if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  // B-147: polling a cada 90s para colaboração em tempo real
  useEffect(() => {
    const interval = setInterval(() => { load() }, 90 * 1000)
    return () => clearInterval(interval)
  }, [load])

  const filtered = tasks.filter(t => {
    const matchSearch  = !search || t.title?.toLowerCase().includes(search.toLowerCase())
    const matchProj    = filterProject  === 'all' || t.project_id  === filterProject
    const matchPrio    = filterPriority === 'all' || t.priority     === filterPriority
    const matchUser    = filterAssignee === 'all' || t.assigned_to  === filterAssignee
    const now = new Date(); now.setHours(0,0,0,0)
    const due = t.due_date ? new Date(t.due_date) : null
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    const nextWeek  = new Date(now); nextWeek.setDate(now.getDate() + 7)
    const matchDue =
      filterDue === 'all'     ? true :
      filterDue === 'overdue' ? (due && due < now && t.column_id !== 'done') :
      filterDue === 'today'   ? (due && due >= now && due < tomorrow) :
      filterDue === 'week'    ? (due && due >= now && due < nextWeek) : true
    return matchSearch && matchProj && matchPrio && matchUser && matchDue
  })

  function getColTasks(colId) {
    return [...filtered.filter(t => t.column_id === colId)]
      .sort((a, b) => {
        // B-96: emergências sempre no topo
        if (a.is_emergency && !b.is_emergency) return -1
        if (!a.is_emergency && b.is_emergency) return 1
        // Urgentes antes de altas
        const ord = { urgent: 0, high: 1, medium: 2, low: 3 }
        return (ord[a.priority] ?? 2) - (ord[b.priority] ?? 2)
      })
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
    const { error: err } = await supabase.from('tasks').update({ column_id: colId }).eq('id', dragging.id).eq('org_id', profile.org_id)
    const draggedTask = tasks.find(t => t.id === dragging.id)
    if (!err) logActivity(supabase, { org_id: profile.org_id, actor_id: profile.id, entity_type: 'task', entity_id: dragging.id, action: colId === 'done' ? 'completed' : 'moved', module: 'kanban', metadata: { to: colId, title: draggedTask?.title } })
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
        cover_color:   form.cover_color   || null,
        is_starred:    form.is_starred    || false,
        tags:          form.tags          || [],
        custom_field_values: {
          ...(form.custom_field_values || {}),
          collaborators: form.collaborators || [],
        },
      })
      if (err) { setError(err.message); return }
    } else {
      const { error: err } = await supabase.from('tasks').update({
        title: form.title, description: form.description, priority: form.priority,
        column_id: form.column_id, assigned_to: form.assigned_to || null,
        project_id: form.project_id || null,
        due_date: form.due_date || null, hours_logged: form.hours_logged ? parseFloat(form.hours_logged) : null,
        is_emergency: form.is_emergency || false, checklist: form.checklist || [],
        cover_color:   form.cover_color   || null,
        is_starred:    form.is_starred    || false,
        tags:          form.tags          || [],
        custom_field_values: {
          ...(form.custom_field_values || {}),
          collaborators: form.collaborators || [],
        },
      }).eq('id', form.id).eq('org_id', profile.org_id)
      if (err) { setError(err.message); return }
    }
    // Log de criação/atualização
    if (form.id === 'new') {
      logActivity(supabase, { org_id: profile.org_id, actor_id: profile.id, entity_type: 'task', entity_id: null, action: 'created', module: 'kanban', metadata: { title: form.title, priority: form.priority } })
    } else {
      logActivity(supabase, { org_id: profile.org_id, actor_id: profile.id, entity_type: 'task', entity_id: form.id, action: 'updated', module: 'kanban', metadata: { title: form.title } })
    }
    // B-97: notificar assigned_to quando task é criada ou reatribuída
    const assigneeChanged = form.assigned_to &&
      form.assigned_to !== profile.id && // não notificar a si mesmo
      (form.id === 'new' || form.assigned_to !== form._prevAssignedTo)
    if (assigneeChanged) {
      notifyAssignee(form)
    }

    // B-emergency: disparar alerta SÓ quando is_emergency MUDA para true
    if (form.is_emergency && !form._prevEmergency) {
      fireEmergencyAlert(form)
    }
    await load()
    setModalTask(null)
  }

  // Notifica o responsável atribuído à task
  async function notifyAssignee(form) {
    try {
      const taskTitle = form.title || 'Tarefa sem título'
      const projName  = projects.find(p => p.id === form.project_id)?.name
      await supabase.from('notifications').insert({
        org_id:      profile.org_id,
        user_id:     form.assigned_to,
        type:        'task_assigned',
        title:       '📋 Nova tarefa atribuída',
        message:     `"${taskTitle}"${projName ? ` — ${projName}` : ''} foi atribuída a você por ${profile.full_name || 'alguém'}.`,
        entity_type: 'task',
        entity_id:   form.id !== 'new' ? form.id : null,
        is_read:     false,
      })
    } catch (err) {
      console.warn('[Kanban] notifyAssignee:', err.message)
    }
  }

  // Dispara notificações + post no chat ao ativar emergência
  async function fireEmergencyAlert(form) {
    try {
      // 1. Buscar sócios e gerentes da org
      // Buscar todos os profiles e filtrar por isLeaderRole (aceita legado e novo padrão)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id,full_name,role')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
      const leaders = (allProfiles || []).filter(p => isLeaderRole(p.role))

      const sender = profile.full_name || 'Alguém'
      const taskTitle = form.title || 'Tarefa sem título'
      const msg = `🚨 EMERGÊNCIA — "${taskTitle}" marcada por ${sender}`

      // 2. Criar notificações para todos os líderes (exceto quem disparou)
      const notifs = (leaders || [])
        .filter(l => l.id !== profile.id)
        .map(l => ({
          org_id:      profile.org_id,
          user_id:     l.id,
          type:        'emergency',
          title:       '🚨 Alerta de Emergência',
          message:     msg,
          entity_type: 'task',
          entity_id:   form.id !== 'new' ? form.id : null,
          is_read:     false,
        }))

      if (notifs.length > 0) {
        await supabase.from('notifications').insert(notifs)
      }

      // 3. Postar no canal de chat (geral ou primeiro disponível)
      const { data: channels } = await supabase
        .from('chat_channels')
        .select('id,name,is_general')
        .eq('org_id', profile.org_id)
        .order('is_general', { ascending: false }) // geral primeiro
        .limit(5)

      let targetChannel = channels?.find(ch => ch.is_general) || channels?.[0]

      // Se não houver canal, criar #emergências
      if (!targetChannel) {
        const { data: newCh } = await supabase
          .from('chat_channels')
          .insert({
            org_id: profile.org_id,
            name: 'emergências',
            icon: '🚨',
            description: 'Canal automático para alertas de emergência',
            is_general: false,
          })
          .select().single()
        targetChannel = newCh
      }

      if (targetChannel) {
        await supabase.from('chat_messages').insert({
          org_id:     profile.org_id,
          channel_id: targetChannel.id,
          sender_id:  profile.id,
          content:    `🚨 *EMERGÊNCIA*

**Tarefa:** ${taskTitle}
**Acionado por:** ${sender}
**Prioridade:** MÁXIMA — ação imediata necessária.`,
          reactions:  {},
          read_by:    [profile.id],
          mentions:   (leaders || []).map(l => l.id), // menciona todos os líderes
        })
      }

      toast.success('🚨 Alerta de emergência enviado para a liderança', 6000)

    } catch (err) {
      console.error('[Emergency]', err.message)
      // Não bloquear — alerta é best-effort
    }
  }

  async function deleteTask(id) {
    if (!await confirm('Excluir esta tarefa?', { danger: true, confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return
    const { error } = await supabase.from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao excluir tarefa: ' + error.message); return }
    await load(); setModalTask(null)
  }

  async function archiveTask(id) {
    const { error } = await supabase.from('tasks')
      .update({ is_archived: true }).eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao arquivar tarefa: ' + error.message); return }
    await load(); setModalTask(null)
    toast.success('Tarefa arquivada')
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
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterDue} onChange={e => setFilterDue(e.target.value)}>
          <option value="all">Todos os prazos</option>
          <option value="overdue">⚠ Atrasadas</option>
          <option value="today">📅 Vencendo hoje</option>
          <option value="week">📆 Esta semana</option>
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="all">Todos responsáveis</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <button
          onClick={() => setFilterAssignee(filterAssignee === profile?.id ? 'all' : profile?.id)}
          className={`flex items-center gap-1.5 text-xs font-semibold border px-3 py-2 rounded-lg transition-all whitespace-nowrap ${
            filterAssignee === profile?.id
              ? 'bg-violet-600 text-white border-violet-600'
              : 'text-zinc-600 border-zinc-200 hover:border-violet-300 hover:text-violet-700'
          }`}
        >
          👤 Minhas tarefas
        </button>
        {(filterProject !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all' || filterDue !== 'all' || search) && (
          <button
            onClick={() => { setFilterProject('all'); setFilterPriority('all'); setFilterAssignee('all'); setFilterDue('all'); setSearch('') }}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 border border-rose-200 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 transition-all whitespace-nowrap"
          >
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
        <button onClick={load} title="Atualizar" className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
          <RefreshCw className="w-4 h-4 text-zinc-500" />
        </button>
        {isLeaderRole(profile?.role) && (
<button onClick={exportCSV} title="Exportar CSV"
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 border border-zinc-200 px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors">
          ↓ CSV
        </button>
)}
        <button onClick={() => openNew()} className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" /> Nova tarefa
        </button>
      </div>

      {/* Indicador de filtros ativos */}
      {(filterProject !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all' || filterDue !== 'all' || search) && (
        <div className="flex items-center gap-2 px-1 mb-2">
          <span className="text-xs text-zinc-500">
            Exibindo <span className="font-bold text-violet-700">{filtered.length}</span> de {tasks.length} tarefas
          </span>
          {filtered.length === 0 && (
            <span className="text-xs text-amber-600 font-semibold">
              · Nenhuma tarefa encontrada com esses filtros
            </span>
          )}
        </div>
      )}

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
                    {(() => {
                      const hrs = colTasks.reduce((s, t) => s + (parseFloat(t.hours_logged) || 0), 0)
                      return hrs > 0 ? (
                        <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{hrs.toFixed(1)}h
                        </span>
                      ) : null
                    })()}
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
                    const prof       = profMap[t.assigned_to]
                    const proj       = projMap[t.project_id]
                    const pr         = PRIORITY[t.priority] || PRIORITY.medium
                    const subtasks   = Array.isArray(t.checklist) ? t.checklist : []
                    const subDone    = subtasks.filter(s => s.done).length
                    const subPct     = subtasks.length > 0 ? Math.round(subDone / subtasks.length * 100) : 0
                    const tags       = Array.isArray(t.tags) ? t.tags : []
                    const collabs    = Array.isArray(t.custom_field_values?.collaborators) ? t.custom_field_values.collaborators : []
                    const overdue    = t.due_date && new Date(t.due_date) < new Date() && t.column_id !== 'done'
                    const daysLeft   = t.due_date ? Math.ceil((new Date(t.due_date) - new Date()) / 86400000) : null
                    const doneTask   = t.column_id === 'done'

                    // Cor dominante: emergência > cover_color > prioridade
                    const accentColor = t.is_emergency ? '#DC2626' : (t.cover_color || pr.color)

                    return (
                      <div key={t.id}
                        draggable
                        onDragStart={e => onDragStart(e, t)}
                        onDragEnd={onDragEnd}
                        onClick={() => setModalTask(t)}
                        className="group relative bg-white rounded-xl cursor-pointer select-none transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5"
                        style={{
                          opacity:    dragging?.id === t.id ? 0.4 : 1,
                          boxShadow:  '0 1px 3px rgba(0,0,0,0.08)',
                          borderTop:  `3px solid ${accentColor}`,
                          background: t.is_emergency ? '#FFF5F5' : t.cover_color ? `${t.cover_color}08` : 'white',
                        }}>

                        {/* Linha topo: projeto + ações rápidas */}
                        <div className="flex items-center justify-between px-3 pt-2.5 pb-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {t.is_emergency && (
                              <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md shrink-0">🚨</span>
                            )}
                            {proj && (
                              <span className="text-[10px] font-semibold text-zinc-400 truncate">{proj.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {t.is_starred && <span className="text-amber-400 text-xs">⭐</span>}
                          </div>
                          {!proj && t.is_starred && (
                            <span className="text-amber-400 text-xs">⭐</span>
                          )}
                        </div>

                        {/* Favorito sempre visível se ativo, mesmo sem hover */}
                        {t.is_starred && proj && (
                          <div className="absolute top-2 right-2.5 text-amber-400 text-xs">⭐</div>
                        )}

                        {/* Título */}
                        <div className="px-3 pt-2 pb-1">
                          <p className={`text-sm font-semibold leading-snug line-clamp-2 ${doneTask ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                            {t.title}
                          </p>
                        </div>

                        {/* Descrição — só 1 linha se existir */}
                        {t.description && (
                          <div className="px-3 pb-1">
                            <p className="text-[11px] text-zinc-400 line-clamp-1">{t.description}</p>
                          </div>
                        )}

                        {/* Checklist */}
                        {subtasks.length > 0 && (
                          <div className="px-3 pb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${subPct}%`, background: subPct === 100 ? '#10B981' : accentColor }} />
                              </div>
                              <span className="text-[10px] text-zinc-400 shrink-0 font-medium">
                                {subDone}/{subtasks.length}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Tags */}
                        {tags.length > 0 && (
                          <div className="px-3 pb-2 flex gap-1 flex-wrap">
                            {tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background: `${accentColor}15`, color: accentColor }}>
                                {tag}
                              </span>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-[9px] text-zinc-400">+{tags.length - 3}</span>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 gap-2">
                          {/* Esquerda: prazo + prioridade */}
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            {/* Prazo */}
                            {t.due_date && (
                              <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
                                doneTask ? 'bg-green-50 text-green-600' :
                                overdue  ? 'bg-red-100 text-red-600' :
                                daysLeft === 0 ? 'bg-amber-100 text-amber-700' :
                                daysLeft <= 3  ? 'bg-blue-50 text-blue-600' :
                                'text-zinc-400 bg-transparent'
                              }`}>
                                <Clock className="w-2.5 h-2.5" />
                                {doneTask ? '✓' :
                                 overdue  ? `${Math.abs(daysLeft)}d atraso` :
                                 daysLeft === 0 ? 'Hoje' :
                                 daysLeft <= 7  ? `${daysLeft}d` :
                                 new Date(t.due_date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}
                              </span>
                            )}
                            {/* Prioridade — só se urgente ou alta */}
                            {(t.priority === 'urgent' || t.priority === 'high') && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background: pr.bg, color: pr.color }}>
                                {pr.label}
                              </span>
                            )}
                          </div>

                          {/* Direita: avatares empilhados */}
                          <div className="flex items-center shrink-0" style={{ marginRight: -2 }}>
                            {/* Colaboradores */}
                            {collabs.slice(0, 3).map((uid, i) => {
                              const cp = profMap[uid]
                              if (!cp) return null
                              return (
                                <div key={uid}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white"
                                  style={{ background: cp.avatar_color || '#8B5CF6', marginLeft: i === 0 ? 0 : -6, zIndex: i }}
                                  title={cp.full_name}>
                                  {cp.initials || cp.full_name?.slice(0,2)}
                                </div>
                              )
                            })}
                            {/* Responsável principal */}
                            {prof && (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white"
                                style={{ background: prof.avatar_color || '#5452C1', marginLeft: collabs.length > 0 ? -6 : 0, zIndex: collabs.length }}
                                title={prof.full_name}>
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
