import { useEffect } from 'react'

export function useEscapeKey(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    function handle(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose, enabled])
}
