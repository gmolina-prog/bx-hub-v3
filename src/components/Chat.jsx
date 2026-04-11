import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Hash, Send, Plus, X, Search, Pin, Reply, Smile, MoreHorizontal,
  Users, Check, CheckCheck, Archive, Trash2, Edit3, ChevronDown,
  ChevronRight, AlertCircle, AtSign, ArchiveRestore
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
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(d) {
  const dt = new Date(d)
  const today = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (dt >= today) return 'Hoje'
  if (dt >= yesterday) return 'Ontem'
  return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ profile, size = 32, showStatus = false, isOnline = false }) {
  const sz = { width: size, height: size, minWidth: size, fontSize: size * 0.35 }
  return (
    <div className="relative inline-flex shrink-0">
      <div className="rounded-full flex items-center justify-center font-bold text-white"
        style={{ ...sz, background: profile?.avatar_color || VL }}>
        {initials(profile?.full_name)}
      </div>
      {showStatus && (
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${isOnline ? 'bg-green-400' : 'bg-zinc-400'}`}
          style={{ borderColor: '#fff' }} />
      )}
    </div>
  )
}

// ─── Channel Context Menu ─────────────────────────────────────────────────────
function ChannelMenu({ channel, isLeader, onArchive, onUnarchive, onDelete, onRename, onClose }) {
  const menuRef = useRef(null)
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={menuRef}
      className="absolute left-full top-0 ml-1 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 py-1 w-44 overflow-hidden"
      onClick={e => e.stopPropagation()}>
      {!channel.is_general && (
        <button onClick={() => { onRename(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors">
          <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
          Renomear canal
        </button>
      )}
      {!channel.is_archived ? (
        <button onClick={() => { onArchive(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors">
          <Archive className="w-3.5 h-3.5 text-zinc-400" />
          Arquivar canal
        </button>
      ) : (
        <button onClick={() => { onUnarchive(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors">
          <ArchiveRestore className="w-3.5 h-3.5 text-zinc-400" />
          Desarquivar
        </button>
      )}
      {isLeader && !channel.is_general && (
        <>
          <div className="h-px bg-zinc-100 mx-2 my-1" />
          <button onClick={() => { onDelete(); onClose() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            Excluir canal
          </button>
        </>
      )}
    </div>
  )
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────
function RenameModal({ channel, onSave, onClose }) {
  const [name, setName] = useState(channel.name)
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!name.trim() || name.trim() === channel.name) { onClose(); return }
    setSaving(true)
    const { error } = await supabase.from('chat_channels')
      .update({ name: name.trim() })
      .eq('id', channel.id)
    if (error) { toast.error('Erro ao renomear: ' + error.message); setSaving(false); return }
    onSave(channel.id, name.trim())
    setSaving(false)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-sm font-bold text-zinc-800 mb-4">Renomear canal</h3>
        <input autoFocus
          className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 mb-4"
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()} />
        <div className="flex gap-3">
          <button onClick={save} disabled={saving || !name.trim()}
            className="flex-1 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50"
            style={{ background: VL }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── New Channel Modal ────────────────────────────────────────────────────────
function NewChannelModal({ profile, projects, onCreated, onClose }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [projectId, setProjectId] = useState('')
  const [icon, setIcon] = useState('💬')
  const [saving, setSaving] = useState(false)
  const ICONS = ['💬','📁','🎯','🔥','⚡','🏢','📊','🤝','💡','⚠️','✅','🧠']

  async function create() {
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('chat_channels').insert({
      org_id: profile.org_id, name: name.trim(), description: desc.trim() || null,
      icon, project_id: projectId || null, is_general: false, is_archived: false,
    }).select().single()
    if (error) { toast.error('Erro ao criar canal: ' + error.message); setSaving(false); return }
    if (data) onCreated(data)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-zinc-800">Novo Canal</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Ícone</label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${icon === ic ? 'ring-2 ring-violet-500 bg-violet-50' : 'hover:bg-zinc-100'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nome *</label>
            <input autoFocus className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              placeholder="ex: marketing, financeiro…" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Descrição</label>
            <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              placeholder="Para que serve este canal?" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Projeto vinculado</label>
            <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">— nenhum —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={create} disabled={saving || !name.trim()}
              className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50"
              style={{ background: VL }}>
              {saving ? 'Criando…' : 'Criar canal'}
            </button>
            <button onClick={onClose} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Message Component ────────────────────────────────────────────────────────
function Message({ msg, mine, isLeader, author, allProfiles, onReact, onReply, onPin, onDelete, replyMsg, replyAuthor }) {
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const isRead = Array.isArray(msg.read_by) && msg.read_by.length > 0
  const isPinned = msg.is_pinned
  const canDelete = mine || isLeader
  const reactions = msg.reactions && typeof msg.reactions === 'object'
    ? Object.entries(msg.reactions) : []

  return (
    <div className={`group flex gap-2.5 px-4 py-1 hover:bg-zinc-50/80 transition-colors relative ${mine ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false) }}>

      {!mine && <div className="shrink-0 mt-0.5"><Avatar profile={author} size={32} /></div>}

      <div className={`flex flex-col max-w-[72%] ${mine ? 'items-end' : ''}`}>
        {!mine && (
          <div className="flex items-center gap-2 mb-0.5 px-1">
            <span className="text-xs font-bold text-zinc-700">{author?.full_name}</span>
            <span className="text-[10px] text-zinc-400">{fmtTime(msg.created_at)}</span>
            {isPinned && <span className="text-[9px] text-amber-500 font-bold">📌 fixada</span>}
          </div>
        )}

        {replyMsg && (
          <div className={`text-xs border-l-2 pl-2 py-1 mb-1 rounded-r-md mx-1 ${mine ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-zinc-300 bg-zinc-100 text-zinc-600'}`}>
            <span className="font-semibold">{replyAuthor?.full_name || 'Usuário'}: </span>
            {(replyMsg.content || '').slice(0, 60)}{replyMsg.content?.length > 60 ? '…' : ''}
          </div>
        )}

        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${mine ? 'text-white rounded-tr-sm' : 'bg-white text-zinc-800 rounded-tl-sm border border-zinc-100'}`}
          style={mine ? { background: VL } : {}}>
          <div dangerouslySetInnerHTML={{
            __html: (msg.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/@(\S+(\s\S+)?)/g, '<span style="font-weight:700;color:' + (mine ? '#C4B5FD' : VL) + '">@$1</span>')
          }} />
          {mine && (
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-violet-200">{fmtTime(msg.created_at)}</span>
              {isRead ? <CheckCheck className="w-3 h-3 text-violet-200" /> : <Check className="w-3 h-3 text-violet-300" />}
            </div>
          )}
        </div>

        {reactions.length > 0 && (
          <div className={`flex gap-1 mt-1 flex-wrap ${mine ? 'justify-end' : ''}`}>
            {reactions.map(([emoji, users]) => (
              <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                className="flex items-center gap-1 bg-white border border-zinc-200 rounded-full px-2 py-0.5 text-xs hover:border-violet-300 shadow-sm">
                <span>{emoji}</span>
                <span className="text-zinc-600 font-semibold">{Array.isArray(users) ? users.length : users}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showActions && (
        <div className={`absolute top-1 flex items-center gap-0.5 bg-white border border-zinc-200 rounded-xl shadow-lg px-1 py-0.5 z-20 ${mine ? 'left-4' : 'right-4'}`}>
          <div className="relative">
            <button onClick={() => setShowEmojiPicker(p => !p)} title="Reagir"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800">
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmojiPicker && (
              <div className={`absolute top-8 ${mine ? 'right-0' : 'left-0'} bg-white border border-zinc-200 rounded-xl shadow-xl p-2 flex gap-1 z-30`}>
                {REACTIONS_LIST.map(em => (
                  <button key={em} onClick={() => { onReact(msg.id, em); setShowEmojiPicker(false) }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-lg">
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onReply(msg)} title="Responder"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800">
            <Reply className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onPin(msg)} title="Fixar"
            className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 ${msg.is_pinned ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-800'}`}>
            <Pin className="w-3.5 h-3.5" />
          </button>
          {canDelete && (
            <button onClick={() => onDelete(msg)} title="Excluir mensagem"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-500">
              <Trash2 className="w-3.5 h-3.5" />
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
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [projects, setProjects] = useState([])
  const [todayCheckins, setTodayCheckins] = useState([])
  const [unreadByChannel, setUnreadByChannel] = useState({})
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
  const [channelMenu, setChannelMenu] = useState(null) // { channelId }
  const [renamingChannel, setRenamingChannel] = useState(null)
  const [toasts, setToasts] = useState([])
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const realtimeRef = useRef(null)

  const profMap = {}; profiles.forEach(p => { profMap[p.id] = p })
  const isLeader = ['socio', 'lider', 'admin', 'partner', 'managing_partner'].includes(profile?.role?.toLowerCase())

  usePageTitle('Chat')

  // ── Load initial data ──
  useEffect(() => {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]
    Promise.allSettled([
      supabase.from('chat_channels').select('*').eq('org_id', profile.org_id).order('created_at'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color,role').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('projects').select('id,name,status').eq('org_id', profile.org_id).order('name'),
      supabase.from('check_ins').select('user_id,status').eq('org_id', profile.org_id).eq('date', today).is('check_out_time', null),
    ]).then(([chR, profR, projR, ciR]) => {
      const chs = chR.status === 'fulfilled' && !chR.value.error ? chR.value.data || [] : []

      const FIXED = [
        { slug: 'publico', name: '# Público',  icon: '💬', description: 'Canal geral da equipe' },
        { slug: 'alertas', name: '🚨 Alertas', icon: '🚨', description: 'Alertas e comunicados urgentes' },
      ]
      const toCreate = FIXED.filter(f => !chs.find(ch => ch.name === f.name))
      const doSetChannels = (list) => {
        const sorted = [...list].sort((a,b) =>
          a.is_general === b.is_general ? 0 : a.is_general ? -1 : 1
        )
        setChannels(sorted)
        const pub = sorted.find(ch => ch.is_general && !ch.is_archived) || sorted.find(ch => !ch.is_archived) || sorted[0]
        if (pub) setActiveChannel(pub)
        setLoading(false)
      }
      if (toCreate.length > 0) {
        const inserts = toCreate.map(f => ({
          org_id: profile.org_id, name: f.name, icon: f.icon,
          description: f.description, is_general: true, project_id: null, is_archived: false,
        }))
        supabase.from('chat_channels').insert(inserts).select().then(({ data: created }) => {
          doSetChannels([...(created || []), ...chs])
        })
      } else {
        doSetChannels(chs)
      }
      if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
      if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
      if (ciR.status === 'fulfilled' && !ciR.value.error) setTodayCheckins(ciR.value.data || [])
    })
  }, [profile])

  // ── Auto-archive channels when linked project is closed/encerrado ──
  useEffect(() => {
    if (!projects.length || !channels.length) return
    const closedStatuses = ['encerrado', 'concluido', 'cancelado', 'fechado', 'closed', 'done', 'completed']
    channels.forEach(ch => {
      if (!ch.project_id || ch.is_archived || ch.is_general) return
      const proj = projects.find(p => p.id === ch.project_id)
      if (proj && closedStatuses.includes((proj.status || '').toLowerCase())) {
        // Auto-archive silently
        supabase.from('chat_channels')
          .update({ is_archived: true })
          .eq('id', ch.id)
          .then(({ error }) => {
            if (!error) {
              setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, is_archived: true } : c))
            }
          })
      }
    })
  }, [projects, channels.length])

  // ── Load messages for active channel ──
  useEffect(() => {
    if (!activeChannel || !profile) return
    setLoadingMsgs(true)
    setMessages([])
    setReplyTo(null)

    supabase.from('chat_messages').select('*')
      .eq('org_id', profile.org_id).eq('channel_id', activeChannel.id)
      .order('created_at', { ascending: true }).limit(200)
      .then(({ data }) => {
        setMessages(prev => {
          const loaded = data || []
          if (prev.length === 0) return loaded
          const ids = new Set(loaded.map(m => m.id))
          const extras = prev.filter(m => !ids.has(m.id))
          return [...loaded, ...extras].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
        })
        setLoadingMsgs(false)
        markChannelRead(activeChannel.id)
      })

    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)
    const ch = supabase.channel(`chat-${activeChannel.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new])
          if (payload.new.sender_id !== profile.id) {
            const sender = profMap[payload.new.sender_id]
            addToast(sender?.full_name || 'Alguém', payload.new.content, activeChannel)
          }
        }
        if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
        }
        if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      })
      .subscribe()
    realtimeRef.current = ch
    return () => { if (realtimeRef.current) supabase.removeChannel(realtimeRef.current) }
  }, [activeChannel?.id, profile])

  // ── Global realtime ──
  useEffect(() => {
    if (!profile) return
    const globalCh = supabase.channel('chat-global-notif')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `org_id=eq.${profile.org_id}`,
      }, payload => {
        const msg = payload.new
        if (msg.sender_id === profile.id) return
        if (!activeChannel || msg.channel_id !== activeChannel.id) {
          setUnreadByChannel(prev => ({ ...prev, [msg.channel_id]: (prev[msg.channel_id] || 0) + 1 }))
          const sender = profMap[msg.sender_id]
          const ch = channels.find(c => c.id === msg.channel_id)
          addToast(sender?.full_name || 'Alguém', msg.content, ch)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(globalCh)
  }, [profile, activeChannel?.id, channels.length])

  // ── Scroll to bottom ──
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages])

  // ── Badge sync ──
  const totalUnread = Object.values(unreadByChannel).reduce((a,b) => a+b, 0)
  useEffect(() => { setUnreadChat(totalUnread) }, [totalUnread])

  function addToast(senderName, content, channel) {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-3), { id, senderName, content: (content||'').slice(0,80), channelName: channel?.name||'', channelId: channel?.id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  async function markChannelRead(channelId) {
    setUnreadByChannel(prev => ({ ...prev, [channelId]: 0 }))
    if (!profile?.id) return
    try {
      const { data: unread } = await supabase.from('chat_messages').select('id,read_by')
        .eq('channel_id', channelId).eq('org_id', profile.org_id)
        .not('sender_id', 'eq', profile.id).order('created_at', { ascending: false }).limit(50)
      if (!unread?.length) return
      const toUpdate = unread.filter(m => !Array.isArray(m.read_by) || !m.read_by.includes(profile.id))
      for (const msg of toUpdate) {
        const newReadBy = Array.isArray(msg.read_by) ? [...msg.read_by, profile.id] : [profile.id]
        await supabase.from('chat_messages').update({ read_by: newReadBy }).eq('id', msg.id).eq('org_id', profile.org_id)
      }
    } catch (err) { console.warn('[Chat] markChannelRead:', err.message) }
  }

  // ── Archive channel ──
  async function archiveChannel(channelId) {
    const ch = channels.find(c => c.id === channelId)
    if (!ch) return
    const { error } = await supabase.from('chat_channels')
      .update({ is_archived: true })
      .eq('id', channelId).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao arquivar: ' + error.message); return }
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, is_archived: true } : c))
    if (activeChannel?.id === channelId) {
      const next = channels.find(c => c.id !== channelId && !c.is_archived)
      setActiveChannel(next || null)
    }
    toast.success(`Canal "${ch.name}" arquivado`)
  }

  // ── Unarchive channel ──
  async function unarchiveChannel(channelId) {
    const ch = channels.find(c => c.id === channelId)
    if (!ch) return
    const { error } = await supabase.from('chat_channels')
      .update({ is_archived: false })
      .eq('id', channelId).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao desarquivar: ' + error.message); return }
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, is_archived: false } : c))
    toast.success(`Canal "${ch.name}" desarquivado`)
  }

  // ── Delete channel ──
  async function deleteChannel(channelId) {
    const ch = channels.find(c => c.id === channelId)
    if (!ch) return
    const confirmed = await confirm(`Excluir o canal "${ch.name}" e todas as suas mensagens? Esta ação não pode ser desfeita.`)
    if (!confirmed) return
    // Delete messages first
    await supabase.from('chat_messages').delete().eq('channel_id', channelId).eq('org_id', profile.org_id)
    const { error } = await supabase.from('chat_channels').delete().eq('id', channelId).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao excluir canal: ' + error.message); return }
    setChannels(prev => prev.filter(c => c.id !== channelId))
    if (activeChannel?.id === channelId) {
      const next = channels.find(c => c.id !== channelId && !c.is_archived)
      setActiveChannel(next || null)
    }
    toast.success(`Canal "${ch.name}" excluído`)
  }

  // ── Rename channel ──
  function handleRenameSuccess(channelId, newName) {
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, name: newName } : c))
    if (activeChannel?.id === channelId) setActiveChannel(prev => ({ ...prev, name: newName }))
    toast.success('Canal renomeado')
  }

  // ── Delete message ──
  async function deleteMessage(msg) {
    const confirmed = await confirm('Excluir esta mensagem?')
    if (!confirmed) return
    const { error } = await supabase.from('chat_messages')
      .delete().eq('id', msg.id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao excluir mensagem: ' + error.message); return }
    setMessages(prev => prev.filter(m => m.id !== msg.id))
  }

  // ── Send message ──
  async function sendMessage() {
    const text = input.trim()
    if (!text || !activeChannel || sending) return
    if (activeChannel.is_archived) { toast.warning('Este canal está arquivado — não é possível enviar mensagens'); return }
    setSending(true)
    setInput('')
    setReplyTo(null)
    setMentioning(false)
    const mentionMatches = [...text.matchAll(/@(\w+(?:\s\w+)?)/g)]
    const mentions = mentionMatches.map(m => {
      const found = profiles.find(p => p.full_name.toLowerCase().startsWith(m[1].toLowerCase()))
      return found?.id
    }).filter(Boolean)
    const { error } = await supabase.from('chat_messages').insert({
      org_id: profile.org_id, channel_id: activeChannel.id, sender_id: profile.id,
      content: text, reply_to: replyTo?.id || null, mentions, reactions: {}, read_by: [profile.id],
    })
    if (error) { toast.error('Erro ao enviar: ' + error.message); setInput(text) }
    else if (mentions.length > 0) {
      const notifPayloads = mentions.filter(uid => uid !== profile.id).map(uid => ({
        org_id: profile.org_id, user_id: uid, type: 'mention',
        title: `${profile.full_name || 'Alguém'} mencionou você`,
        message: `#${activeChannel.name}: ${text.slice(0,80)}${text.length > 80 ? '…' : ''}`,
        entity_type: 'chat_channel', entity_id: activeChannel.id, is_read: false,
      }))
      if (notifPayloads.length > 0) supabase.from('notifications').insert(notifPayloads)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // ── React ──
  async function handleReact(msgId, emoji) {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = { ...(msg.reactions || {}) }
    const users = reactions[emoji] ? [...reactions[emoji]] : []
    const idx = users.indexOf(profile.id)
    if (idx > -1) users.splice(idx, 1); else users.push(profile.id)
    if (users.length === 0) delete reactions[emoji]; else reactions[emoji] = users
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m))
    const { error } = await supabase.from('chat_messages').update({ reactions }).eq('id', msgId).eq('org_id', profile.org_id)
    if (error) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: msg.reactions } : m))
  }

  // ── Pin ──
  async function handlePin(msg) {
    const { error } = await supabase.from('chat_messages')
      .update({ is_pinned: !msg.is_pinned }).eq('id', msg.id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao fixar: ' + error.message); return }
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: !msg.is_pinned } : m))
  }

  // ── @mention input ──
  function handleInput(e) {
    const val = e.target.value
    setInput(val)
    const lastAt = val.lastIndexOf('@')
    if (lastAt > -1) {
      const query = val.slice(lastAt + 1)
      if (!query.includes(' ') && lastAt === val.length - query.length - 1) {
        setMentioning(true); setMentionQuery(query); setMentionIndex(0); return
      }
    }
    setMentioning(false)
  }
  function insertMention(p) {
    const lastAt = input.lastIndexOf('@')
    setInput(input.slice(0, lastAt) + '@' + p.full_name + ' ')
    setMentioning(false)
    inputRef.current?.focus()
  }
  const mentionFiltered = mentionQuery
    ? profiles.filter(p => p.full_name.toLowerCase().includes(mentionQuery.toLowerCase()) && p.id !== profile?.id)
    : profiles.filter(p => p.id !== profile?.id)

  function handleKeyDown(e) {
    if (mentioning) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i+1, mentionFiltered.length-1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i-1, 0)) }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (mentionFiltered[mentionIndex]) insertMention(mentionFiltered[mentionIndex]); return }
      if (e.key === 'Escape') { setMentioning(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Group messages ──
  function groupMessages(msgs) {
    const items = []
    let lastDate = null, lastGroup = null
    msgs.filter(m => !search || m.content?.toLowerCase().includes(search.toLowerCase())).forEach(msg => {
      const dateStr = fmtDate(msg.created_at)
      if (dateStr !== lastDate) { items.push({ type: 'divider', label: dateStr }); lastDate = dateStr; lastGroup = null }
      const sameAuthor = lastGroup && lastGroup.sender_id === msg.sender_id
      const timeDiff = lastGroup ? (new Date(msg.created_at) - new Date(lastGroup.messages[lastGroup.messages.length-1].created_at)) / 60000 : 999
      if (sameAuthor && timeDiff < 5) { lastGroup.messages.push(msg) }
      else { const g = { type: 'group', sender_id: msg.sender_id, messages: [msg] }; items.push(g); lastGroup = g }
    })
    return items
  }

  const pinnedMessages = messages.filter(m => m.is_pinned)
  const activeChannels  = channels.filter(ch => !ch.is_archived)
  const archivedChannels = channels.filter(ch => ch.is_archived)
  const onlineIds = new Set(todayCheckins.map(c => c.user_id))
  const onlineCount = profiles.filter(p => onlineIds.has(p.id)).length

  // ── Render channel row ──
  function renderChannel(ch) {
    const isActive = activeChannel?.id === ch.id
    const unread = unreadByChannel[ch.id] || 0
    const menuOpen = channelMenu?.channelId === ch.id
    return (
      <div key={ch.id} className="relative group/ch">
        <button
          onClick={() => { setActiveChannel(ch); markChannelRead(ch.id) }}
          className={`w-full text-left flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg transition-all ${isActive ? 'text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'} ${ch.is_archived ? 'opacity-60' : ''}`}
          style={{ width: 'calc(100% - 8px)', background: isActive ? VL : 'transparent' }}>
          <span className="text-base w-5 text-center shrink-0">{ch.icon || '#'}</span>
          <span className="text-xs font-medium flex-1 truncate">{ch.name}</span>
          {ch.is_archived && <Archive className="w-3 h-3 text-zinc-500 shrink-0" />}
          {unread > 0 && !ch.is_archived && (
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        {/* ⋯ menu button */}
        {!ch.is_general && (
          <button
            onClick={e => { e.stopPropagation(); setChannelMenu(menuOpen ? null : { channelId: ch.id }) }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md transition-all text-zinc-500 hover:text-white hover:bg-white/10 ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover/ch:opacity-100'}`}>
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
        {/* Archived channels: show ⋯ always */}
        {ch.is_general && ch.is_archived && (
          <button
            onClick={e => { e.stopPropagation(); setChannelMenu(menuOpen ? null : { channelId: ch.id }) }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md transition-all text-zinc-500 hover:text-white hover:bg-white/10 ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover/ch:opacity-100'}`}>
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
        {menuOpen && (
          <ChannelMenu
            channel={ch}
            isLeader={isLeader}
            onArchive={() => archiveChannel(ch.id)}
            onUnarchive={() => unarchiveChannel(ch.id)}
            onDelete={() => deleteChannel(ch.id)}
            onRename={() => setRenamingChannel(ch)}
            onClose={() => setChannelMenu(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden font-['Montserrat',system-ui,sans-serif]">

      {/* ══════════ SIDEBAR ══════════ */}
      <div className="w-64 shrink-0 flex flex-col overflow-hidden" style={{ background: CH }}>

        {/* Header */}
        <div className="px-4 py-3.5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>💬</span> BX Chat
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{onlineCount} online agora</div>
            </div>
            <button onClick={() => setShowNewChannel(true)} title="Novo canal"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-white/5">
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
            <Search className="w-3 h-3 text-zinc-400 shrink-0" />
            <input className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 outline-none"
              placeholder="Buscar mensagens…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Channels list */}
        <div className="flex-1 overflow-y-auto py-1" onClick={() => setChannelMenu(null)}>
          {loading ? (
            <div className="px-4 py-2 text-xs text-zinc-500">Carregando…</div>
          ) : (
            <>
              {/* Fixed / General */}
              <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Geral</div>
              {activeChannels.filter(ch => ch.is_general).map(renderChannel)}

              {/* Project channels */}
              {activeChannels.filter(ch => !ch.is_general).length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Projetos</div>
                  {activeChannels.filter(ch => !ch.is_general).map(renderChannel)}
                </>
              )}

              {/* Archived section */}
              {archivedChannels.length > 0 && (
                <>
                  <button
                    onClick={() => setShowArchived(p => !p)}
                    className="w-full flex items-center gap-2 px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors">
                    {showArchived ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Arquivados ({archivedChannels.length})
                  </button>
                  {showArchived && archivedChannels.map(renderChannel)}
                </>
              )}
            </>
          )}
        </div>

        {/* Online members */}
        <div className="border-t border-white/10 px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Equipe hoje</div>
          <div className="flex flex-wrap gap-1.5">
            {profiles.map(p => {
              const isOnline = onlineIds.has(p.id)
              const ci = todayCheckins.find(c => c.user_id === p.id)
              const statusIcons = { escritorio: '🏢', cliente: '🤝', remoto: '🏠', viagem: '✈️' }
              return (
                <div key={p.id} title={`${p.full_name}${ci ? ' — ' + (statusIcons[ci.status] || '📍') : ''}`} className="relative cursor-default">
                  <Avatar profile={p} size={28} />
                  {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-zinc-800 flex items-center justify-center"
                      style={{ background: '#22C55E', fontSize: 7 }}>
                      {ci ? statusIcons[ci.status] || '●' : '●'}
                    </div>
                  )}
                  {!isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-zinc-600 border border-zinc-800" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Self */}
        <div className="border-t border-white/10 px-3 py-2.5 flex items-center gap-2.5">
          <Avatar profile={profile} size={30} showStatus isOnline />
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
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ background: '#F4F5F9' }}>
                {activeChannel.icon || '#'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-zinc-800">{activeChannel.name}</div>
                  {activeChannel.is_archived && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <Archive className="w-2.5 h-2.5" /> Arquivado
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {activeChannel.description || `${messages.length} mensagens`}
                  {pinnedMessages.length > 0 && ` · 📌 ${pinnedMessages.length} fixada${pinnedMessages.length > 1 ? 's' : ''}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeChannel.is_archived && isLeader && (
                <button onClick={() => unarchiveChannel(activeChannel.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                  <ArchiveRestore className="w-3 h-3" /> Desarquivar
                </button>
              )}
              {pinnedMessages.length > 0 && (
                <button onClick={() => setShowPinned(p => !p)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${showPinned ? 'bg-amber-100 text-amber-700' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                  <Pin className="w-3 h-3" /> {pinnedMessages.length}
                </button>
              )}
              <button onClick={() => navigate('/time')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500">
                <Users className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center px-5 py-3 border-b border-zinc-100 shrink-0">
            <div className="text-sm font-bold text-zinc-800">BX Chat</div>
          </div>
        )}

        {/* Pinned panel */}
        {showPinned && pinnedMessages.length > 0 && (
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1">
              <Pin className="w-3 h-3" /> MENSAGENS FIXADAS
            </div>
            {pinnedMessages.map(m => (
              <div key={m.id} className="text-xs text-zinc-700 py-1 border-b border-amber-100 last:border-0">
                <span className="font-semibold text-zinc-900">{profMap[m.sender_id]?.full_name}: </span>
                {(m.content || '').slice(0, 100)}
              </div>
            ))}
          </div>
        )}

        {/* Archived banner */}
        {activeChannel?.is_archived && (
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-2.5 shrink-0 flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700 font-semibold">
              Este canal está arquivado. As mensagens são somente leitura.
            </span>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto py-3" style={{ background: '#FAFBFC' }}>
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
          ) : messages.filter(m => !search || m.content?.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-3">{activeChannel.icon || '💬'}</div>
                <div className="text-sm font-bold text-zinc-600">{search ? 'Nenhuma mensagem encontrada' : `Bem-vindo ao #${activeChannel.name}`}</div>
                <div className="text-xs text-zinc-400 mt-1">{search ? 'Tente outros termos' : 'Seja o primeiro a enviar uma mensagem'}</div>
              </div>
            </div>
          ) : (
            <div>
              {groupMessages(messages).map((item, idx) => {
                if (item.type === 'divider') return (
                  <div key={`d-${idx}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 h-px bg-zinc-200" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-100 px-3 py-1 rounded-full">{item.label}</span>
                    <div className="flex-1 h-px bg-zinc-200" />
                  </div>
                )
                const mine = item.sender_id === profile?.id
                const author = profMap[item.sender_id]
                return (
                  <div key={`g-${idx}`}>
                    {item.messages.map(msg => {
                      const replyMsg = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null
                      const replyAuthor = replyMsg ? profMap[replyMsg.sender_id] : null
                      return (
                        <Message key={msg.id} msg={msg} mine={mine} isLeader={isLeader}
                          author={author} allProfiles={profiles}
                          replyMsg={replyMsg} replyAuthor={replyAuthor}
                          onReact={handleReact} onReply={setReplyTo}
                          onPin={handlePin} onDelete={deleteMessage} />
                      )
                    })}
                  </div>
                )
              })}
              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-zinc-100 bg-white px-4 py-3 shrink-0">
          {replyTo && (
            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 mb-2">
              <Reply className="w-3 h-3 text-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-violet-600">{profMap[replyTo.sender_id]?.full_name}</span>
                <span className="text-xs text-zinc-500 ml-1">{(replyTo.content || '').slice(0, 60)}</span>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-violet-400 hover:text-violet-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {mentioning && mentionFiltered.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-lg mb-2 overflow-hidden max-h-48 overflow-y-auto">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 border-b border-zinc-100">Mencionar membro</div>
              {mentionFiltered.slice(0,6).map((p, i) => (
                <button key={p.id} onClick={() => insertMention(p)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${i === mentionIndex ? 'bg-violet-50' : 'hover:bg-zinc-50'}`}>
                  <Avatar profile={p} size={24} />
                  <div>
                    <div className="font-semibold text-zinc-800 text-xs">{p.full_name}</div>
                    <div className="text-[10px] text-zinc-400">{p.role}</div>
                  </div>
                  {onlineIds.has(p.id) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className={`flex-1 flex items-end rounded-2xl px-4 py-2.5 gap-2 transition-all ${activeChannel?.is_archived ? 'bg-zinc-100 border border-zinc-200 opacity-60' : 'bg-zinc-50 border border-zinc-200 focus-within:border-violet-300 focus-within:bg-white'}`}>
              <button onClick={() => { if (activeChannel?.is_archived) return; setInput(prev => prev + '@'); inputRef.current?.focus(); setMentioning(true); setMentionQuery('') }}
                className="text-zinc-400 hover:text-violet-500 shrink-0 pb-0.5" title="Mencionar">
                <AtSign className="w-4 h-4" />
              </button>
              <textarea ref={inputRef}
                className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-zinc-400 max-h-32 py-0.5 leading-relaxed"
                rows={1}
                placeholder={activeChannel?.is_archived ? 'Canal arquivado — somente leitura' : activeChannel ? `Mensagem em ${activeChannel.icon || '#'}${activeChannel.name}…` : 'Selecione um canal…'}
                disabled={!activeChannel || activeChannel.is_archived}
                value={input} onChange={handleInput} onKeyDown={handleKeyDown}
                style={{ minHeight: 24 }} />
            </div>
            <button onClick={sendMessage} disabled={!input.trim() || !activeChannel || sending || activeChannel?.is_archived}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 transition-all hover:opacity-90 disabled:opacity-40 shadow-sm"
              style={{ background: input.trim() && !activeChannel?.is_archived ? VL : '#CBD5E1' }}>
              <Send className="w-4 h-4" />
            </button>
          </div>
          {!activeChannel?.is_archived && (
            <div className="text-[10px] text-zinc-400 mt-1 px-1">
              Enter para enviar · Shift+Enter para quebrar linha · @ para mencionar
            </div>
          )}
        </div>
      </div>

      {/* ══════════ TOASTS ══════════ */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="pointer-events-auto flex items-start gap-3 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-3 w-80"
            style={{ animation: 'slideInRight 0.3s ease' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: VL }}>{initials(t.senderName)}</div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
              const ch = channels.find(c => c.id === t.channelId)
              if (ch) { setActiveChannel(ch); markChannelRead(ch.id) }
            }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-bold text-zinc-800 truncate">{t.senderName}</span>
                <span className="text-[9px] text-zinc-400 shrink-0 ml-2">{t.channelName && `#${t.channelName}`}</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">{t.content}</p>
            </div>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="text-zinc-300 hover:text-zinc-500 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Modals */}
      {showNewChannel && (
        <NewChannelModal profile={profile} projects={projects}
          onCreated={ch => { setChannels(prev => [...prev, ch]); setActiveChannel(ch); setShowNewChannel(false) }}
          onClose={() => setShowNewChannel(false)} />
      )}
      {renamingChannel && (
        <RenameModal channel={renamingChannel}
          onSave={handleRenameSuccess}
          onClose={() => setRenamingChannel(null)} />
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .mention { font-weight: 700; color: ${VL}; }
      `}</style>
    </div>
  )
}
