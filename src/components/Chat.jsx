import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Hash, Send, Plus, X, Search, Pin, Reply, Smile, MoreHorizontal,
  Users, Check, CheckCheck, Archive, Trash2, Edit3, ChevronDown,
  ChevronRight, AtSign, ArchiveRestore, MessageSquare, Bell, BellOff,
  Clock, Calendar, Zap, BookmarkPlus, Globe, Sparkles, RefreshCw,
  Eye, EyeOff, Bold, Italic, Code, Link2
} from 'lucide-react'
import { toast, confirm } from './Toast'
import { supabase } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { useNavigate } from 'react-router-dom'

const CH = '#2D2E39', VL = '#5452C1'
const REACTIONS_LIST = ['👍','❤️','🔥','✅','😂','🙏','👀','⚡']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(d) { return new Date(d).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) }
function fmtDate(d) {
  const dt=new Date(d), today=new Date(); today.setHours(0,0,0,0)
  const yesterday=new Date(today); yesterday.setDate(today.getDate()-1)
  if(dt>=today) return 'Hoje'
  if(dt>=yesterday) return 'Ontem'
  return dt.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})
}
function initials(name) {
  if(!name) return '?'
  return name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
}

// Markdown simples: **bold**, *italic*, `code`, links
function renderMarkdown(text, mine) {
  if (!text) return ''
  const accentLight = mine ? '#C4B5FD' : VL
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.08);padding:1px 5px;border-radius:4px;font-size:0.85em;font-family:monospace">$1</code>')
    .replace(/(https?:\/\/[^\s]+)/g, `<a href="$1" target="_blank" rel="noopener noreferrer" style="color:${accentLight};text-decoration:underline">$1</a>`)
    .replace(/@([\w\s]+?)(?=\s|$)/g, `<span style="font-weight:700;color:${accentLight}">@$1</span>`)
    .replace(/\n/g,'<br/>')
  return html
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ profile, size=32, showStatus=false, isOnline=false }) {
  const sz = { width:size, height:size, minWidth:size, fontSize:size*0.35 }
  return (
    <div className="relative inline-flex shrink-0">
      <div className="rounded-full flex items-center justify-center font-bold text-white"
        style={{...sz, background: profile?.avatar_color||VL}}>
        {initials(profile?.full_name)}
      </div>
      {showStatus && (
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${isOnline?'bg-green-400':'bg-zinc-400'}`}
          style={{borderColor:'#fff'}} />
      )}
    </div>
  )
}

// ─── Formatação toolbar ───────────────────────────────────────────────────────
function FormatToolbar({ inputRef, value, onChange }) {
  function wrap(before, after='') {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const sel = value.slice(start, end)
    const newVal = value.slice(0, start) + before + (sel||'texto') + after + value.slice(end)
    onChange(newVal)
    setTimeout(() => { el.focus(); el.setSelectionRange(start+before.length, start+before.length+(sel||'texto').length) }, 10)
  }
  return (
    <div className="flex items-center gap-0.5 border-b border-zinc-100 px-2 py-1">
      <button type="button" onClick={() => wrap('**','**')} title="Negrito"
        className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 text-xs font-bold">B</button>
      <button type="button" onClick={() => wrap('*','*')} title="Itálico"
        className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 italic text-xs">I</button>
      <button type="button" onClick={() => wrap('`','`')} title="Código"
        className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
        <Code className="w-3 h-3" />
      </button>
      <div className="w-px h-3 bg-zinc-200 mx-0.5" />
      <span className="text-[9px] text-zinc-300 select-none">**bold** *italic* `code`</span>
    </div>
  )
}

// ─── Global Search Modal ──────────────────────────────────────────────────────
function GlobalSearchModal({ channels, profMap, orgId, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  useEffect(() => { setTimeout(()=>inputRef.current?.focus(),50) }, [])

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase.from('chat_messages').select('*')
        .eq('org_id', orgId).ilike('content', `%${query}%`)
        .order('created_at', { ascending:false }).limit(30)
      setResults(data||[])
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, orgId])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{background:'rgba(0,0,0,0.5)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input ref={inputRef} autoFocus
            className="flex-1 text-sm outline-none placeholder:text-zinc-400"
            placeholder="Buscar em todos os canais…"
            value={query} onChange={e=>setQuery(e.target.value)} />
          <button onClick={onClose}><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading && <div className="p-6 text-center text-xs text-zinc-400">Buscando…</div>}
          {!loading && query.length>=2 && results.length===0 && (
            <div className="p-6 text-center text-xs text-zinc-400">Nenhuma mensagem encontrada para "{query}"</div>
          )}
          {!loading && results.length>0 && results.map(msg => {
            const ch = channels.find(c=>c.id===msg.channel_id)
            const author = profMap[msg.sender_id]
            return (
              <button key={msg.id} onClick={()=>onSelect(msg, ch)}
                className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 border-b border-zinc-50 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{background:author?.avatar_color||VL}}>
                  {initials(author?.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-zinc-700">{author?.full_name}</span>
                    <span className="text-[10px] text-zinc-400">{ch?.icon||'#'} {ch?.name}</span>
                    <span className="text-[10px] text-zinc-300 ml-auto">{fmtTime(msg.created_at)}</span>
                  </div>
                  <p className="text-xs text-zinc-600 truncate">{msg.content}</p>
                </div>
              </button>
            )
          })}
          {!query && <div className="p-6 text-center text-xs text-zinc-400">Digite para buscar em todos os canais</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Thread Panel ─────────────────────────────────────────────────────────────
function ThreadPanel({ rootMsg, messages, profile, profMap, onClose, onSendReply, onReact, onPin, onDelete, isLeader }) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const thread = messages.filter(m => m.reply_to===rootMsg.id || m.id===rootMsg.id)
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))

  useEffect(() => { setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),50) }, [thread.length])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    await onSendReply(text, rootMsg.id)
    setSending(false)
    inputRef.current?.focus()
  }

  const rootAuthor = profMap[rootMsg.sender_id]

  return (
    <div className="w-80 shrink-0 border-l border-zinc-100 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-bold text-zinc-800">Thread</span>
          <span className="text-xs text-zinc-400">{thread.length-1} respostas</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {thread.map((msg, idx) => {
          const author = profMap[msg.sender_id]
          const mine = msg.sender_id === profile?.id
          const isRoot = msg.id === rootMsg.id
          const reactions = msg.reactions && typeof msg.reactions==='object' ? Object.entries(msg.reactions) : []
          return (
            <div key={msg.id} className={`${isRoot?'pb-3 border-b border-zinc-100 mb-1':''}`}>
              <div className="flex items-start gap-2.5 group">
                <Avatar profile={author} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-zinc-700">{author?.full_name}</span>
                    <span className="text-[10px] text-zinc-400">{fmtTime(msg.created_at)}</span>
                    {isRoot && <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">Original</span>}
                    {msg.edited_at && <span className="text-[9px] text-zinc-400 italic">(editado)</span>}
                  </div>
                  <div className={`text-sm rounded-xl px-3 py-2 ${mine?'text-white':'bg-zinc-100 text-zinc-800'}`}
                    style={mine?{background:VL}:{}}
                    dangerouslySetInnerHTML={{__html: renderMarkdown(msg.content, mine)}} />
                  {reactions.length>0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {reactions.map(([emoji,users])=>(
                        <button key={emoji} onClick={()=>onReact(msg.id,emoji)}
                          className="flex items-center gap-1 bg-white border border-zinc-200 rounded-full px-1.5 py-0.5 text-xs">
                          {emoji} <span className="text-zinc-600 font-semibold">{Array.isArray(users)?users.length:users}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-100 p-3 shrink-0">
        <div className="flex gap-2">
          <textarea ref={inputRef} rows={2}
            className="flex-1 text-sm border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 resize-none placeholder:text-zinc-400"
            placeholder="Responder na thread…"
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }} />
          <button onClick={send} disabled={!input.trim()||sending}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 self-end shrink-0"
            style={{background:input.trim()?VL:'#CBD5E1'}}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Scheduled Message Composer ───────────────────────────────────────────────
function ScheduleModal({ onSchedule, onClose }) {
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const minDate = new Date().toISOString().split('T')[0]

  function submit() {
    if (!text.trim() || !date || !time) return
    const scheduledFor = new Date(`${date}T${time}:00`)
    onSchedule(text.trim(), scheduledFor)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.5)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-violet-600" />
          <h3 className="text-sm font-bold text-zinc-800">Agendar mensagem</h3>
        </div>
        <textarea rows={3}
          className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 resize-none mb-3 placeholder:text-zinc-400"
          placeholder="Mensagem…" value={text} onChange={e=>setText(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Data</label>
            <input type="date" min={minDate}
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
              value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Hora</label>
            <input type="time"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
              value={time} onChange={e=>setTime(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={submit} disabled={!text.trim()||!date||!time}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50"
            style={{background:VL}}>Agendar</button>
          <button onClick={onClose} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Channel Menu ─────────────────────────────────────────────────────────────
function ChannelMenu({ channel, isLeader, onArchive, onUnarchive, onDelete, onRename, onClose, position }) {
  const menuRef = useRef(null)
  useEffect(() => {
    function h(e) { if(menuRef.current&&!menuRef.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown',h)
    return ()=>document.removeEventListener('mousedown',h)
  },[onClose])
  return (
    <div ref={menuRef}
      className="fixed bg-white border border-zinc-200 rounded-xl shadow-xl z-[9999] py-1 w-44"
      style={{ top: position?.y||0, left: position?.x||0 }}
      onClick={e=>e.stopPropagation()}>
      {!channel.is_general && (
        <button onClick={()=>{onRename();onClose()}}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50">
          <Edit3 className="w-3.5 h-3.5 text-zinc-400" />Renomear canal
        </button>
      )}
      {!channel.is_archived ? (
        <button onClick={()=>{onArchive();onClose()}}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50">
          <Archive className="w-3.5 h-3.5 text-zinc-400" />Arquivar canal
        </button>
      ) : (
        <button onClick={()=>{onUnarchive();onClose()}}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50">
          <ArchiveRestore className="w-3.5 h-3.5 text-zinc-400" />Desarquivar
        </button>
      )}
      {isLeader && !channel.is_general && <>
        <div className="h-px bg-zinc-100 mx-2 my-1" />
        <button onClick={()=>{onDelete();onClose()}}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50">
          <Trash2 className="w-3.5 h-3.5" />Excluir canal
        </button>
      </>}
    </div>
  )
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────
function RenameModal({ channel, onSave, onClose }) {
  const [name, setName] = useState(channel.name)
  const [saving, setSaving] = useState(false)
  async function save() {
    if(!name.trim()||name.trim()===channel.name){onClose();return}
    setSaving(true)
    const {error}=await supabase.from('chat_channels').update({name:name.trim()}).eq('id',channel.id)
    if(error){toast.error('Erro: '+error.message);setSaving(false);return}
    onSave(channel.id, name.trim()); setSaving(false); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.5)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-sm font-bold text-zinc-800 mb-4">Renomear canal</h3>
        <input autoFocus className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 mb-4"
          value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} />
        <div className="flex gap-3">
          <button onClick={save} disabled={saving||!name.trim()} className="flex-1 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{background:VL}}>
            {saving?'Salvando…':'Salvar'}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── New Channel Modal ────────────────────────────────────────────────────────
function NewChannelModal({ profile, projects, onCreated, onClose }) {
  const [name,setName]=useState(''); const [desc,setDesc]=useState('')
  const [projectId,setProjectId]=useState(''); const [icon,setIcon]=useState('💬')
  const [saving,setSaving]=useState(false)
  const ICONS=['💬','📁','🎯','🔥','⚡','🏢','📊','🤝','💡','⚠️','✅','🧠']
  async function create() {
    if(!name.trim()) return; setSaving(true)
    const {data,error}=await supabase.from('chat_channels').insert({
      org_id:profile.org_id, name:name.trim(), description:desc.trim()||null,
      icon, project_id:projectId||null, is_general:false, is_archived:false, type:'channel'
    }).select().single()
    if(error){toast.error('Erro: '+error.message);setSaving(false);return}
    if(data) onCreated(data); setSaving(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.6)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-zinc-800">Novo Canal</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-zinc-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Ícone</label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map(ic=>(
                <button key={ic} onClick={()=>setIcon(ic)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center ${icon===ic?'ring-2 ring-violet-500 bg-violet-50':'hover:bg-zinc-100'}`}>{ic}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nome *</label>
            <input autoFocus className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              placeholder="ex: braskem-rj, financeiro…" value={name} onChange={e=>setName(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&create()} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Descrição</label>
            <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              placeholder="Para que serve este canal?" value={desc} onChange={e=>setDesc(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Projeto vinculado</label>
            <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              value={projectId} onChange={e=>setProjectId(e.target.value)}>
              <option value="">— nenhum —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={create} disabled={saving||!name.trim()}
              className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50" style={{background:VL}}>
              {saving?'Criando…':'Criar canal'}
            </button>
            <button onClick={onClose} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Message Component ────────────────────────────────────────────────────────
function Message({ msg, mine, isLeader, author, profMap, onReact, onReply, onPin, onDelete, onEdit, onMarkUnread, onOpenThread, isAlertChannel, markedUnread }) {
  const [showActions,setShowActions]=useState(false)
  const [showEmojiPicker,setShowEmojiPicker]=useState(false)
  const [editing,setEditing]=useState(false)
  const [editText,setEditText]=useState(msg.content||'')
  const [saving,setSaving]=useState(false)
  const editRef=useRef(null)

  useEffect(()=>{ if(editing) setTimeout(()=>editRef.current?.focus(),50) },[editing])

  const isRead = Array.isArray(msg.read_by)&&msg.read_by.length>0
  const isPinned = msg.is_pinned
  const canDelete = mine||isLeader
  const reactions = msg.reactions&&typeof msg.reactions==='object' ? Object.entries(msg.reactions) : []
  const threadCount = msg._threadCount||0
  const isUnread = markedUnread

  async function saveEdit() {
    if(!editText.trim()||editText===msg.content){setEditing(false);return}
    setSaving(true)
    const {error}=await supabase.from('chat_messages')
      .update({content:editText.trim(), edited_at:new Date().toISOString()})
      .eq('id',msg.id)
    if(error){toast.error('Erro ao editar: '+error.message)}
    else { onEdit(msg.id, editText.trim()); setEditing(false) }
    setSaving(false)
  }

  // Read audit: para canal de alertas, mostrar avatares de quem leu
  const readProfiles = isAlertChannel && Array.isArray(msg.read_by)
    ? msg.read_by.slice(0,5)
    : []

  return (
    <div className={`group flex gap-2.5 px-4 py-1 hover:bg-zinc-50/80 transition-colors relative ${mine?'flex-row-reverse':''} ${isUnread?'bg-violet-50/40':''}`}
      onMouseEnter={()=>setShowActions(true)}
      onMouseLeave={()=>{setShowActions(false);setShowEmojiPicker(false)}}>

      {!mine&&<div className="shrink-0 mt-0.5"><Avatar profile={author} size={32} /></div>}

      <div className={`flex flex-col max-w-[72%] ${mine?'items-end':''}`}>
        {!mine&&(
          <div className="flex items-center gap-2 mb-0.5 px-1">
            <span className="text-xs font-bold text-zinc-700">{author?.full_name}</span>
            <span className="text-[10px] text-zinc-400">{fmtTime(msg.created_at)}</span>
            {isPinned&&<span className="text-[9px] text-amber-500 font-bold">📌 fixada</span>}
            {msg.edited_at&&<span className="text-[9px] text-zinc-400 italic">(editado)</span>}
            {isUnread&&<span className="text-[9px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">● não lido</span>}
          </div>
        )}

        {editing ? (
          <div className="w-full">
            <textarea ref={editRef} rows={2}
              className="w-full text-sm border border-violet-400 rounded-xl px-3 py-2 focus:outline-none resize-none"
              value={editText} onChange={e=>setEditText(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();saveEdit()}if(e.key==='Escape')setEditing(false)}} />
            <div className="flex gap-2 mt-1 justify-end">
              <button onClick={()=>setEditing(false)} className="text-[10px] text-zinc-400 hover:text-zinc-600 px-2 py-1">Cancelar (Esc)</button>
              <button onClick={saveEdit} disabled={saving}
                className="text-[10px] font-bold text-white px-3 py-1 rounded-lg disabled:opacity-50"
                style={{background:VL}}>Salvar (Enter)</button>
            </div>
          </div>
        ) : (
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${mine?'text-white rounded-tr-sm':'bg-white text-zinc-800 rounded-tl-sm border border-zinc-100'}`}
            style={mine?{background:VL}:{}}>
            <div dangerouslySetInnerHTML={{__html: renderMarkdown(msg.content||'', mine)}} />
            {mine&&(
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[10px] text-violet-200">{fmtTime(msg.created_at)}</span>
                {isRead?<CheckCheck className="w-3 h-3 text-violet-200"/>:<Check className="w-3 h-3 text-violet-300"/>}
              </div>
            )}
          </div>
        )}

        {/* Reactions */}
        {reactions.length>0&&(
          <div className={`flex gap-1 mt-1 flex-wrap ${mine?'justify-end':''}`}>
            {reactions.map(([emoji,users])=>(
              <button key={emoji} onClick={()=>onReact(msg.id,emoji)}
                className="flex items-center gap-1 bg-white border border-zinc-200 rounded-full px-2 py-0.5 text-xs hover:border-violet-300 shadow-sm">
                <span>{emoji}</span>
                <span className="text-zinc-600 font-semibold">{Array.isArray(users)?users.length:users}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread count */}
        {threadCount>0&&(
          <button onClick={()=>onOpenThread(msg)}
            className={`flex items-center gap-1 mt-1 text-[10px] font-semibold hover:underline ${mine?'self-end':''}`}
            style={{color:VL}}>
            <MessageSquare className="w-3 h-3"/>
            {threadCount} resposta{threadCount>1?'s':''} na thread →
          </button>
        )}

        {/* Read audit para canal de alertas */}
        {isAlertChannel&&readProfiles.length>0&&(
          <div className={`flex items-center gap-1 mt-1 ${mine?'justify-end':''}`}>
            <Eye className="w-2.5 h-2.5 text-zinc-300"/>
            <span className="text-[9px] text-zinc-400">Lido por {readProfiles.length}</span>
            <div className="flex -space-x-1">
              {readProfiles.map(uid=>{
                const p=profMap[uid]; if(!p) return null
                return <div key={uid} title={p.full_name}
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-white ring-1 ring-white"
                  style={{background:p.avatar_color||VL}}>{initials(p.full_name)}</div>
              })}
              {Array.isArray(msg.read_by)&&msg.read_by.length>5&&(
                <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-zinc-500 bg-zinc-100 ring-1 ring-white">
                  +{msg.read_by.length-5}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hover actions */}
      {showActions&&!editing&&(
        <div className={`absolute top-1 flex items-center gap-0.5 bg-white border border-zinc-200 rounded-xl shadow-lg px-1 py-0.5 z-20 ${mine?'left-4':'right-4'}`}>
          <div className="relative">
            <button onClick={()=>setShowEmojiPicker(p=>!p)} title="Reagir"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800">
              <Smile className="w-3.5 h-3.5"/>
            </button>
            {showEmojiPicker&&(
              <div className={`absolute top-8 ${mine?'right-0':'left-0'} bg-white border border-zinc-200 rounded-xl shadow-xl p-2 flex gap-1 z-30`}>
                {REACTIONS_LIST.map(em=>(
                  <button key={em} onClick={()=>{onReact(msg.id,em);setShowEmojiPicker(false)}}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-lg">{em}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={()=>onReply(msg)} title="Responder"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800">
            <Reply className="w-3.5 h-3.5"/>
          </button>
          <button onClick={()=>onOpenThread(msg)} title="Abrir thread"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800">
            <MessageSquare className="w-3.5 h-3.5"/>
          </button>
          <button onClick={()=>onPin(msg)} title="Fixar"
            className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 ${msg.is_pinned?'text-amber-500':'text-zinc-500 hover:text-zinc-800'}`}>
            <Pin className="w-3.5 h-3.5"/>
          </button>
          <button onClick={()=>onMarkUnread(msg.id)} title="Marcar como não lido"
            className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 ${isUnread?'text-violet-500':'text-zinc-500 hover:text-zinc-800'}`}>
            <BookmarkPlus className="w-3.5 h-3.5"/>
          </button>
          {mine&&(
            <button onClick={()=>setEditing(true)} title="Editar mensagem"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800">
              <Edit3 className="w-3.5 h-3.5"/>
            </button>
          )}
          {canDelete&&(
            <button onClick={()=>onDelete(msg)} title="Excluir"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-500">
              <Trash2 className="w-3.5 h-3.5"/>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Chat ────────────────────────────────────────────────────────────────
export default function Chat() {
  const { profile, setUnreadChat } = useData()
  const navigate = useNavigate()
  usePageTitle('Chat')

  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [projects, setProjects] = useState([])
  const [todayCheckins, setTodayCheckins] = useState([])
  const [unreadByChannel, setUnreadByChannel] = useState({})
  const [markedUnread, setMarkedUnread] = useState(new Set()) // local only
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [search, setSearch] = useState('')
  const [mentioning, setMentioning] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending, setSending] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [showPinned, setShowPinned] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showDMs, setShowDMs] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [channelMenu, setChannelMenu] = useState(null)
  const [renamingChannel, setRenamingChannel] = useState(null)
  const [threadMsg, setThreadMsg] = useState(null)
  const [toasts, setToasts] = useState([])
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [showFormatBar, setShowFormatBar] = useState(false)
  const [scheduledMessages, setScheduledMessages] = useState([]) // pending scheduled

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const realtimeRef = useRef(null)

  const profMap = useMemo(() => {
    const m = {}; profiles.forEach(p => { m[p.id] = p }); return m
  }, [profiles])

  const isLeader = ['socio','lider','admin','partner','managing_partner'].includes(profile?.role?.toLowerCase())

  // ── Load ──
  useEffect(() => {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]
    Promise.allSettled([
      supabase.from('chat_channels').select('*').eq('org_id', profile.org_id).order('created_at'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color,role').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('projects').select('id,name,status').eq('org_id', profile.org_id).order('name'),
      supabase.from('check_ins').select('user_id,status').eq('org_id', profile.org_id).eq('date', today).is('check_out_time', null),
    ]).then(([chR, profR, projR, ciR]) => {
      const chs = chR.status==='fulfilled'&&!chR.value.error ? chR.value.data||[] : []
      const FIXED = [
        { name:'# Público',  icon:'💬', description:'Canal geral da equipe' },
        { name:'🚨 Alertas', icon:'🚨', description:'Alertas e comunicados urgentes' },
      ]
      const toCreate = FIXED.filter(f => !chs.find(ch => ch.name===f.name))
      const doSet = (list) => {
        const sorted = [...list].sort((a,b) => a.is_general===b.is_general?0:a.is_general?-1:1)
        setChannels(sorted)
        const pub = sorted.find(ch=>ch.is_general&&!ch.is_archived)||sorted.find(ch=>!ch.is_archived)||sorted[0]
        if(pub) setActiveChannel(pub)
        setLoading(false)
      }
      if(toCreate.length>0) {
        const inserts = toCreate.map(f=>({org_id:profile.org_id,name:f.name,icon:f.icon,description:f.description,is_general:true,project_id:null,is_archived:false,type:'channel'}))
        supabase.from('chat_channels').insert(inserts).select().then(({data:created})=>doSet([...(created||[]),...chs]))
      } else { doSet(chs) }
      if(profR.status==='fulfilled'&&!profR.value.error) setProfilesList(profR.value.data||[])
      if(projR.status==='fulfilled'&&!projR.value.error) setProjects(projR.value.data||[])
      if(ciR.status==='fulfilled'&&!ciR.value.error) setTodayCheckins(ciR.value.data||[])
    })
  }, [profile])

  // ── Auto-archive when project closes ──
  useEffect(() => {
    if(!projects.length||!channels.length) return
    const closed = ['encerrado','concluido','cancelado','fechado','closed','done','completed']
    channels.forEach(ch => {
      if(!ch.project_id||ch.is_archived||ch.is_general) return
      const proj = projects.find(p=>p.id===ch.project_id)
      if(proj&&closed.includes((proj.status||'').toLowerCase())) {
        supabase.from('chat_channels').update({is_archived:true}).eq('id',ch.id)
          .then(({error})=>{ if(!error) setChannels(prev=>prev.map(c=>c.id===ch.id?{...c,is_archived:true}:c)) })
      }
    })
  }, [projects, channels.length])

  // ── Process scheduled messages ──
  useEffect(() => {
    if(!profile) return
    const interval = setInterval(async () => {
      const now = new Date().toISOString()
      const { data } = await supabase.from('chat_messages')
        .select('*').eq('org_id', profile.org_id)
        .eq('is_scheduled', true).lte('scheduled_for', now)
      if(data&&data.length>0) {
        for(const m of data) {
          await supabase.from('chat_messages').update({is_scheduled:false}).eq('id',m.id)
        }
        setScheduledMessages(prev => prev.filter(m => !data.find(d=>d.id===m.id)))
        toast.success(`${data.length} mensagem(ns) agendada(s) enviada(s)`)
        if(activeChannel) loadMessages(activeChannel)
      }
    }, 30000) // check every 30s
    return () => clearInterval(interval)
  }, [profile, activeChannel])

  // ── Load messages ──
  const loadMessages = useCallback(async (ch) => {
    if(!ch||!profile) return
    setLoadingMsgs(true)
    setMessages([])
    const { data } = await supabase.from('chat_messages').select('*')
      .eq('org_id', profile.org_id).eq('channel_id', ch.id)
      .order('created_at', { ascending:true }).limit(200)
    // Filter out pending scheduled messages client-side
    const visible = (data || []).filter(m => !m.is_scheduled)
    const threadCounts = {}
    visible.forEach(m => { if(m.reply_to) threadCounts[m.reply_to]=(threadCounts[m.reply_to]||0)+1 })
    const enriched = visible.map(m=>({...m, _threadCount: threadCounts[m.id]||0}))
    setMessages(enriched)
    setLoadingMsgs(false)
    markChannelRead(ch.id)
  }, [profile])

  useEffect(() => {
    if(!activeChannel) return
    loadMessages(activeChannel)
    setReplyTo(null)
    if(realtimeRef.current) supabase.removeChannel(realtimeRef.current)
    const ch = supabase.channel(`chat-${activeChannel.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'chat_messages',filter:`channel_id=eq.${activeChannel.id}`},
        payload => {
          if(payload.eventType==='INSERT') {
            if(payload.new.is_scheduled) return
            setMessages(prev => {
              const enriched = {...payload.new, _threadCount:0}
              if(payload.new.reply_to) {
                return prev.map(m=>m.id===payload.new.reply_to?{...m,_threadCount:(m._threadCount||0)+1}:m).concat([enriched])
              }
              return [...prev, enriched]
            })
            if(payload.new.sender_id!==profile.id) {
              addToast(profMap[payload.new.sender_id]?.full_name||'Alguém', payload.new.content, activeChannel)
            }
          }
          if(payload.eventType==='UPDATE') {
            setMessages(prev=>prev.map(m=>m.id===payload.new.id?{...m,...payload.new}:m))
          }
          if(payload.eventType==='DELETE') {
            setMessages(prev=>prev.filter(m=>m.id!==payload.old.id))
          }
        }).subscribe()
    realtimeRef.current = ch
    return () => { if(realtimeRef.current) supabase.removeChannel(realtimeRef.current) }
  }, [activeChannel?.id, profile])

  // ── Global realtime ──
  useEffect(() => {
    if(!profile) return
    const globalCh = supabase.channel('chat-global-notif')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages',filter:`org_id=eq.${profile.org_id}`},
        payload => {
          const msg=payload.new
          if(msg.sender_id===profile.id||msg.is_scheduled) return
          if(!activeChannel||msg.channel_id!==activeChannel.id) {
            setUnreadByChannel(prev=>({...prev,[msg.channel_id]:(prev[msg.channel_id]||0)+1}))
            const ch=channels.find(c=>c.id===msg.channel_id)
            addToast(profMap[msg.sender_id]?.full_name||'Alguém', msg.content, ch)
          }
        }).subscribe()
    return () => supabase.removeChannel(globalCh)
  }, [profile, activeChannel?.id, channels.length])

  // ── Push notifications ──
  useEffect(() => {
    if(!profile||!('Notification' in window)) return
    if(Notification.permission==='default') {
      Notification.requestPermission()
    }
  }, [profile])

  // ── Scroll to bottom ──
  useEffect(() => {
    if(messages.length>0) setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),50)
  }, [messages.length])

  // ── Badge sync ──
  const totalUnread = Object.values(unreadByChannel).reduce((a,b)=>a+b,0)
  useEffect(()=>{ setUnreadChat(totalUnread) }, [totalUnread])

  function addToast(senderName, content, channel) {
    const id=Date.now()+Math.random()
    setToasts(prev=>[...prev.slice(-3),{id,senderName,content:(content||'').slice(0,80),channelName:channel?.name||'',channelId:channel?.id}])
    setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),5000)
    // Browser push notification
    if(Notification.permission==='granted'&&document.hidden) {
      new Notification(`${senderName} — ${channel?.name||'Chat'}`,{body:(content||'').slice(0,100),icon:'/vite.svg'})
    }
  }

  async function markChannelRead(channelId) {
    setUnreadByChannel(prev=>({...prev,[channelId]:0}))
    if(!profile?.id) return
    try {
      const {data:unread}=await supabase.from('chat_messages').select('id,read_by')
        .eq('channel_id',channelId).eq('org_id',profile.org_id)
        .not('sender_id','eq',profile.id).order('created_at',{ascending:false}).limit(50)
      if(!unread?.length) return
      const toUpdate=unread.filter(m=>!Array.isArray(m.read_by)||!m.read_by.includes(profile.id))
      for(const msg of toUpdate) {
        const newReadBy=Array.isArray(msg.read_by)?[...msg.read_by,profile.id]:[profile.id]
        await supabase.from('chat_messages').update({read_by:newReadBy}).eq('id',msg.id).eq('org_id',profile.org_id)
      }
    } catch(err) { console.warn('[Chat] markChannelRead:',err.message) }
  }

  // ── DM: create or find ──
  async function openDM(targetUser) {
    if(!targetUser||targetUser.id===profile.id) return
    const dmName = `__dm__${[profile.id,targetUser.id].sort().join('__')}`
    const existing = channels.find(ch=>ch.name===dmName)
    if(existing) { setActiveChannel(existing); return }
    const {data,error}=await supabase.from('chat_channels').insert({
      org_id:profile.org_id, name:dmName,
      icon:'💬', description:`DM: ${profile.full_name} ↔ ${targetUser.full_name}`,
      is_general:false, project_id:null, is_archived:false, type:'dm'
    }).select().single()
    if(error){toast.error('Erro ao criar DM: '+error.message);return}
    if(data) { setChannels(prev=>[...prev,data]); setActiveChannel(data) }
  }

  function getDMOtherUser(channel) {
    if(!channel||channel.type!=='dm') return null
    const parts = channel.name.replace('__dm__','').split('__')
    const otherId = parts.find(id=>id!==profile?.id)
    return profMap[otherId]
  }

  // ── Channel actions ──
  async function archiveChannel(channelId) {
    const ch=channels.find(c=>c.id===channelId); if(!ch) return
    const {error}=await supabase.from('chat_channels').update({is_archived:true}).eq('id',channelId).eq('org_id',profile.org_id)
    if(error){toast.error('Erro: '+error.message);return}
    setChannels(prev=>prev.map(c=>c.id===channelId?{...c,is_archived:true}:c))
    if(activeChannel?.id===channelId) {
      const next=channels.find(c=>c.id!==channelId&&!c.is_archived)
      setActiveChannel(next||null)
    }
    toast.success(`Canal "${ch.name}" arquivado`)
  }

  async function unarchiveChannel(channelId) {
    const ch=channels.find(c=>c.id===channelId); if(!ch) return
    const {error}=await supabase.from('chat_channels').update({is_archived:false}).eq('id',channelId).eq('org_id',profile.org_id)
    if(error){toast.error('Erro: '+error.message);return}
    setChannels(prev=>prev.map(c=>c.id===channelId?{...c,is_archived:false}:c))
    toast.success(`Canal "${ch.name}" desarquivado`)
  }

  async function deleteChannel(channelId) {
    const ch=channels.find(c=>c.id===channelId); if(!ch) return
    const confirmed=await confirm(`Excluir o canal "${ch.name}" e todas as suas mensagens? Esta ação não pode ser desfeita.`)
    if(!confirmed) return
    await supabase.from('chat_messages').delete().eq('channel_id',channelId).eq('org_id',profile.org_id)
    const {error}=await supabase.from('chat_channels').delete().eq('id',channelId).eq('org_id',profile.org_id)
    if(error){toast.error('Erro: '+error.message);return}
    setChannels(prev=>prev.filter(c=>c.id!==channelId))
    if(activeChannel?.id===channelId) setActiveChannel(channels.find(c=>c.id!==channelId&&!c.is_archived)||null)
    toast.success(`Canal "${ch.name}" excluído`)
  }

  function handleRenameSuccess(channelId, newName) {
    setChannels(prev=>prev.map(c=>c.id===channelId?{...c,name:newName}:c))
    if(activeChannel?.id===channelId) setActiveChannel(prev=>({...prev,name:newName}))
    toast.success('Canal renomeado')
  }

  // ── Message actions ──
  async function deleteMessage(msg) {
    const confirmed=await confirm('Excluir esta mensagem?'); if(!confirmed) return
    const {error}=await supabase.from('chat_messages').delete().eq('id',msg.id).eq('org_id',profile.org_id)
    if(error){toast.error('Erro: '+error.message);return}
    setMessages(prev=>prev.filter(m=>m.id!==msg.id))
  }

  function editMessage(msgId, newContent) {
    setMessages(prev=>prev.map(m=>m.id===msgId?{...m,content:newContent,edited_at:new Date().toISOString()}:m))
  }

  function markUnread(msgId) {
    setMarkedUnread(prev=>{
      const next=new Set(prev)
      if(next.has(msgId)) next.delete(msgId); else next.add(msgId)
      return next
    })
  }

  async function handleReact(msgId, emoji) {
    const msg=messages.find(m=>m.id===msgId); if(!msg) return
    const reactions={...(msg.reactions||{})}
    const users=reactions[emoji]?[...reactions[emoji]]:[]
    const idx=users.indexOf(profile.id)
    if(idx>-1) users.splice(idx,1); else users.push(profile.id)
    if(users.length===0) delete reactions[emoji]; else reactions[emoji]=users
    setMessages(prev=>prev.map(m=>m.id===msgId?{...m,reactions}:m))
    const {error}=await supabase.from('chat_messages').update({reactions}).eq('id',msgId).eq('org_id',profile.org_id)
    if(error) setMessages(prev=>prev.map(m=>m.id===msgId?{...m,reactions:msg.reactions}:m))
  }

  async function handlePin(msg) {
    const {error}=await supabase.from('chat_messages').update({is_pinned:!msg.is_pinned}).eq('id',msg.id).eq('org_id',profile.org_id)
    if(error){toast.error('Erro: '+error.message);return}
    setMessages(prev=>prev.map(m=>m.id===msg.id?{...m,is_pinned:!msg.is_pinned}:m))
  }

  // ── Send message ──
  async function sendMessage(overrideText, scheduledFor) {
    const text=(overrideText||input).trim()
    if(!text||!activeChannel||sending) return
    if(activeChannel.is_archived){toast.warning('Canal arquivado — somente leitura');return}
    setSending(true)
    if(!overrideText) { setInput(''); setReplyTo(null); setMentioning(false) }

    const mentionMatches=[...text.matchAll(/@([\w\s]+)/g)]
    let mentions=mentionMatches.map(m=>{
      const found=profiles.find(p=>p.full_name.toLowerCase().startsWith(m[1].toLowerCase()))
      return found?.id
    }).filter(Boolean)

    // @canal → mencionar todos
    if(text.includes('@canal')||text.includes('@channel')) {
      const channelMembers=profiles.map(p=>p.id).filter(id=>id!==profile.id)
      mentions=[...new Set([...mentions,...channelMembers])]
    }

    const payload = {
      org_id:profile.org_id, channel_id:activeChannel.id, sender_id:profile.id,
      content:text, reply_to:replyTo?.id||null, mentions, reactions:{}, read_by:[profile.id],
      is_scheduled:!!scheduledFor, scheduled_for:scheduledFor?.toISOString()||null,
    }

    const {error}=await supabase.from('chat_messages').insert(payload)
    if(error){toast.error('Erro: '+error.message);if(!overrideText)setInput(text)}
    else {
      if(scheduledFor) {
        toast.success(`Mensagem agendada para ${scheduledFor.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`)
      }
      if(mentions.length>0) {
        const notifPayloads=mentions.filter(uid=>uid!==profile.id).map(uid=>({
          org_id:profile.org_id, user_id:uid, type:'mention',
          title:`${profile.full_name||'Alguém'} mencionou você`,
          message:`#${activeChannel.name}: ${text.slice(0,80)}${text.length>80?'…':''}`,
          entity_type:'chat_channel', entity_id:activeChannel.id, is_read:false,
        }))
        if(notifPayloads.length>0) supabase.from('notifications').insert(notifPayloads)
      }
    }
    setSending(false)
    inputRef.current?.focus()
  }

  async function sendThreadReply(text, rootId) {
    if(!text||!activeChannel) return
    await supabase.from('chat_messages').insert({
      org_id:profile.org_id, channel_id:activeChannel.id, sender_id:profile.id,
      content:text, reply_to:rootId, mentions:[], reactions:{}, read_by:[profile.id],
      is_scheduled:false, scheduled_for:null,
    })
    setMessages(prev=>prev.map(m=>m.id===rootId?{...m,_threadCount:(m._threadCount||0)+1}:m))
  }

  // ── AI Summary ──
  async function generateAISummary() {
    if(generatingSummary) return
    setGeneratingSummary(true)
    try {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1); yesterday.setHours(0,0,0,0)
      const allMsgs = []
      for(const ch of channels.filter(c=>!c.is_archived)) {
        const {data}=await supabase.from('chat_messages').select('content,sender_id,created_at,channel_id')
          .eq('org_id',profile.org_id).eq('channel_id',ch.id)
          .gte('created_at',yesterday.toISOString()).eq('is_scheduled',false)
          .order('created_at').limit(50)
        if(data&&data.length>0) allMsgs.push({channel:ch.name, messages:data})
      }
      if(!allMsgs.length||allMsgs.every(c=>c.messages.length===0)) {
        toast.warning('Nenhuma mensagem nas últimas 24h para resumir')
        setGeneratingSummary(false); return
      }
      const transcript = allMsgs.map(c=>`\n## ${c.channel}\n`+c.messages.map(m=>`- ${profMap[m.sender_id]?.full_name||'Alguém'}: ${m.content}`).join('\n')).join('\n')
      const resp = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':import.meta.env.VITE_ANTHROPIC_API_KEY||'','anthropic-version':'2023-06-01'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:600,
          messages:[{role:'user',content:`Você é o assistente interno da BX Finance. Resuma as mensagens dos canais do chat das últimas 24h em no máximo 5 bullets objetivos para o briefing matinal do sócio. Seja conciso e destaque só o que importa operacionalmente.\n\nMensagens:\n${transcript}`}]
        })
      })
      const data=await resp.json()
      const summary=data.content?.[0]?.text||'Não foi possível gerar o resumo.'
      // Post summary in active channel
      await supabase.from('chat_messages').insert({
        org_id:profile.org_id, channel_id:activeChannel.id, sender_id:profile.id,
        content:`🤖 **Resumo das últimas 24h — BX Finance**\n\n${summary}`,
        mentions:[], reactions:{}, read_by:[profile.id], is_scheduled:false, scheduled_for:null,
      })
      toast.success('Resumo gerado e postado no canal')
    } catch(err) {
      toast.error('Erro ao gerar resumo. Verifique a variável VITE_ANTHROPIC_API_KEY.')
      console.error('[AI Summary]',err)
    }
    setGeneratingSummary(false)
  }

  // ── @mention input ──
  function handleInput(e) {
    const val=e.target.value; setInput(val)
    const lastAt=val.lastIndexOf('@')
    if(lastAt>-1) {
      const query=val.slice(lastAt+1)
      if(!query.includes(' ')&&lastAt===val.length-query.length-1) {
        setMentioning(true); setMentionQuery(query); setMentionIndex(0); return
      }
    }
    setMentioning(false)
  }
  function insertMention(p) {
    const lastAt=input.lastIndexOf('@')
    setInput(input.slice(0,lastAt)+'@'+p.full_name+' ')
    setMentioning(false); inputRef.current?.focus()
  }
  const mentionFiltered = mentionQuery
    ? profiles.filter(p=>p.full_name.toLowerCase().includes(mentionQuery.toLowerCase())&&p.id!==profile?.id)
    : [{full_name:'canal',id:'__channel__',avatar_color:'#94A3B8'},...profiles.filter(p=>p.id!==profile?.id)]

  function handleKeyDown(e) {
    if(mentioning) {
      if(e.key==='ArrowDown'){e.preventDefault();setMentionIndex(i=>Math.min(i+1,mentionFiltered.length-1))}
      if(e.key==='ArrowUp'){e.preventDefault();setMentionIndex(i=>Math.max(i-1,0))}
      if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();if(mentionFiltered[mentionIndex])insertMention(mentionFiltered[mentionIndex]);return}
      if(e.key==='Escape'){setMentioning(false);return}
    }
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}
  }

  // ── Group messages ──
  function groupMessages(msgs) {
    const items=[]; let lastDate=null, lastGroup=null
    msgs.filter(m=>!search||m.content?.toLowerCase().includes(search.toLowerCase())).forEach(msg=>{
      const dateStr=fmtDate(msg.created_at)
      if(dateStr!==lastDate){items.push({type:'divider',label:dateStr});lastDate=dateStr;lastGroup=null}
      const sameAuthor=lastGroup&&lastGroup.sender_id===msg.sender_id
      const timeDiff=lastGroup?(new Date(msg.created_at)-new Date(lastGroup.messages[lastGroup.messages.length-1].created_at))/60000:999
      if(sameAuthor&&timeDiff<5){lastGroup.messages.push(msg)}
      else{const g={type:'group',sender_id:msg.sender_id,messages:[msg]};items.push(g);lastGroup=g}
    })
    return items
  }

  const pinnedMessages = messages.filter(m=>m.is_pinned)
  const activeChannels = channels.filter(ch=>!ch.is_archived&&ch.type!=='dm')
  const dmChannels = channels.filter(ch=>ch.type==='dm')
  const archivedChannels = channels.filter(ch=>ch.is_archived)
  const onlineIds = new Set(todayCheckins.map(c=>c.user_id))
  const onlineCount = profiles.filter(p=>onlineIds.has(p.id)).length
  const isAlertChannel = activeChannel?.name?.includes('Alerta')
  const isPublicChannel = activeChannel?.is_general

  // ── Render channel row ──
  function renderChannel(ch) {
    const isActive=activeChannel?.id===ch.id
    const unread=unreadByChannel[ch.id]||0
    const menuOpen=channelMenu?.channelId===ch.id
    const isDM=ch.type==='dm'
    const dmOther=isDM?getDMOtherUser(ch):null
    const displayName=isDM?(dmOther?.full_name||ch.name):ch.name
    const showMenu=!isDM

    return (
      <div key={ch.id} className="relative group/ch">
        <button onClick={()=>{setActiveChannel(ch);markChannelRead(ch.id)}}
          className={`w-full text-left flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg transition-all ${isActive?'text-white':'text-zinc-400 hover:text-white hover:bg-white/5'} ${ch.is_archived?'opacity-60':''}`}
          style={{width:'calc(100% - 8px)',background:isActive?VL:'transparent'}}>
          {isDM ? (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
              style={{background:dmOther?.avatar_color||VL}}>{initials(dmOther?.full_name)}</div>
          ) : (
            <span className="text-base w-5 text-center shrink-0">{ch.icon||'#'}</span>
          )}
          <span className="text-xs font-medium flex-1 truncate">{displayName}</span>
          {ch.is_archived&&<Archive className="w-3 h-3 text-zinc-500 shrink-0"/>}
          {unread>0&&!ch.is_archived&&(
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
              {unread>99?'99+':unread}
            </span>
          )}
        </button>
        {showMenu&&(
          <button onClick={e=>{e.stopPropagation();if(menuOpen){setChannelMenu(null)}else{const r=e.currentTarget.getBoundingClientRect();setChannelMenu({channelId:ch.id,x:r.right+4,y:r.top})}}}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-white/10 ${menuOpen?'opacity-100':'opacity-0 group-hover/ch:opacity-100'}`}>
            <MoreHorizontal className="w-3.5 h-3.5"/>
          </button>
        )}
        {menuOpen&&(
          <ChannelMenu channel={ch} isLeader={isLeader}
            position={channelMenu}
            onArchive={()=>archiveChannel(ch.id)}
            onUnarchive={()=>unarchiveChannel(ch.id)}
            onDelete={()=>deleteChannel(ch.id)}
            onRename={()=>setRenamingChannel(ch)}
            onClose={()=>setChannelMenu(null)} />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden font-['Montserrat',system-ui,sans-serif]">

      {/* ══════════ SIDEBAR ══════════ */}
      <div className="w-64 shrink-0 flex flex-col overflow-hidden" style={{background:CH}}>
        <div className="px-4 py-3.5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2"><span>💬</span> BX Chat</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{onlineCount} online agora</div>
            </div>
            <div className="flex gap-1">
              <button onClick={()=>setShowGlobalSearch(true)} title="Busca global"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <Globe className="w-3.5 h-3.5"/>
              </button>
              <button onClick={()=>setShowNewChannel(true)} title="Novo canal"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <Plus className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-white/5">
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
            <Search className="w-3 h-3 text-zinc-400 shrink-0"/>
            <input className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 outline-none"
              placeholder="Buscar mensagens…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1" onClick={()=>setChannelMenu(null)}>
          {loading ? (
            <div className="px-4 py-2 text-xs text-zinc-500">Carregando…</div>
          ) : (
            <>
              <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Geral</div>
              {activeChannels.filter(ch=>ch.is_general).map(renderChannel)}

              {activeChannels.filter(ch=>!ch.is_general).length>0&&(
                <>
                  <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Projetos</div>
                  {activeChannels.filter(ch=>!ch.is_general).map(renderChannel)}
                </>
              )}

              {/* DMs */}
              <button onClick={()=>setShowDMs(p=>!p)}
                className="w-full flex items-center gap-2 px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400">
                {showDMs?<ChevronDown className="w-3 h-3"/>:<ChevronRight className="w-3 h-3"/>}
                Mensagens Diretas
              </button>
              {showDMs&&(
                <>
                  {dmChannels.map(renderChannel)}
                  <div className="px-3 py-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-1 px-1">Nova DM</div>
                    {profiles.filter(p=>p.id!==profile?.id).slice(0,8).map(p=>(
                      <button key={p.id} onClick={()=>openDM(p)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                          style={{background:p.avatar_color||VL}}>{initials(p.full_name)}</div>
                        <span className="text-xs truncate">{p.full_name?.split(' ')[0]}</span>
                        {onlineIds.has(p.id)&&<div className="w-1.5 h-1.5 rounded-full bg-green-400 ml-auto shrink-0"/>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Arquivados */}
              {archivedChannels.length>0&&(
                <>
                  <button onClick={()=>setShowArchived(p=>!p)}
                    className="w-full flex items-center gap-2 px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400">
                    {showArchived?<ChevronDown className="w-3 h-3"/>:<ChevronRight className="w-3 h-3"/>}
                    Arquivados ({archivedChannels.length})
                  </button>
                  {showArchived&&archivedChannels.map(renderChannel)}
                </>
              )}
            </>
          )}
        </div>

        <div className="border-t border-white/10 px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Equipe hoje</div>
          <div className="flex flex-wrap gap-1.5">
            {profiles.map(p=>{
              const isOnline=onlineIds.has(p.id)
              const ci=todayCheckins.find(c=>c.user_id===p.id)
              const statusIcons={escritorio:'🏢',cliente:'🤝',remoto:'🏠',viagem:'✈️'}
              return (
                <div key={p.id} title={`${p.full_name}${ci?' — '+(statusIcons[ci.status]||'📍'):''}`}
                  className="relative cursor-pointer" onClick={()=>openDM(p)}>
                  <Avatar profile={p} size={28}/>
                  {isOnline&&(
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-zinc-800 flex items-center justify-center"
                      style={{background:'#22C55E',fontSize:7}}>
                      {ci?statusIcons[ci.status]||'●':'●'}
                    </div>
                  )}
                  {!isOnline&&<div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-zinc-600 border border-zinc-800"/>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-white/10 px-3 py-2.5 flex items-center gap-2.5">
          <Avatar profile={profile} size={30} showStatus isOnline/>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{profile?.full_name}</div>
            <div className="text-[9px] text-green-400 font-semibold">● Online</div>
          </div>
        </div>
      </div>

      {/* ══════════ MAIN ══════════ */}
      <div className="flex-1 flex flex-col bg-white min-w-0">

        {/* Channel header */}
        {activeChannel ? (
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{background:'#F4F5F9'}}>
                {activeChannel.type==='dm'?'💬':activeChannel.icon||'#'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-zinc-800">
                    {activeChannel.type==='dm' ? `💬 ${getDMOtherUser(activeChannel)?.full_name||'DM'}` : activeChannel.name}
                  </div>
                  {activeChannel.is_archived&&(
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <Archive className="w-2.5 h-2.5"/>Arquivado
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {activeChannel.description||`${messages.length} mensagens`}
                  {pinnedMessages.length>0&&` · 📌 ${pinnedMessages.length} fixada${pinnedMessages.length>1?'s':''}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeChannel.is_archived&&isLeader&&(
                <button onClick={()=>unarchiveChannel(activeChannel.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">
                  <ArchiveRestore className="w-3 h-3"/> Desarquivar
                </button>
              )}
              {isPublicChannel&&(
                <button onClick={generateAISummary} disabled={generatingSummary}
                  title="Gerar resumo IA das últimas 24h"
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50">
                  <Sparkles className="w-3 h-3"/>
                  {generatingSummary?'Gerando…':'Resumo IA'}
                </button>
              )}
              {pinnedMessages.length>0&&(
                <button onClick={()=>setShowPinned(p=>!p)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${showPinned?'bg-amber-100 text-amber-700':'text-zinc-500 hover:bg-zinc-100'}`}>
                  <Pin className="w-3 h-3"/>{pinnedMessages.length}
                </button>
              )}
              <button onClick={()=>navigate('/time')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500">
                <Users className="w-4 h-4"/>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center px-5 py-3 border-b border-zinc-100 shrink-0">
            <div className="text-sm font-bold text-zinc-800">BX Chat</div>
          </div>
        )}

        {/* Pinned panel */}
        {showPinned&&pinnedMessages.length>0&&(
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1">
              <Pin className="w-3 h-3"/>MENSAGENS FIXADAS
            </div>
            {pinnedMessages.map(m=>(
              <div key={m.id} className="text-xs text-zinc-700 py-1 border-b border-amber-100 last:border-0">
                <span className="font-semibold text-zinc-900">{profMap[m.sender_id]?.full_name}: </span>
                {(m.content||'').slice(0,100)}
              </div>
            ))}
          </div>
        )}

        {/* Archived banner */}
        {activeChannel?.is_archived&&(
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-2.5 shrink-0 flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600 shrink-0"/>
            <span className="text-xs text-amber-700 font-semibold">Este canal está arquivado. As mensagens são somente leitura.</span>
          </div>
        )}

        {/* Messages + Thread panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto py-3" style={{background:'#FAFBFC'}}>
            {!activeChannel ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-4">💬</div>
                  <div className="text-sm font-bold text-zinc-600">Selecione um canal</div>
                  <div className="text-xs text-zinc-400 mt-1">para começar a conversar</div>
                </div>
              </div>
            ) : loadingMsgs ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-400">Carregando mensagens…</div>
            ) : messages.filter(m=>!search||m.content?.toLowerCase().includes(search.toLowerCase())).length===0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-3">{activeChannel.icon||'💬'}</div>
                  <div className="text-sm font-bold text-zinc-600">{search?'Nenhuma mensagem encontrada':`Bem-vindo ao #${activeChannel.name}`}</div>
                  <div className="text-xs text-zinc-400 mt-1">{search?'Tente outros termos':'Seja o primeiro a enviar uma mensagem'}</div>
                </div>
              </div>
            ) : (
              <div>
                {groupMessages(messages).map((item,idx)=>{
                  if(item.type==='divider') return (
                    <div key={`d-${idx}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 h-px bg-zinc-200"/>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-100 px-3 py-1 rounded-full">{item.label}</span>
                      <div className="flex-1 h-px bg-zinc-200"/>
                    </div>
                  )
                  const mine=item.sender_id===profile?.id
                  const author=profMap[item.sender_id]
                  return (
                    <div key={`g-${idx}`}>
                      {item.messages.map(msg=>{
                        const replyMsg=msg.reply_to?messages.find(m=>m.id===msg.reply_to):null
                        const replyAuthor=replyMsg?profMap[replyMsg.sender_id]:null
                        return (
                          <div key={msg.id}>
                            {replyMsg&&(
                              <div className={`flex items-center gap-2 px-4 pb-0 pt-2 text-xs text-zinc-400 ${mine?'flex-row-reverse':''}`}>
                                <Reply className="w-3 h-3"/>
                                <span className="font-semibold">{replyAuthor?.full_name?.split(' ')[0]}</span>
                                <span className="truncate max-w-[200px]">{(replyMsg.content||'').slice(0,50)}</span>
                              </div>
                            )}
                            <Message key={msg.id} msg={msg} mine={mine} isLeader={isLeader}
                              author={author} profMap={profMap}
                              onReact={handleReact} onReply={setReplyTo}
                              onPin={handlePin} onDelete={deleteMessage}
                              onEdit={editMessage} onMarkUnread={markUnread}
                              onOpenThread={setThreadMsg}
                              isAlertChannel={isAlertChannel}
                              markedUnread={markedUnread.has(msg.id)} />
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                <div ref={bottomRef} className="h-4"/>
              </div>
            )}
          </div>

          {/* Thread Panel */}
          {threadMsg&&(
            <ThreadPanel
              rootMsg={threadMsg} messages={messages} profile={profile} profMap={profMap}
              onClose={()=>setThreadMsg(null)} onSendReply={sendThreadReply}
              onReact={handleReact} onPin={handlePin} onDelete={deleteMessage} isLeader={isLeader} />
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-zinc-100 bg-white px-4 py-3 shrink-0">
          {replyTo&&(
            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 mb-2">
              <Reply className="w-3 h-3 text-violet-500 shrink-0"/>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-violet-600">{profMap[replyTo.sender_id]?.full_name}</span>
                <span className="text-xs text-zinc-500 ml-1">{(replyTo.content||'').slice(0,60)}</span>
              </div>
              <button onClick={()=>setReplyTo(null)} className="text-violet-400 hover:text-violet-600"><X className="w-3.5 h-3.5"/></button>
            </div>
          )}

          {mentioning&&mentionFiltered.length>0&&(
            <div className="bg-white border border-zinc-200 rounded-xl shadow-lg mb-2 overflow-hidden max-h-48 overflow-y-auto">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 border-b border-zinc-100">Mencionar</div>
              {mentionFiltered.slice(0,7).map((p,i)=>(
                <button key={p.id} onClick={()=>insertMention(p)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm ${i===mentionIndex?'bg-violet-50':'hover:bg-zinc-50'}`}>
                  {p.id==='__channel__'
                    ? <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-xs">📢</div>
                    : <Avatar profile={p} size={24}/>
                  }
                  <div>
                    <div className="font-semibold text-zinc-800 text-xs">{p.id==='__channel__'?'canal (notificar todos)':p.full_name}</div>
                    {p.id!=='__channel__'&&<div className="text-[10px] text-zinc-400">{p.role}</div>}
                  </div>
                  {p.id!=='__channel__'&&onlineIds.has(p.id)&&<div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400"/>}
                </button>
              ))}
            </div>
          )}

          <div className={`rounded-2xl border transition-all ${activeChannel?.is_archived?'bg-zinc-100 border-zinc-200 opacity-60':'bg-zinc-50 border-zinc-200 focus-within:border-violet-300 focus-within:bg-white'} overflow-hidden`}>
            {showFormatBar&&!activeChannel?.is_archived&&(
              <FormatToolbar inputRef={inputRef} value={input} onChange={setInput}/>
            )}
            <div className="flex items-end gap-2 px-4 py-2.5">
              <button onClick={()=>setShowFormatBar(p=>!p)} title="Formatação"
                className={`text-zinc-400 hover:text-violet-500 shrink-0 pb-0.5 ${showFormatBar?'text-violet-500':''}`}>
                <Bold className="w-4 h-4"/>
              </button>
              <button onClick={()=>{if(activeChannel?.is_archived)return;setInput(prev=>prev+'@');inputRef.current?.focus();setMentioning(true);setMentionQuery('')}}
                className="text-zinc-400 hover:text-violet-500 shrink-0 pb-0.5">
                <AtSign className="w-4 h-4"/>
              </button>
              <textarea ref={inputRef} rows={1}
                className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-zinc-400 max-h-32 py-0.5 leading-relaxed"
                placeholder={activeChannel?.is_archived?'Canal arquivado — somente leitura':activeChannel?`Mensagem em ${activeChannel.icon||'#'}${activeChannel.name}…`:'Selecione um canal…'}
                disabled={!activeChannel||activeChannel.is_archived}
                value={input} onChange={handleInput} onKeyDown={handleKeyDown}
                style={{minHeight:24}}/>
              <button onClick={()=>setShowScheduleModal(true)} disabled={!input.trim()||!activeChannel||activeChannel.is_archived}
                title="Agendar mensagem"
                className="text-zinc-400 hover:text-violet-500 shrink-0 pb-0.5 disabled:opacity-30">
                <Clock className="w-4 h-4"/>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1 px-1">
            {!activeChannel?.is_archived&&(
              <div className="text-[10px] text-zinc-400">
                Enter para enviar · Shift+Enter para quebrar · @ para mencionar · **bold** *italic* `code`
              </div>
            )}
            <button onClick={sendMessage} disabled={!input.trim()||!activeChannel||sending||activeChannel?.is_archived}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white ml-auto disabled:opacity-40 shadow-sm"
              style={{background:input.trim()&&!activeChannel?.is_archived?VL:'#CBD5E1'}}>
              <Send className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════ TOASTS ══════════ */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t=>(
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-3 w-80"
            style={{animation:'slideInRight 0.3s ease'}}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{background:VL}}>{initials(t.senderName)}</div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>{
              const ch=channels.find(c=>c.id===t.channelId)
              if(ch){setActiveChannel(ch);markChannelRead(ch.id)}
            }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-bold text-zinc-800 truncate">{t.senderName}</span>
                <span className="text-[9px] text-zinc-400 shrink-0 ml-2">{t.channelName&&`#${t.channelName}`}</span>
              </div>
              <p className="text-xs text-zinc-600 line-clamp-2">{t.content}</p>
            </div>
            <button onClick={()=>setToasts(p=>p.filter(x=>x.id!==t.id))} className="text-zinc-300 hover:text-zinc-500 shrink-0">
              <X className="w-3.5 h-3.5"/>
            </button>
          </div>
        ))}
      </div>

      {/* Modals */}
      {showNewChannel&&(
        <NewChannelModal profile={profile} projects={projects}
          onCreated={ch=>{setChannels(prev=>[...prev,ch]);setActiveChannel(ch);setShowNewChannel(false)}}
          onClose={()=>setShowNewChannel(false)}/>
      )}
      {renamingChannel&&(
        <RenameModal channel={renamingChannel} onSave={handleRenameSuccess} onClose={()=>setRenamingChannel(null)}/>
      )}
      {showGlobalSearch&&(
        <GlobalSearchModal channels={channels} profMap={profMap} orgId={profile?.org_id}
          onSelect={(msg,ch)=>{if(ch){setActiveChannel(ch);markChannelRead(ch.id)}setShowGlobalSearch(false)}}
          onClose={()=>setShowGlobalSearch(false)}/>
      )}
      {showScheduleModal&&(
        <ScheduleModal
          onSchedule={(text,date)=>sendMessage(text,date)}
          onClose={()=>setShowScheduleModal(false)}/>
      )}

      <style>{`
        @keyframes slideInRight { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
      `}</style>
    </div>
  )
}
