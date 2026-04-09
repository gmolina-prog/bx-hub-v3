import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} — BX Hub` : 'BX Hub'
    return () => { document.title = prev }
  }, [title])
}
