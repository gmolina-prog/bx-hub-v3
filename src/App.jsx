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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F2F2] gap-4">
        <div style={{ fontFamily: 'Montserrat, sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚡</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2D2E39', marginBottom: 8 }}>BX Project Hub</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Iniciando sistema…</div>
          <div style={{ width: 200, height: 3, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden', margin: '0 auto' }}>
            <div style={{ height: '100%', background: '#5452C1', borderRadius: 4, width: '70%', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 16 }}>
            Conexão lenta? <button onClick={() => window.location.reload()} style={{ color: '#5452C1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}>Recarregar</button>
          </div>
        </div>
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
