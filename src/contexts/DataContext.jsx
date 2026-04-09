import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DataContext = createContext(null)

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}

export function DataProvider({ children }) {
  const [profile, setProfile]           = useState(null)
  const [session, setSession]           = useState(null)
  const [loading, setLoading]           = useState(true)
  const [unreadNotif, setUnreadNotif]   = useState(0)  // B-14: fonte única de verdade
  const [unreadChat,  setUnreadChat]    = useState(0)  // B-52: badge Chat na Sidebar

  async function loadProfile(user) {
    if (!user) { setProfile(null); return }
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('[DataContext] profile:', err.message)
      setProfile(null)
    }
  }

  // B-14: carregar count de notificações não lidas
  const loadUnread = useCallback(async (prof) => {
    if (!prof) return
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', prof.org_id)
      .eq('user_id', prof.id)
      .eq('is_read', false)
    setUnreadNotif(count || 0)
  }, [])

  async function refreshProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    await loadProfile(user)
  }

  // Expor função para marcar todas como lidas (chamada por Layout e Notificacoes)
  function clearUnread() { setUnreadNotif(0) }
  function decrementUnread() { setUnreadNotif(p => Math.max(0, p - 1)) }

  useEffect(() => {
    let mounted = true

    const safetyTimeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    async function init() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(s)
        if (s?.user) await loadProfile(s.user)
      } catch (err) {
        console.error('[DataContext] init:', err.message)
      } finally {
        if (mounted) { clearTimeout(safetyTimeout); setLoading(false) }
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
      if (s?.user) loadProfile(s.user)
      else { setProfile(null); setUnreadNotif(0) }
    })

    return () => { mounted = false; clearTimeout(safetyTimeout); subscription?.unsubscribe() }
  }, [])

  // Carregar unread quando profile muda
  useEffect(() => {
    if (!profile) return
    loadUnread(profile)

    // B-14: UM ÚNICO channel de notificações — no DataContext, não em Sidebar/Layout
    const ch = supabase.channel('global-notif-count')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => setUnreadNotif(p => p + 1))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => loadUnread(profile))
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [profile?.id])

  return (
    <DataContext.Provider value={{
      profile, session, loading,
      unreadNotif, clearUnread, decrementUnread,
      unreadChat, setUnreadChat,
      refreshProfile,
    }}>
      {children}
    </DataContext.Provider>
  )
}
