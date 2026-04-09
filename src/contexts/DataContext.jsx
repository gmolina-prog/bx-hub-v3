import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const DataContext = createContext(null)

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}

export function DataProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(user) {
    if (!user) { setProfile(null); return }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('[DataContext] Erro ao carregar profile:', err.message)
      setProfile(null)
    }
  }

  async function refreshProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    await loadProfile(user)
  }

  useEffect(() => {
    let mounted = true

    // Timeout de segurança — se demorar mais de 8s, libera o loading
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[DataContext] Timeout — liberando loading')
        setLoading(false)
      }
    }, 8000)

    async function init() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(s)
        if (s?.user) await loadProfile(s.user)
      } catch (err) {
        console.error('[DataContext] Init error:', err.message)
      } finally {
        if (mounted) {
          clearTimeout(safetyTimeout)
          setLoading(false)
        }
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
      if (s?.user) loadProfile(s.user)
      else setProfile(null)
    })

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      subscription?.unsubscribe()
    }
  }, [])

  return (
    <DataContext.Provider value={{ profile, session, loading, refreshProfile }}>
      {children}
    </DataContext.Provider>
  )
}
