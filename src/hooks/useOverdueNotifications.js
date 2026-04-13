import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Dispara notificações push nativas do Chrome para tarefas vencidas.
 * Roda uma vez por sessão, 30 segundos após o perfil estar disponível.
 */
export function useOverdueNotifications(profile) {
  const fired = useRef(false)

  useEffect(() => {
    if (!profile || fired.current) return
    if (!('Notification' in window)) return
    if (Notification.permission === 'denied') return

    const timer = setTimeout(async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const { data } = await supabase
          .from('tasks')
          .select('id,title,due_date')
          .eq('org_id', profile.org_id)
          .neq('column_id', 'done')
          .is('deleted_at', null)
          .lt('due_date', today)
          .limit(10)

        if (!data || data.length === 0) return

        const send = () => {
          fired.current = true
          new Notification('BX Hub — Tarefas em atraso', {
            body: `${data.length} tarefa${data.length > 1 ? 's' : ''} vencida${data.length > 1 ? 's' : ''}`,
            icon: '/favicon.ico',
            tag: 'bx-overdue',
          })
        }

        if (Notification.permission === 'granted') {
          send()
        } else {
          Notification.requestPermission().then(p => { if (p === 'granted') send() })
        }
      } catch (_) {
        // silencioso — notificações push são best-effort
      }
    }, 30000)

    return () => clearTimeout(timer)
  }, [profile?.id])
}
