import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { supabase } from '../lib/supabase'
import { LogOut } from 'lucide-react'

const SECTIONS = [
  {
    title: 'PRINCIPAL',
    items: [
      { emoji: '📊', label: 'Dashboard',      path: '/' },
      { emoji: '🏢', label: 'Portfolio',      path: '/portfolio' },
      { emoji: '📈', label: 'Produtividade',  path: '/produtividade' },
      { emoji: '📒', label: 'Notas & Reuniões', path: '/notas' },
    ],
  },
  {
    title: 'EXECUÇÃO',
    items: [
      { emoji: '📋', label: 'Kanban',    path: '/kanban' },
      { emoji: '🔀', label: 'Timeline',  path: '/timeline' },
      { emoji: '⚠️', label: 'Riscos',    path: '/riscos' },
      { emoji: '🎯', label: 'Captação',  path: '/captacao' },
      { emoji: '📉', label: 'BI',        path: '/bi' },
      { emoji: '⏰', label: 'Rotinas',   path: '/rotinas' },
    ],
  },
  {
    title: 'COMERCIAL',
    items: [
      { emoji: '🤝', label: 'CRM',     path: '/crm' },
      { emoji: '📥', label: 'Intakes', path: '/intakes' },
    ],
  },
  {
    title: 'EQUIPE',
    items: [
      { emoji: '💬', label: 'Chat',       path: '/chat' },
      { emoji: '📅', label: 'Calendário', path: '/calendario' },
      { emoji: '👥', label: 'Time',       path: '/time' },
      { emoji: '🧾', label: 'Reembolsos', path: '/reembolsos' },
    ],
  },
  {
    title: 'CONFIGURAÇÃO',
    divider: true,
    items: [
      { emoji: '📂', label: 'Cadastro',      path: '/cadastro' },
      { emoji: '⚡', label: 'Automações',    path: '/automacoes' },
      { emoji: '⚙️', label: 'Admin',         path: '/admin' },
      { emoji: '📝', label: 'Logs',          path: '/logs' },
      { emoji: '🔔', label: 'Notificações',  path: '/notificacoes' },
      { emoji: '⚙️', label: 'Configurações', path: '/configuracoes' },
    ],
  },
]

export default function Sidebar() {
  const location = useLocation()
  const { profile } = useData()

  function linkClass(path) {
    const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
    return isActive
      ? 'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all text-sm bg-violet text-white font-semibold'
      : 'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all text-sm text-white text-opacity-55 hover:text-opacity-90 hover:bg-white hover:bg-opacity-5'
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const initials = profile?.initials || (profile?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const avatarStyle = profile?.avatar_color ? { background: profile.avatar_color } : {}

  return (
    <div className="w-64 bg-charcoal text-white transition-all duration-300 flex flex-col flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white border-opacity-5">
        <h1 className="font-bold text-lg">BX Hub</h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {SECTIONS.map((section, idx) => (
          <div key={idx} className={section.divider ? 'border-t border-white border-opacity-5 mt-2 pt-2' : 'mb-1'}>
            <div className="px-4 pt-2 pb-1 text-[10px] font-bold tracking-widest text-white text-opacity-25 uppercase">
              {section.title}
            </div>
            {section.items.map(item => (
              <Link key={item.path} to={item.path} className={linkClass(item.path)}>
                <span className="text-base flex-shrink-0 w-5 text-center">{item.emoji}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white border-opacity-5 flex-shrink-0">
        {profile && (
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
              style={avatarStyle.background ? avatarStyle : { background: 'linear-gradient(135deg, #7C7AD9, #35347F)' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{profile.full_name || '—'}</div>
              <div className="text-[10px] text-white text-opacity-55 truncate">{profile.role || ''}</div>
            </div>
            <button onClick={handleLogout} className="p-1.5 hover:bg-white hover:bg-opacity-10 rounded" title="Sair">
              <LogOut className="w-4 h-4 text-white text-opacity-55" />
            </button>
          </div>
        )}
        <div className="text-[9px] text-white text-opacity-25 text-center uppercase tracking-wider font-bold">
          BX Project Hub v3.0
        </div>
      </div>
    </div>
  )
}
