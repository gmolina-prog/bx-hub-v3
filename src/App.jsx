import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useData } from './contexts/DataContext'
import Layout from './components/Layout'
import Login from './components/Login'

// PRINCIPAL
import Dashboard from './components/Dashboard'
import Portfolio from './components/Portfolio'
import Produtividade from './components/Produtividade'
import Notas from './components/Notas'

// EXECUÇÃO
import Kanban from './components/Kanban'
import Timeline from './components/Timeline'
import Riscos from './components/Riscos'
import Captacao from './components/Captacao'
import BI from './components/BI'
import Rotinas from './components/Rotinas'

// COMERCIAL
import CRM from './components/CRM'
import Intakes from './components/Intakes'

// EQUIPE
import Chat from './components/Chat'
import Calendar from './components/Calendar'
import Time from './components/Time'
import Reembolsos from './components/Reembolsos'

// CONFIGURAÇÃO
import Cadastro from './components/Cadastro'
import Automations from './components/Automations'
import Admin from './components/Admin'
import Logs from './components/Logs'
import Notificacoes from './components/Notificacoes'
import Configuracoes from './components/Configuracoes'

export default function App() {
  const { session, loading } = useData()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F2]">
        <div className="text-sm font-semibold text-zinc-500">Carregando BX Hub…</div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/produtividade" element={<Produtividade />} />
        <Route path="/notas" element={<Notas />} />

        <Route path="/kanban" element={<Kanban />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/riscos" element={<Riscos />} />
        <Route path="/captacao" element={<Captacao />} />
        <Route path="/bi" element={<BI />} />
        <Route path="/rotinas" element={<Rotinas />} />

        <Route path="/crm" element={<CRM />} />
        <Route path="/intakes" element={<Intakes />} />

        <Route path="/chat" element={<Chat />} />
        <Route path="/calendario" element={<Calendar />} />
        <Route path="/time" element={<Time />} />
        <Route path="/reembolsos" element={<Reembolsos />} />

        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/automacoes" element={<Automations />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
        <Route path="/configuracoes" element={<Configuracoes />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
