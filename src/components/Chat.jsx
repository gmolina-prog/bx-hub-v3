import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MessageCircle, Send, Hash, X, AlertCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

const CH = '#2D2E39', VL = '#5452C1'

function fmtTime(d) {
  const dt = new Date(d)
  const today = new Date()
  if (dt.toDateString() === today.toDateString()) return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function groupMsgs(msgs) {
  const groups = []
  msgs.forEach((msg, i) => {
    const prev = msgs[i - 1]
    const sameAuthor = prev && prev.author_id === msg.author_id
    const timeDiff = prev ? (new Date(msg.created_at) - new Date(prev.created_at)) / 60000 : 999
    if (sameAuthor && timeDiff < 5) groups[groups.length - 1].messages.push(msg)
    else groups.push({ author_id: msg.author_id, messages: [msg] })
  })
  return groups
}

export default function Chat() {
  const { profile } = useData()
  const [channels, setChannels] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending, setSending] = useState(false)
  const [tableError, setTableError] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const realtimeRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    Promise.allSettled([
      supabase.from('projects').select('id,name,company_id').eq('org_id', profile.org_id).order('name'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
    ]).then(([projR, profR]) => {
      const projs = projR.status === 'fulfilled' && !projR.value.error ? projR.value.data || [] : []
      setChannels(projs)
      if (projs.length > 0) setActive(projs[0])
      if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
      setLoading(false)
    })
  }, [profile])

  useEffect(() => {
    if (!active || !profile) return
    setLoadingMsgs(true)
    supabase.from('project_messages').select('*').eq('org_id', profile.org_id).eq('project_id', active.id).order('created_at', { ascending: true }).limit(100)
      .then(({ data, error: err }) => {
        if (err?.code === '42P01') { setTableError(true) } else { setMessages(data || []); setTableError(false) }
        setLoadingMsgs(false)
      })
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)
    const ch = supabase.channel(`chat-${active.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_messages', filter: `project_id=eq.${active.id}` }, p => setMessages(prev => [...prev, p.new]))
      .subscribe()
    realtimeRef.current = ch
    return () => { if (realtimeRef.current) supabase.removeChannel(realtimeRef.current) }
  }, [active, profile])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || !active || sending) return
    setSending(true); setInput('')
    const { error: err } = await supabase.from('project_messages').insert({ org_id: profile.org_id, project_id: active.id, author_id: profile.id, content: text })
    if (err) { setError(err.message); setInput(text) }
    setSending(false)
  }

  function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const profMap = {}; profiles.forEach(p => { profMap[p.id] = p })
  const groups = groupMsgs(messages)

  return (
    <div className="h-[calc(100vh-80px)] flex overflow-hidden p-6 gap-4 max-w-[1600px] mx-auto">
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col rounded-xl overflow-hidden text-white" style={{ background: CH }}>
        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-0.5 flex items-center gap-2"><MessageCircle className="w-3 h-3" /> Chat</div>
          <div className="text-xs text-zinc-500">{channels.length} canais</div>
        </div>
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Projetos</div>
        <div className="flex-1 overflow-y-auto pb-4">
          {loading ? <div className="px-4 py-3 text-xs text-zinc-500">Carregando…</div>
           : channels.map(ch => (
            <button key={ch.id} onClick={() => setActive(ch)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors rounded-lg mx-1 ${active?.id === ch.id ? 'text-white font-semibold' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
              style={active?.id === ch.id ? { background: VL } : {}}>
              <Hash className="w-3.5 h-3.5 shrink-0 opacity-60" />
              <span className="text-sm truncate">{ch.name}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-white/10 px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: profile?.avatar_color || VL }}>
            {profile?.initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{profile?.full_name}</div>
            <div className="text-[10px] text-zinc-500">{profile?.role}</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {active && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-100 shrink-0">
            <Hash className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="text-sm font-bold text-zinc-800">{active.name}</div>
              <div className="text-xs text-zinc-500">Canal do projeto</div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border-b border-red-100 px-5 py-2 text-xs text-red-600 shrink-0">
            <AlertCircle className="w-3 h-3 shrink-0" />{error}
            <button className="ml-auto" onClick={() => setError(null)}><X className="w-3 h-3" /></button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!active ? (
            <div className="h-full flex items-center justify-center"><div className="text-center"><MessageCircle className="w-10 h-10 text-zinc-200 mx-auto mb-3" /><div className="text-sm text-zinc-500">Selecione um canal</div></div></div>
          ) : tableError ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <AlertCircle className="w-10 h-10 text-amber-300 mx-auto mb-3" />
                <div className="text-sm font-semibold text-zinc-700 mb-1">Tabela não encontrada</div>
                <div className="text-xs text-zinc-500">A tabela <code className="bg-zinc-100 px-1 rounded">project_messages</code> precisa ser criada. Ver <code>docs/SCHEMA.md</code>.</div>
              </div>
            </div>
          ) : loadingMsgs ? (
            <div className="h-full flex items-center justify-center text-xs text-zinc-400">Carregando mensagens…</div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center"><div className="text-center"><MessageCircle className="w-10 h-10 text-zinc-200 mx-auto mb-3" /><div className="text-sm text-zinc-500">Nenhuma mensagem</div></div></div>
          ) : (
            <>
              {groups.map((group, gi) => {
                const author = profMap[group.author_id] || { full_name: 'Usuário', initials: '?', avatar_color: VL }
                const mine = group.author_id === profile?.id
                return (
                  <div key={gi} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                    {!mine && <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5" style={{ background: author.avatar_color || VL }}>{author.initials || '?'}</div>}
                    <div className={`flex flex-col gap-1 max-w-[70%] ${mine ? 'items-end' : ''}`}>
                      {!mine && <div className="text-xs font-bold text-zinc-700">{author.full_name}</div>}
                      {group.messages.map((msg, mi) => (
                        <div key={msg.id} className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${mine ? 'text-white rounded-tr-sm' : 'bg-zinc-100 text-zinc-800 rounded-tl-sm'}`} style={mine ? { background: VL } : {}}>
                          {msg.content}
                          {mi === group.messages.length - 1 && (
                            <div className={`text-[10px] mt-1 flex items-center gap-1 ${mine ? 'text-violet-200 justify-end' : 'text-zinc-400'}`}>
                              <Clock className="w-2.5 h-2.5" />{fmtTime(msg.created_at)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>
        {active && !tableError && (
          <div className="border-t border-zinc-100 px-4 py-3 shrink-0">
            <div className="flex items-end gap-3 bg-zinc-50 rounded-xl border border-zinc-200 px-4 py-3">
              <textarea className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-zinc-400 max-h-32" rows={1}
                placeholder={`Mensagem em #${active.name}…`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} />
              <button onClick={send} disabled={!input.trim() || sending} className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:opacity-90 disabled:opacity-40 transition-colors shrink-0" style={{ background: VL }}>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[10px] text-zinc-400 mt-1 px-1">Enter para enviar · Shift+Enter para quebrar linha</div>
          </div>
        )}
      </div>
    </div>
  )
}
