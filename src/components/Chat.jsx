import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Hash, Send, Plus, X, Search, Bell, BellOff, Pin, Reply, Smile, MoreHorizontal, Users, Check, CheckCheck, Circle, ChevronDown, AlertCircle, Paperclip, AtSign } from 'lucide-react'
import { toast } from './Toast'
import { supabase } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useData } from '../contexts/DataContext'
import { useNavigate } from 'react-router-dom'

const CH = '#2D2E39', VL = '#5452C1'
const REACTIONS_LIST = ['👍', '❤️', '🔥', '✅', '😂', '🙏', '👀', '⚡']

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtTime(d) {
  const dt = new Date(d)
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(d) {
  const dt = new Date(d)
  const today = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (dt >= today) return 'Hoje'
  if (dt >= yesterday) return 'Ontem'
  return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function relTime(d) {
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s/60)}min`
  if (s < 86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}
function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}
function parseContent(text, profMap) {
  // Highlight @mentions
  return text.replace(/@[\w\s]+/g, match => `<span class="mention">${match}</span>`)
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
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
      icon, project_id: projectId || null, is_general: false,
    }).select().single()
    if (error) { console.error('[Chat] criar canal:', error.message); setSaving(false); return }
    if (data) { onCreated(data) }
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
              placeholder="ex: marketing, financeiro, geral…" value={name} onChange={e => setName(e.target.value)}
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
              className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
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
function Message({ msg, mine, author, allProfiles, onReact, onReply, onPin, replyMsg, replyAuthor }) {
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const isRead = Array.isArray(msg.read_by) && msg.read_by.length > 0
  const isPinned = msg.is_pinned

  const reactions = msg.reactions && typeof msg.reactions === 'object'
    ? Object.entries(msg.reactions)
    : []

  return (
    <div className={`group flex gap-2.5 px-4 py-1 hover:bg-zinc-50/80 transition-colors relative ${mine ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false) }}>

      {/* Avatar */}
      {!mine && <div className="shrink-0 mt-0.5"><Avatar profile={author} size={32} /></div>}

      {/* Bubble */}
      <div className={`flex flex-col max-w-[72%] ${mine ? 'items-end' : ''}`}>
        {/* Author + time */}
        {!mine && (
          <div className="flex items-center gap-2 mb-0.5 px-1">
            <span className="text-xs font-bold text-zinc-700">{author?.full_name}</span>
            <span className="text-[10px] text-zinc-400">{fmtTime(msg.created_at)}</span>
            {isPinned && <span className="text-[9px] text-amber-500 font-bold">📌 fixada</span>}
          </div>
        )}

        {/* Reply reference */}
        {replyMsg && (
          <div className={`text-xs border-l-2 pl-2 py-1 mb-1 rounded-r-md mx-1 ${mine ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-zinc-300 bg-zinc-100 text-zinc-600'}`}>
            <span className="font-semibold">{replyAuthor?.full_name || 'Usuário'}: </span>
            {(replyMsg.content || '').slice(0, 60)}{replyMsg.content?.length > 60 ? '…' : ''}
          </div>
        )}

        {/* Message bubble */}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm relative ${mine ? 'text-white rounded-tr-sm' : 'bg-white text-zinc-800 rounded-tl-sm border border-zinc-100'}`}
          style={mine ? { background: VL } : {}}>

          {/* Mentions highlight via CSS */}
          <div dangerouslySetInnerHTML={{
            __html: (msg.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/@(\S+(\s\S+)?)/g, '<span style="font-weight:700;color:' + (mine ? '#C4B5FD' : VL) + '">@$1</span>')
          }} />

          {/* Time for own messages */}
          {mine && (
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-violet-200">{fmtTime(msg.created_at)}</span>
              {isRead
                ? <CheckCheck className="w-3 h-3 text-violet-200" />
                : <Check className="w-3 h-3 text-violet-300" />}
            </div>
          )}
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className={`flex gap-1 mt-1 flex-wrap ${mine ? 'justify-end' : ''}`}>
            {reactions.map(([emoji, users]) => (
              <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                className="flex items-center gap-1 bg-white border border-zinc-200 rounded-full px-2 py-0.5 text-xs hover:border-violet-300 transition-colors shadow-sm">
                <span>{emoji}</span>
                <span className="text-zinc-600 font-semibold">{Array.isArray(users) ? users.length : users}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover action buttons */}
      {showActions && (
        <div className={`absolute top-1 flex items-center gap-0.5 bg-white border border-zinc-200 rounded-xl shadow-lg px-1 py-0.5 z-20 ${mine ? 'left-4' : 'right-4'}`}>
          <div className="relative">
            <button onClick={() => setShowEmojiPicker(p => !p)} title="Reagir"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-800">
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmojiPicker && (
              <div className={`absolute top-8 ${mine ? 'right-0' : 'left-0'} bg-white border border-zinc-200 rounded-xl shadow-xl p-2 flex gap-1 z-30`}>
                {REACTIONS_LIST.map(em => (
                  <button key={em} onClick={() => { onReact(msg.id, em); setShowEmojiPicker(false) }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-lg transition-colors">
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onReply(msg)} title="Responder"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-800">
            <Reply className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onPin(msg)} title="Fixar"
            className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors ${msg.is_pinned ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-800'}`}>
            <Pin className="w-3.5 h-3.5" />
          </button>
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
  const [toasts, setToasts] = useState([])
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const realtimeRef = useRef(null)
  const profMap = {}; profiles.forEach(p => { profMap[p.id] = p })

  // ── Load initial data ──
  useEffect(() => {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]
    Promise.allSettled([
      supabase.from('chat_channels').select('*').eq('org_id', profile.org_id).order('created_at'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color,role').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('projects').select('id,name').eq('org_id', profile.org_id).order('name'),
      supabase.from('check_ins').select('user_id,status').eq('org_id', profile.org_id).eq('date', today).is('check_out_time', null),
    ]).then(([chR, profR, projR, ciR]) => {
      const chs = chR.status === 'fulfilled' && !chR.value.error ? chR.value.data || [] : []
      setChannels(chs)
      if (chs.length > 0) setActiveChannel(chs[0])
      if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
      if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
      if (ciR.status === 'fulfilled' && !ciR.value.error) setTodayCheckins(ciR.value.data || [])
      setLoading(false)
    })
  }, [profile])

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
        // B-104: merge com msgs que possam ter chegado via realtime antes deste then()
        // usar setter funcional para combinar sem duplicatas
        setMessages(prev => {
          const loaded = data || []
          if (prev.length === 0) return loaded
          const ids = new Set(loaded.map(m => m.id))
          const extras = prev.filter(m => !ids.has(m.id))
          return [...loaded, ...extras].sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
          )
        })
        setLoadingMsgs(false)
        // Mark as read
        markChannelRead(activeChannel.id)
      })

    // Realtime subscription
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)
    const ch = supabase.channel(`chat-${activeChannel.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new])
          // Notify if not from self
          if (payload.new.sender_id !== profile.id) {
            const sender = profMap[payload.new.sender_id]
            addToast(sender?.full_name || 'Alguém', payload.new.content, activeChannel)
          }
        }
        if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
        }
      })
      .subscribe()
    realtimeRef.current = ch

    return () => { if (realtimeRef.current) supabase.removeChannel(realtimeRef.current) }
  }, [activeChannel?.id, profile])

  // ── Global realtime — notificações de outros canais ──
  useEffect(() => {
    if (!profile) return
    const globalCh = supabase.channel('chat-global-notif')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `org_id=eq.${profile.org_id}`,
      }, payload => {
        const msg = payload.new
        if (msg.sender_id === profile.id) return
        // Update unread count
        if (!activeChannel || msg.channel_id !== activeChannel.id) {
          setUnreadByChannel(prev => ({
            ...prev,
            [msg.channel_id]: (prev[msg.channel_id] || 0) + 1,
          }))
          // Toast notification mesmo em outro canal
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

  // ── Toast notifications ──
  function addToast(senderName, content, channel) {
    const id = Date.now() + Math.random()
    const toast = {
      id, senderName,
      content: (content || '').slice(0, 80),
      channelName: channel?.name || '',
      channelId: channel?.id,
    }
    setToasts(prev => [...prev.slice(-3), toast]) // max 4 toasts
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  async function markChannelRead(channelId) {
    setUnreadByChannel(prev => ({ ...prev, [channelId]: 0 }))
    // Persistir no banco: marcar mensagens não lidas como lidas pelo usuário atual
    // read_by é um array de UUIDs — adicionar profile.id se ainda não estiver
    if (!profile?.id) return
    try {
      // Buscar mensagens não lidas do canal (onde profile.id não está em read_by)
      const { data: unread } = await supabase
        .from('chat_messages')
        .select('id,read_by')
        .eq('channel_id', channelId)
        .eq('org_id', profile.org_id)
        .not('sender_id', 'eq', profile.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!unread?.length) return

      // Atualizar as mensagens que ainda não têm profile.id em read_by
      const toUpdate = unread.filter(m => !Array.isArray(m.read_by) || !m.read_by.includes(profile.id))
      for (const msg of toUpdate) {
        const newReadBy = Array.isArray(msg.read_by) ? [...msg.read_by, profile.id] : [profile.id]
        await supabase.from('chat_messages')
          .update({ read_by: newReadBy })
          .eq('id', msg.id).eq('org_id', profile.org_id)
      }
    } catch (err) {
      // Falha silenciosa — não crítico para UX
      console.warn('[Chat] markChannelRead persist:', err.message)
    }
  }

  // ── Send message ──
  async function sendMessage() {
    const text = input.trim()
    if (!text || !activeChannel || sending) return
    setSending(true)
    setInput('')
    setReplyTo(null)
    setMentioning(false)

    // Extract mentions
    const mentionMatches = [...text.matchAll(/@(\w+(?:\s\w+)?)/g)]
    const mentions = mentionMatches.map(m => {
      const found = profiles.find(p => p.full_name.toLowerCase().startsWith(m[1].toLowerCase()))
      return found?.id
    }).filter(Boolean)

    const { error } = await supabase.from('chat_messages').insert({
      org_id: profile.org_id,
      channel_id: activeChannel.id,
      sender_id: profile.id,
      content: text,
      reply_to: replyTo?.id || null,
      mentions,
      reactions: {},
      read_by: [profile.id],
    })
    if (error) { console.error(error); setInput(text) }
    else if (mentions.length > 0) {
      // B-92: criar notificações para usuários mencionados
      const notifPayloads = mentions
        .filter(uid => uid !== profile.id) // não notificar a si mesmo
        .map(uid => ({
          org_id:      profile.org_id,
          user_id:     uid,
          type:        'mention',
          title:       `${profile.full_name || 'Alguém'} mencionou você`,
          message:     `#${activeChannel.name}: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
          entity_type: 'chat_channel',
          entity_id:   activeChannel.id,
          is_read:     false,
        }))
      if (notifPayloads.length > 0) {
        supabase.from('notifications').insert(notifPayloads)
          .then(({ error: ne }) => { if (ne) console.warn('[Chat] notif mention:', ne.message) })
      }
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // ── React to message ──
  async function handleReact(msgId, emoji) {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = { ...(msg.reactions || {}) }
    const users = reactions[emoji] ? [...reactions[emoji]] : []
    const idx = users.indexOf(profile.id)
    if (idx > -1) users.splice(idx, 1)
    else users.push(profile.id)
    if (users.length === 0) delete reactions[emoji]
    else reactions[emoji] = users
    // Optimistic update
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m))
    const { error } = await supabase.from('chat_messages')
      .update({ reactions }).eq('id', msgId).eq('org_id', profile.org_id)
    if (error) {
      // Reverter em caso de falha
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: msg.reactions } : m))
    }
  }

  // ── Pin message ──
  async function handlePin(msg) {
    const { error } = await supabase.from('chat_messages')
      .update({ is_pinned: !msg.is_pinned }).eq('id', msg.id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao fixar mensagem: ' + error.message); return }
    // Atualizar localmente para UX imediata
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: !msg.is_pinned } : m))
  }

  // ── Input handling: @mentions ──
  function handleInput(e) {
    const val = e.target.value
    setInput(val)
    const lastAt = val.lastIndexOf('@')
    if (lastAt > -1) {
      const query = val.slice(lastAt + 1)
      if (!query.includes(' ') && lastAt === val.length - query.length - 1) {
        setMentioning(true)
        setMentionQuery(query)
        setMentionIndex(0)
        return
      }
    }
    setMentioning(false)
  }

  function insertMention(profile) {
    const lastAt = input.lastIndexOf('@')
    const newText = input.slice(0, lastAt) + '@' + profile.full_name + ' '
    setInput(newText)
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
    let lastDate = null
    let lastGroup = null
    msgs.filter(m => !search || m.content?.toLowerCase().includes(search.toLowerCase())).forEach(msg => {
      const dateStr = fmtDate(msg.created_at)
      if (dateStr !== lastDate) {
        items.push({ type: 'divider', label: dateStr })
        lastDate = dateStr
        lastGroup = null
      }
      const sameAuthor = lastGroup && lastGroup.sender_id === msg.sender_id
      const timeDiff = lastGroup ? (new Date(msg.created_at) - new Date(lastGroup.messages[lastGroup.messages.length-1].created_at)) / 60000 : 999
      if (sameAuthor && timeDiff < 5) {
        lastGroup.messages.push(msg)
      } else {
        const g = { type: 'group', sender_id: msg.sender_id, messages: [msg] }
        items.push(g)
        lastGroup = g
      }
    })
    return items
  }

  const pinnedMessages = messages.filter(m => m.is_pinned)
  const totalUnread = Object.values(unreadByChannel).reduce((a, b) => a + b, 0)
  // B-52: sincronizar badge da Sidebar com contagem real
  React.useEffect(() => { setUnreadChat(totalUnread) }, [totalUnread])
  const onlineIds = new Set(todayCheckins.map(c => c.user_id))
  const onlineCount = profiles.filter(p => onlineIds.has(p.id)).length

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
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
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

        {/* Channels */}
        <div className="flex-1 overflow-y-auto py-1">
          <div className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Canais</div>
          {loading ? (
            <div className="px-4 py-2 text-xs text-zinc-500">Carregando…</div>
          ) : channels.length === 0 ? (
            <div className="px-4 py-2 text-xs text-zinc-500">Nenhum canal</div>
          ) : channels.map(ch => {
            const isActive = activeChannel?.id === ch.id
            const unread = unreadByChannel[ch.id] || 0
            return (
              <button key={ch.id} onClick={() => { setActiveChannel(ch); markChannelRead(ch.id) }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg transition-all ${isActive ? 'text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                style={{ width: 'calc(100% - 8px)', background: isActive ? VL : 'transparent' }}>
                <span className="text-base w-5 text-center shrink-0">{ch.icon || '#'}</span>
                <span className="text-xs font-medium flex-1 truncate">{ch.name}</span>
                {unread > 0 && (
                  <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            )
          })}
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
                <div key={p.id} title={`${p.full_name}${ci ? ' — ' + (statusIcons[ci.status] || '📍') : ''}`}
                  className="relative cursor-default">
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
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                style={{ background: '#F4F5F9' }}>
                {activeChannel.icon || '#'}
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-800">{activeChannel.name}</div>
                <div className="text-[10px] text-zinc-400">
                  {activeChannel.description || `${messages.length} mensagens`}
                  {pinnedMessages.length > 0 && ` · 📌 ${pinnedMessages.length} fixada${pinnedMessages.length > 1 ? 's' : ''}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {pinnedMessages.length > 0 && (
                <button onClick={() => setShowPinned(p => !p)} title="Ver fixadas"
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${showPinned ? 'bg-amber-100 text-amber-700' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                  <Pin className="w-3 h-3" /> {pinnedMessages.length}
                </button>
              )}
              <button onClick={() => navigate('/time')} title="Ver equipe"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500">
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
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-100 px-3 py-1 rounded-full">
                      {item.label}
                    </span>
                    <div className="flex-1 h-px bg-zinc-200" />
                  </div>
                )
                const mine = item.sender_id === profile?.id
                const author = profMap[item.sender_id]
                return (
                  <div key={`g-${idx}`}>
                    {item.messages.map((msg, mi) => {
                      const replyMsg = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null
                      const replyAuthor = replyMsg ? profMap[replyMsg.sender_id] : null
                      return (
                        <Message
                          key={msg.id}
                          msg={msg}
                          mine={mine}
                          author={author}
                          allProfiles={profiles}
                          replyMsg={replyMsg}
                          replyAuthor={replyAuthor}
                          onReact={handleReact}
                          onReply={setReplyTo}
                          onPin={handlePin}
                        />
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
          {/* Reply preview */}
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

          {/* Mention autocomplete */}
          {mentioning && mentionFiltered.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-lg mb-2 overflow-hidden max-h-48 overflow-y-auto">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 border-b border-zinc-100">
                Mencionar membro
              </div>
              {mentionFiltered.slice(0, 6).map((p, i) => (
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

          {/* Main input */}
          <div className="flex items-end gap-2">
            <div className="flex-1 flex items-end bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 focus-within:border-violet-300 focus-within:bg-white transition-all gap-2">
              <button onClick={() => { setInput(prev => prev + '@'); inputRef.current?.focus(); setMentioning(true); setMentionQuery('') }}
                className="text-zinc-400 hover:text-violet-500 transition-colors shrink-0 pb-0.5" title="Mencionar">
                <AtSign className="w-4 h-4" />
              </button>
              <textarea
                ref={inputRef}
                className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-zinc-400 max-h-32 py-0.5 leading-relaxed"
                rows={1}
                placeholder={activeChannel ? `Mensagem em ${activeChannel.icon || '#'}${activeChannel.name}…` : 'Selecione um canal…'}
                disabled={!activeChannel}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                style={{ minHeight: 24 }}
              />
            </div>
            <button onClick={sendMessage} disabled={!input.trim() || !activeChannel || sending}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 transition-all hover:opacity-90 disabled:opacity-40 shadow-sm"
              style={{ background: input.trim() ? VL : '#CBD5E1' }}>
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[10px] text-zinc-400 mt-1 px-1">
            Enter para enviar · Shift+Enter para quebrar linha · @ para mencionar
          </div>
        </div>
      </div>

      {/* ══════════ TOASTS — WhatsApp style ══════════ */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id}
            className="pointer-events-auto flex items-start gap-3 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-3 w-80 animate-in slide-in-from-right-5"
            style={{ animation: 'slideInRight 0.3s ease' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: VL }}>
              {initials(toast.senderName)}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
              const ch = channels.find(c => c.id === toast.channelId)
              if (ch) { setActiveChannel(ch); markChannelRead(ch.id) }
            }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-bold text-zinc-800 truncate">{toast.senderName}</span>
                <span className="text-[9px] text-zinc-400 shrink-0 ml-2">
                  {toast.channelName && `#${toast.channelName}`}
                </span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">{toast.content}</p>
            </div>
            <button onClick={() => setToasts(p => p.filter(t => t.id !== toast.id))}
              className="text-zinc-300 hover:text-zinc-500 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* New channel modal */}
      {showNewChannel && (
        <NewChannelModal
          profile={profile} projects={projects}
          onCreated={(ch) => { setChannels(prev => [...prev, ch]); setActiveChannel(ch); setShowNewChannel(false) }}
          onClose={() => setShowNewChannel(false)}
        />
      )}

      {/* Global CSS for animations */}
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
