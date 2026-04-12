import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw, Plus, X, Check, Clock, Building2,
  ChevronDown, Archive, BookOpen, BarChart2, Zap, AlertTriangle
} from 'lucide-react'
import { toast, confirm } from './Toast'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'

const VL    = '#5452C1'
const CH    = '#2D2E39'
const GREEN = '#10B981'
const AMBER = '#F59E0B'
const RED   = '#EF4444'

const FREQ = {
  diaria:  { label: 'Diária',  color: VL,    bg: '#EEF2FF', days: 1  },
  semanal: { label: 'Semanal', color: CH,    bg: '#F2F2F2', days: 7  },
  mensal:  { label: 'Mensal',  color: GREEN, bg: '#F0FDF4', days: 30 },
}
const FREQ_ORDER = { diaria: 0, semanal: 1, mensal: 2 }
const FREQ_CFG = {
  diaria:  { title: 'Diárias',  icon: '📆', dot: '#818CF8', hbg: '#3730A3', cycle: 'Renova todo dia à meia-noite', ref: () => { const d = new Date(); return d.toISOString().split('T')[0] } },
  semanal: { title: 'Semanais', icon: '📅', dot: '#F59E0B', hbg: '#92400E', cycle: 'Renova toda segunda-feira às 8h', ref: () => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); return d.toISOString().split('T')[0] } },
  mensal:  { title: 'Mensais',  icon: '📋', dot: '#10B981', hbg: '#065F46', cycle: 'Renova todo dia 1 do mês',       ref: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` } },
}

// ─── BIBLIOTECA DE TEMPLATES ──────────────────────────────────────────────────
const TEMPLATE_LIBRARY = [
  {
    id: 'executivo',
    icon: '📋',
    label: 'Rotina Executivo BX',
    desc: 'Rotina padrão para analistas sênior — diagnóstico e reestruturação. 29 rotinas.',
    color: VL,
    routines: [
      { title: 'Check-in no BX Project Hub', frequency: 'diaria', description: 'PRIMEIRA ATIVIDADE DO DIA' },
      { title: 'Checar pendências no BX Project Hub', frequency: 'diaria', description: 'Revisar tasks em aberto e prazos do dia' },
      { title: 'Recebimento de extratos bancários diários', frequency: 'diaria', description: 'Conferir todas as contas PJ + aplicações' },
      { title: 'Conciliação bancária (extratos + saldos)', frequency: 'diaria', description: 'Conciliar extratos com lançamentos do sistema' },
      { title: 'Disponibilização da carteira livre', frequency: 'diaria', description: 'Atualizar posição de caixa disponível' },
      { title: 'Acompanhamento diário do faturamento', frequency: 'diaria', description: 'Checar NFs emitidas vs. meta do dia' },
      { title: 'Checagem de vencidos (títulos operados)', frequency: 'diaria', description: 'Verificar títulos vencidos e providenciar cobrança' },
      { title: 'Reunião de caixa', frequency: 'diaria', description: 'Alinhamento diário de posição e necessidades' },
      { title: 'Lançamento VOP', frequency: 'diaria', description: 'Lançar Valor de Ordem de Pagamento no sistema' },
      { title: 'Análise e atualização de BI', frequency: 'diaria', description: 'Verificar dashboards e atualizar dados' },
      { title: 'Baixa/atualização contas a pagar', frequency: 'diaria', description: 'Registrar pagamentos realizados no dia' },
      { title: 'Autorização de pagamento', frequency: 'diaria', description: 'Revisar e autorizar pagamentos pendentes' },
      { title: 'Mapeamento de necessidades de OP (D+1)', frequency: 'diaria', description: 'Mapear ordens de pagamento para o dia seguinte' },
      { title: 'Acompanhamento com os fundos — operações diárias', frequency: 'diaria', description: 'Checar movimentações e posições de fundos' },
      { title: 'Levantamento de todas as posições de fundos (vencidos e a vencer)', frequency: 'semanal', description: 'Pode variar conforme projeto/necessidade' },
      { title: 'Atualização controle de sacado', frequency: 'semanal', description: 'Pode variar conforme projeto/necessidade' },
      { title: 'Atualização da base de CP (integração com sistema cliente)', frequency: 'semanal', description: 'Pode variar conforme projeto/necessidade' },
      { title: 'Atualização do fluxo de caixa (Semana +4)', frequency: 'semanal', description: 'Pode variar conforme projeto/necessidade' },
      { title: 'Projeções gestão de caixa (semestre)', frequency: 'mensal', description: 'TODO DIA 10. Pode variar conforme projeto/necessidade.' },
      { title: 'Verificar e solicitar nota fiscal BX Finance', frequency: 'mensal', description: 'TODO DIA 01.' },
      { title: 'Solicitar posição de estoque fechamento', frequency: 'mensal', description: 'ATÉ DIA 05. Pode variar conforme projeto/necessidade.' },
      { title: 'Solicitar endividamento bancário atualizado', frequency: 'mensal', description: 'ATÉ DIA 05. Pode variar conforme projeto/necessidade.' },
      { title: 'Solicitar faturamento atualizado', frequency: 'mensal', description: 'ATÉ DIA 05. Pode variar conforme projeto/necessidade.' },
      { title: 'Solicitar documentos contábeis atualizados', frequency: 'mensal', description: 'ATÉ DIA 05. Pode variar conforme projeto/necessidade.' },
      { title: 'Atualizar kit banco com novos documentos', frequency: 'mensal', description: 'ATÉ DIA 06. Pode variar conforme projeto/necessidade.' },
      { title: 'Atualizar posição de folha de pagamentos + benefícios', frequency: 'mensal', description: 'ATÉ DIA 05. Pode variar conforme projeto/necessidade.' },
      { title: 'Atualizar mapa de tributos', frequency: 'mensal', description: 'ATÉ DIA 05. Pode variar conforme projeto/necessidade.' },
      { title: 'Realizar fechamento CCL', frequency: 'mensal', description: 'ATÉ DIA 10. Pode variar conforme projeto/necessidade.' },
    ],
  },
  {
    id: 'rj_rx',
    icon: '⚖️',
    label: 'Rotina RJ/RX',
    desc: 'Recuperação Judicial e Extrajudicial — monitoramento de covenants, PRJ, AGC e credores.',
    color: '#DC2626',
    routines: [
      { title: 'Monitoramento de publicações no DJSP/DJEN', frequency: 'diaria', description: 'Alertas de decisões, despachos, ofícios da vara empresarial' },
      { title: 'Checar movimentação processual no DataJud', frequency: 'diaria', description: 'Atualizar status no Hub — lag 7-10 dias úteis' },
      { title: 'Acompanhar fluxo de caixa vs. budget do PRJ', frequency: 'diaria', description: 'Desvio acima de 10% acionar reunião de caixa emergencial' },
      { title: 'Verificar pagamentos autorizados pelo AJ', frequency: 'diaria', description: 'Confirmar se coincidem com cronograma do PRJ e autorizações da vara' },
      { title: 'Registro de comunicações com Administrador Judicial', frequency: 'diaria', description: 'Log no Hub — qualquer solicitação de documento ou esclarecimento' },
      { title: 'Atualização do mapa de credores (Classes I–IV)', frequency: 'semanal', description: 'Saldo devedor atualizado, % por classe, haircut proposto vs. aceito' },
      { title: 'Relatório de cumprimento do PRJ (KPIs)', frequency: 'semanal', description: 'EBITDA, geração de caixa, índices de cobertura vs. metas do plano' },
      { title: 'Reunião de alinhamento interno BX — status do mandato', frequency: 'semanal', description: 'Pauta: riscos, prazo, pendências junto à vara e ao AJ' },
      { title: 'Monitoramento de vencimentos de parcelas do PRJ', frequency: 'semanal', description: 'D-7 antes de cada vencimento: confirmar disponibilidade de caixa' },
      { title: 'Atualização da curva ABC de credores', frequency: 'semanal', description: 'Top 20 credores por valor — status individual de negociação' },
      { title: 'Monitoramento NDA assinados por credor', frequency: 'semanal', description: 'Controle de signatários e pendentes' },
      { title: 'Relatório mensal ao juízo (arts. 22 e 63 da Lei 11.101)', frequency: 'mensal', description: 'Até dia 5 — consolidar dados financeiros para o AJ entregar à vara' },
      { title: 'Atualização do PRJ com novos dados contábeis', frequency: 'mensal', description: 'Até dia 10 — novo balanço, DRE e fluxo de caixa projetado' },
      { title: 'Revisão do plano de desinvestimentos', frequency: 'mensal', description: 'Até dia 15 — ativos previstos no PRJ, status de venda, valor de realização' },
      { title: 'Envio de posição consolidada aos credores Classe II', frequency: 'mensal', description: 'Até dia 20 — bancos e debenturistas: saldo e cronograma futuro' },
      { title: 'Simulação de cenários de haircut', frequency: 'mensal', description: 'Diferentes propostas por classe de credores' },
    ],
  },
  {
    id: 'diagnostico',
    icon: '📊',
    label: 'Rotina Diagnóstico Financeiro',
    desc: 'Mandatos de 30–90 dias: coleta documental, Fleuriet, DuPont, ciclos e entregáveis.',
    color: '#0284C7',
    routines: [
      { title: 'Checar recebimento de documentos do cliente', frequency: 'diaria', description: 'E-mail, portal, WhatsApp — triagem e lançamento no checklist' },
      { title: 'Follow-up de documentos pendentes', frequency: 'diaria', description: 'Lista de pendências atualizada e enviada ao interlocutor' },
      { title: 'Atualizar modelo financeiro com novos dados', frequency: 'semanal', description: 'Incorporar documentos recebidos na semana' },
      { title: 'Reunião de progresso com interlocutor do cliente', frequency: 'semanal', description: 'Agenda fixa — evitar black box de análise' },
      { title: 'Validação cruzada de dados (contábil vs. bancário)', frequency: 'semanal', description: 'Divergências > R$ 50k demandam esclarecimento formal' },
      { title: 'Atualização do diagnóstico parcial no Hub', frequency: 'semanal', description: 'Versão evolutiva — não esperar o relatório final' },
      { title: 'Reclassificação BP para Fleuriet (NCG/CDG/ST)', frequency: 'mensal', description: 'Tipologia I a VI — 3 exercícios mínimo' },
      { title: 'Análise DuPont desagregada', frequency: 'mensal', description: 'Margem × Giro × Alavancagem — benchmark setorial' },
      { title: 'Análise de ciclos operacional e financeiro', frequency: 'mensal', description: 'PMR, PME, PMP, CO, CF — 3 exercícios' },
      { title: 'Análise de liquidez (Corrente, Seca, Imediata, Geral)', frequency: 'mensal', description: 'Comparativo com setor e com períodos anteriores' },
      { title: 'Análise de endividamento e cobertura (DSCR)', frequency: 'mensal', description: 'Dívida Líq./EBITDA, DSCR, cobertura de juros' },
      { title: 'Análise horizontal e vertical (AH/AV)', frequency: 'mensal', description: 'Mínimo 3 exercícios — identificar tendências' },
      { title: 'Identificação de red flags contábeis', frequency: 'mensal', description: 'Variações atípicas, provisões insuficientes, goodwill' },
      { title: 'Solicitar balanços auditados (3 exercícios)', frequency: 'mensal', description: 'BPs + DREs + Notas Explicativas + Relatório do auditor' },
      { title: 'Solicitar contratos bancários vigentes', frequency: 'mensal', description: 'CCE, CCB, CRI/CRA, debêntures, FIDC — todos os instrumentos' },
    ],
  },
  {
    id: 'bpo',
    icon: '🔄',
    label: 'Rotina Compliance BPO',
    desc: 'Clientes BX Outsourcing via Omie — obrigações fiscais, trabalhistas e fechamento mensal.',
    color: '#059669',
    routines: [
      { title: 'Verificar inbox de documentos recebidos por cliente', frequency: 'diaria', description: 'E-mail, WhatsApp, portal — triagem e classificação' },
      { title: 'Checar alertas de prazo no Omie (vencimentos D+3)', frequency: 'diaria', description: 'DARF, GPS, ISS, FGTS — pagamentos que vencem em 3 dias' },
      { title: 'Lançamento de notas fiscais no Omie', frequency: 'diaria', description: 'NF-e de entrada e saída — conferência de CFOP e impostos' },
      { title: 'Conferência de movimentação bancária do dia anterior', frequency: 'diaria', description: 'Conciliação automática + itens pendentes de classificação' },
      { title: 'Conferência de pendências por cliente', frequency: 'semanal', description: 'Lista consolidada — priorizar quem tem obrigação na semana' },
      { title: 'Envio de relatório de posição ao cliente', frequency: 'semanal', description: 'Resumo: lançamentos, pagamentos, pendências do cliente' },
      { title: 'Atualização de cadastro de funcionários (eSocial)', frequency: 'semanal', description: 'Admissões/demissões — prazo: até 1 dia antes do início' },
      { title: 'Processar folha de pagamento', frequency: 'mensal', description: 'Até dia 5 — proventos, descontos, INSS, IRRF, FGTS' },
      { title: 'Recolher FGTS (GRF)', frequency: 'mensal', description: 'Até dia 7 — via Caixa, conferência de competência' },
      { title: 'Transmitir DCTF Web', frequency: 'mensal', description: 'Até dia 15 — débitos IRRF/CSLL/PIS/COFINS' },
      { title: 'Recolher INSS patronal (GPS)', frequency: 'mensal', description: 'Até dia 20 — código conforme regime tributário' },
      { title: 'Emitir DARF IRRF sobre folha', frequency: 'mensal', description: 'Até dia 20 — código 1361' },
      { title: 'Transmitir SPED Fiscal (EFD-ICMS/IPI)', frequency: 'mensal', description: 'Até dia 25 — empresas no regime normal' },
      { title: 'Transmitir EFD Contribuições (PIS/COFINS)', frequency: 'mensal', description: 'Até dia 25 — apuração cumulativa e não-cumulativa' },
      { title: 'Fechar balancete mensal no Omie', frequency: 'mensal', description: 'Até dia 10 do mês seguinte — saldos contábeis vs. bancários' },
      { title: 'Emitir relatórios gerenciais para o cliente', frequency: 'mensal', description: 'Até dia 15 do mês seguinte — DRE + BP + fluxo de caixa padrão BX' },
    ],
  },
  {
    id: 'onboarding',
    icon: '🎯',
    label: 'Rotina Onboarding de Mandato',
    desc: 'Primeiras 2–3 semanas: documentação, acessos, kickoff, Hub configurado.',
    color: '#7C3AED',
    routines: [
      { title: 'Criar empresa no BX Hub (cadastro completo)', frequency: 'diaria', description: 'Dia 1 — CNPJ, Receita Federal, contatos, criticidade' },
      { title: 'Criar projeto no Hub com tipo e prazo', frequency: 'diaria', description: 'Dia 1 — Tipo: Diagnóstico/RJ/RX/M&A — deadline inicial' },
      { title: 'Configurar rotinas do mandato no Hub', frequency: 'diaria', description: 'Dia 1 — selecionar template + customizar' },
      { title: 'Enviar e-mail de boas-vindas ao interlocutor', frequency: 'diaria', description: 'Dia 1 — apresentar equipe, kickoff, lista de documentos' },
      { title: 'Criar canal no Chat do Hub para o mandato', frequency: 'diaria', description: 'Dia 1 — padrão: [empresa]-[tipo] ex: braskem-rj' },
      { title: 'Assinar NDA com todos os envolvidos', frequency: 'semanal', description: 'Até dia 2 — interno BX + terceiros (assessores, bancos)' },
      { title: 'Reunião de kickoff com cliente', frequency: 'semanal', description: 'Dia 2-3 — ata no Hub com participantes, pauta, action items' },
      { title: 'Coletar documentação societária', frequency: 'semanal', description: 'Até dia 5 — contrato social, atas, procurações' },
      { title: 'Solicitar acesso aos sistemas do cliente', frequency: 'semanal', description: 'Até dia 3 — ERP, internet banking, Power BI, e-mail' },
      { title: 'Mapear organograma e decisores', frequency: 'semanal', description: 'Até dia 5 — CFO, CEO, Jurídico, Controladoria, Tesouraria' },
      { title: 'Cadastrar credores principais no Hub', frequency: 'semanal', description: 'Até dia 5 — bancos, debenturistas, fornecedores estratégicos' },
      { title: 'Validar acesso completo a todos os sistemas', frequency: 'semanal', description: 'Dia 8 — checklist: ERP ✓, banco ✓, e-mail ✓, Hub ✓' },
      { title: 'Reunião interna de alinhamento de equipe', frequency: 'semanal', description: 'Dia 8 — divisão de responsabilidades, metas da primeira fase' },
      { title: 'Entregar plano de trabalho ao cliente', frequency: 'mensal', description: 'Dia 10 — cronograma, entregas, responsáveis, pontos de decisão' },
      { title: 'Primeira reunião de status quinzenal', frequency: 'mensal', description: 'Dia 14 — pauta fixa no Hub a partir daqui' },
    ],
  },
  {
    id: 'ma',
    icon: '🔍',
    label: 'Rotina M&A / Due Diligence',
    desc: 'Assessoria em fusões, aquisições e sell-side — data room, modelo financeiro, pipeline.',
    color: '#B45309',
    routines: [
      { title: 'Acompanhar movimentações no data room', frequency: 'diaria', description: 'Verificar novos acessos, downloads e solicitações dos compradores' },
      { title: 'Registrar solicitações de VDD pendentes', frequency: 'diaria', description: 'Log no Hub — prazo de resposta máximo 48h' },
      { title: 'Comunicação com assessores legais', frequency: 'diaria', description: 'Atualização de pendências contratuais e diligências' },
      { title: 'Atualização do modelo financeiro (DCF / EV/EBITDA)', frequency: 'semanal', description: 'Incorporar dados novos — atualizar sensibilidades' },
      { title: 'Relatório de achados da due diligence', frequency: 'semanal', description: 'Red flags, questões relevantes, itens para esclarecimento' },
      { title: 'Reunião com management da empresa-alvo', frequency: 'semanal', description: 'Agenda fixa — status de integração de dados' },
      { title: 'Atualização do pipeline de compradores', frequency: 'semanal', description: 'Interesse indicativo, NDA assinado, NBO recebido' },
      { title: 'Revisão de NBO/BO recebidos', frequency: 'mensal', description: 'Análise comparativa e recomendação ao cliente vendedor' },
      { title: 'Atualização de teaser/Information Memorandum', frequency: 'mensal', description: 'Incorporar dados auditados e projeções revisadas' },
      { title: 'Status report ao cliente', frequency: 'mensal', description: 'Deck BX padrão — processo, timeline, próximos passos' },
    ],
  },
  {
    id: 'tesouraria',
    icon: '🏦',
    label: 'Rotina Tesouraria Diária',
    desc: 'Empresas em distress — cash management intensivo, posições de fundos, VOP.',
    color: '#0369A1',
    routines: [
      { title: 'Conciliação de extratos bancários', frequency: 'diaria', description: 'Todas as contas — PJ + aplicações + garantias' },
      { title: 'Posição de caixa consolidada', frequency: 'diaria', description: 'Caixa disponível + projeção D+1 e D+5' },
      { title: 'Autorização e execução de pagamentos', frequency: 'diaria', description: 'Priorização por urgência, vencimento e disponibilidade' },
      { title: 'Lançamento de VOP (Valor de Ordem de Pagamento)', frequency: 'diaria', description: 'Registrar no sistema e confirmar liquidação' },
      { title: 'Checagem de cheques e TEDs pendentes de compensação', frequency: 'diaria', description: 'Verificar retornos bancários e providenciar regularização' },
      { title: 'Reunião de caixa com CFO/Diretor Financeiro', frequency: 'diaria', description: 'Alinhamento de posição, aprovações e urgências do dia' },
      { title: 'Verificar vencimentos de títulos operados', frequency: 'diaria', description: 'Duplicatas, CCBs, CRIs — alertar com D-3 de antecedência' },
      { title: 'Atualização do fluxo de caixa Semana +4', frequency: 'semanal', description: 'Projeção rolante — identificar necessidades de captação' },
      { title: 'Posição consolidada de fundos (vencidos e a vencer)', frequency: 'semanal', description: 'FIDC, FII, fundos exclusivos — NAV atualizado' },
      { title: 'Atualização do controle de sacado', frequency: 'semanal', description: 'Base de recebíveis — inadimplência e recuperação' },
      { title: 'Projeção de gestão de caixa (semestre)', frequency: 'mensal', description: 'Até dia 10 — cenário base, otimista e pessimista' },
      { title: 'Atualização da base de CP (integração sistema cliente)', frequency: 'semanal', description: 'Pode variar conforme projeto/necessidade' },
    ],
  },
]

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().split('T')[0] }

function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = key.split('-')
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`
}

// Retorna quantos dias úteis (seg–sex) tem um mês para cálculo de compliance diário
function workDaysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number)
  const dim = new Date(y, m, 0).getDate()
  let count = 0
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(y, m - 1, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────
function Avatar({ prof, size = 6 }) {
  if (!prof) return null
  const initials = prof.initials || prof.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: prof.avatar_color || VL, fontSize: size <= 6 ? 10 : 12 }}
      title={prof.full_name}
    >{initials}</div>
  )
}

function FreqBadge({ frequency }) {
  const f = FREQ[frequency] || { label: frequency, color: '#9CA3AF', bg: '#F9FAFB' }
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: f.bg, color: f.color }}>{f.label}</span>
}

function ProgressBar({ done, total, height = 'h-1.5' }) {
  const pct = total > 0 ? Math.round(done / total * 100) : 0
  const color = pct === 100 ? GREEN : pct >= 60 ? AMBER : pct > 0 ? VL : '#E5E7EB'
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-zinc-100 rounded-full ${height} overflow-hidden`}>
        <div className={`${height} rounded-full transition-all duration-500`} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{done}/{total}</span>
    </div>
  )
}

// Gráfico de histórico mensal para uma rotina
function MonthlyHistoryChart({ routineId, frequency, completions }) {
  const months = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push(monthKey(d))
    }
    return result
  }, [])

  const data = useMemo(() => {
    return months.map(mk => {
      const relevant = completions.filter(c => {
        const dateStr = c.reference_date || c.completed_at?.slice(0, 10) || ''
        return c.routine_id === routineId && dateStr.startsWith(mk)
      })
      const executions = relevant.length
      let target = 1 // mensal/semanal: 1 execução no mês é ok
      if (frequency === 'semanal') target = 4
      if (frequency === 'diaria') target = workDaysInMonth(mk)
      const pct = target > 0 ? Math.min(100, Math.round(executions / target * 100)) : 0
      return { mk, executions, target, pct }
    })
  }, [months, completions, routineId, frequency])

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100">
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
        <BarChart2 className="w-3 h-3" /> Histórico 6 meses
      </div>
      <div className="flex items-end gap-1 h-10">
        {data.map(d => {
          const color = d.pct === 100 ? GREEN : d.pct >= 60 ? AMBER : d.pct > 0 ? VL : '#E5E7EB'
          const barH = d.pct > 0 ? Math.max(4, Math.round(d.pct / 100 * 40)) : 3
          return (
            <div key={d.mk} className="flex-1 flex flex-col items-center gap-0.5" title={`${monthLabel(d.mk)}: ${d.executions}/${d.target} (${d.pct}%)`}>
              <div className="w-full rounded-t-sm transition-all" style={{ height: barH, background: color }} />
              <span className="text-[8px] text-zinc-400 leading-none">{monthLabel(d.mk).split('/')[0]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Rotinas() {
  const { profile } = useData()
  usePageTitle('Rotinas')

  // Data state
  const [routines,      setRoutines]     = useState([])
  const [completions,   setCompletions]  = useState([])
  const [projects,      setProjects]     = useState([])
  const [companies,     setCompanies]    = useState([])
  const [profiles,      setProfilesList] = useState([])
  const [loading,       setLoading]      = useState(true)
  const [saving,        setSaving]       = useState(null)

  // View state
  const [activeView,   setActiveView]   = useState('hoje')  // 'hoje' | 'historico' | 'pendencias'
  const [projFilter,   setProjFilter]   = useState('all')   // project_id or 'all'

  // Histórico state
  const [histProj,    setHistProj]    = useState(null)    // selected project_id in history
  const [histRoutine, setHistRoutine] = useState(null)    // selected routine object in history

  // Late modal state
  const [lateModal, setLateModal] = useState(null)  // { routine, refDate, freq } | null
  const [lateWho,   setLateWho]   = useState('')
  const [lateDate,  setLateDate]  = useState('')
  const [lateObs,   setLateObs]   = useState('')
  const [lateSaving,setLateSaving]= useState(false)

  // Formulários
  const [showForm,      setShowForm]      = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [form, setForm] = useState({ title: '', frequency: 'semanal', assigned_to: '', company_id: '', project_id: '', description: '' })
  const [tplState, setTplState] = useState({ selectedId: null, company_id: '', project_id: '', assigned_to: '', step: 'choose' })

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const since = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]
    const [routR, compR, projR, profR, coR] = await Promise.allSettled([
      supabase.from('routines').select('*').eq('org_id', profile.org_id).eq('is_active', true).is('deleted_at', null).order('title'),
      supabase.from('routine_completions').select('*').eq('org_id', profile.org_id).gte('reference_date', since).limit(2000),
      supabase.from('projects').select('id,name,company_id,status').eq('org_id', profile.org_id).order('name'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('companies').select('id,name').eq('org_id', profile.org_id).order('name'),
    ])
    if (routR.status === 'fulfilled' && !routR.value.error) { setRoutines(routR.value.data || []); if (!histRoutine && routR.value.data?.length) { setHistRoutine(routR.value.data[0]); setHistProj(routR.value.data[0].project_id) } }
    if (compR.status === 'fulfilled' && !compR.value.error) setCompletions(compR.value.data || [])
    if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
    if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    if (coR.status  === 'fulfilled' && !coR.value.error)   setCompanies(coR.value.data || [])
    setLoading(false)
  }, [profile])
  useEffect(() => { load() }, [load])

  const todayStr  = todayISO()
  const currentMk = monthKey(new Date())

  // ── Compliance helpers ───────────────────────────────────────────────────
  function getReference(freq) {
    return FREQ_CFG[freq]?.ref() || todayStr
  }

  function getCompletionsInCycle(routineId, freq) {
    const ref = getReference(freq)
    return completions.filter(c => {
      if (c.routine_id !== routineId) return false
      const d = c.reference_date || c.completed_at?.slice(0, 10) || ''
      if (freq === 'diaria')  return d === ref
      if (freq === 'semanal') return d >= ref && d <= todayStr
      if (freq === 'mensal')  return d.startsWith(ref.slice(0, 7))
      return false
    })
  }

  function isDoneInCycle(r) {
    return getCompletionsInCycle(r.id, r.frequency).length > 0
  }

  function getCycleStatus(r) {
    const comps = getCompletionsInCycle(r.id, r.frequency)
    if (!comps.length) return null
    const hasLate = comps.some(c => c.execution_status === 'late')
    return hasLate ? 'late' : 'done'
  }

  function isDoneToday(id) {
    return completions.some(c => {
      if (c.routine_id !== id) return false
      const d = c.reference_date || c.completed_at?.slice(0, 10) || ''
      return d === todayStr
    })
  }

  function countThisMonth(id) {
    return completions.filter(c => {
      if (c.routine_id !== id) return false
      const d = c.reference_date || c.completed_at?.slice(0, 10) || ''
      return d.startsWith(currentMk)
    }).length
  }

  function lastDone(id) {
    const done = completions.filter(c => c.routine_id === id)
    if (!done.length) return null
    done.sort((a, b) => {
      const da = a.reference_date || a.completed_at?.slice(0, 10) || ''
      const db = b.reference_date || b.completed_at?.slice(0, 10) || ''
      return db.localeCompare(da)
    })
    return done[0].reference_date || done[0].completed_at?.slice(0, 10) || null
  }

  function isOverdue(r) {
    const last = lastDone(r.id)
    const days = FREQ[r.frequency]?.days || 7
    if (!last) {
      const createdAt = r.created_at ? r.created_at.slice(0, 10) : todayStr
      const daysSince = Math.floor((new Date(todayStr) - new Date(createdAt)) / 86400000)
      return daysSince >= days
    }
    return Math.floor((new Date(todayStr) - new Date(last)) / 86400000) >= days
  }

  // Compliance % para uma lista de rotinas no mês atual
  function calcCompliance(routineList) {
    const diarias = routineList.filter(r => r.frequency === 'diaria')
    const outras  = routineList.filter(r => r.frequency !== 'diaria')
    const daysElapsed = new Date().getDate()
    let done = 0, total = 0
    for (const r of diarias) { done += countThisMonth(r.id); total += daysElapsed }
    for (const r of outras) { if (completions.some(c => c.routine_id === r.id && (c.reference_date || c.completed_at?.slice(0,10)||''). startsWith(currentMk))) done++; total++ }
    return total > 0 ? Math.round(done / total * 100) : 0
  }

  // Maps
  const profMap = Object.fromEntries(profiles.map(p => [p.id, p]))
  const projMap = Object.fromEntries(projects.map(p => [p.id, p]))
  const compMap = Object.fromEntries(companies.map(c => [c.id, c]))

  // ── Toggle ───────────────────────────────────────────────────────────────
  async function toggle(r) {
    const ref  = getReference(r.frequency)
    const done = getCompletionsInCycle(r.id, r.frequency).length > 0
    setSaving(r.id)
    try {
      if (done) {
        const comp = completions.find(c => c.routine_id === r.id && (c.reference_date === ref || c.reference_date?.startsWith(ref.slice(0,7))))
        if (comp) {
          const { error } = await supabase.from('routine_completions').delete().eq('id', comp.id).eq('org_id', profile.org_id)
          if (error) throw error
        }
      } else {
        const { error } = await supabase.from('routine_completions').insert({
          routine_id: r.id, completed_by: profile.id,
          reference_date: ref, org_id: profile.org_id,
          execution_status: 'done',
        })
        if (error) throw error
        toast.success('✅ Rotina registrada')
      }
      await load()
    } catch (err) {
      toast.error('Erro: ' + err.message)
    } finally { setSaving(null) }
  }

  // ── Registrar execução em atraso ─────────────────────────────────────────
  async function saveLate() {
    if (!lateModal || !lateWho || !lateDate) { toast.warning('Preencha quem executou e a data'); return }
    setLateSaving(true)
    try {
      const { error } = await supabase.from('routine_completions').insert({
        routine_id: lateModal.routine.id,
        completed_by: lateWho,
        reference_date: lateModal.refDate,
        org_id: profile.org_id,
        execution_status: 'late',
        notes: lateObs || null,
      })
      if (error) throw error
      toast.success('⏰ Execução em atraso registrada')
      setLateModal(null)
      await load()
    } catch (err) {
      toast.error('Erro: ' + err.message)
    } finally { setLateSaving(false) }
  }

  // ── Criar rotina ─────────────────────────────────────────────────────────
  async function createRoutine() {
    if (!form.title.trim()) return
    if (!form.project_id) { toast.warning('Selecione um projeto'); return }
    const { error } = await supabase.from('routines').insert({
      org_id: profile.org_id, title: form.title.trim(),
      description: form.description.trim() || null,
      frequency: form.frequency,
      assigned_to: form.assigned_to || null,
      project_id: form.project_id || null,
      is_active: true,
    })
    if (error) { toast.error('Erro ao criar: ' + error.message); return }
    setShowForm(false)
    setForm({ title: '', frequency: 'semanal', assigned_to: '', company_id: '', project_id: '', description: '' })
    await load()
    toast.success('Rotina criada')
  }

  // ── Aplicar template ─────────────────────────────────────────────────────
  async function applyTemplate() {
    const tpl = TEMPLATE_LIBRARY.find(t => t.id === tplState.selectedId)
    if (!tpl || !tplState.project_id) { toast.warning('Selecione um projeto'); return }
    const inserts = tpl.routines.map(r => ({
      org_id: profile.org_id, title: r.title, description: r.description || null,
      frequency: r.frequency, assigned_to: tplState.assigned_to || null,
      project_id: tplState.project_id || null, is_active: true,
    }))
    const { error } = await supabase.from('routines').insert(inserts)
    if (error) { toast.error('Erro ao aplicar template: ' + error.message); return }
    setShowTemplates(false)
    setTplState({ selectedId: null, company_id: '', project_id: '', assigned_to: '', step: 'choose' })
    await load()
    toast.success(`✅ ${tpl.routines.length} rotinas criadas a partir do template "${tpl.label}"`)
  }

  // ── Arquivar rotina ──────────────────────────────────────────────────────
  async function archive(id) {
    const { error } = await supabase.from('routines').update({ is_active: false }).eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao arquivar: ' + error.message); return }
    await load(); toast.success('Rotina arquivada — histórico preservado')
  }

  async function archivePhase(projectId, projectName) {
    const ok = await confirm(`Encerrar fase "${projectName}"?\n\nTodas as ${routines.filter(r => r.project_id === projectId).length} rotinas serão arquivadas. O histórico fica preservado.`, { danger: true, confirmLabel: 'Encerrar fase', cancelLabel: 'Cancelar' })
    if (!ok) return
    const { error } = await supabase.from('routines').update({ is_active: false }).eq('org_id', profile.org_id).eq('project_id', projectId)
    if (error) { toast.error('Erro: ' + error.message); return }
    await load(); toast.success(`✅ Fase "${projectName}" encerrada`)
  }

  // ── Grouping helpers ─────────────────────────────────────────────────────
  const routinesByProject = useMemo(() => {
    const map = {}
    routines.forEach(r => {
      const pid = r.project_id || '__sem_projeto__'
      if (!map[pid]) map[pid] = []
      map[pid].push(r)
    })
    return map
  }, [routines])

  const projectsWithRoutines = useMemo(() =>
    projects.filter(p => routinesByProject[p.id]?.length > 0),
  [projects, routinesByProject])

  const filteredByProjAndFreq = (freq) => {
    let rs = routines.filter(r => r.frequency === freq)
    if (projFilter !== 'all') rs = rs.filter(r => r.project_id === projFilter)
    return rs
  }

  // Pendências analysis
  const pendencias = useMemo(() => {
    const criticos = []
    const atencao  = []
    const tardios  = []

    routines.forEach(r => {
      // Check consecutive misses (diárias: últimos 3 dias úteis)
      if (r.frequency === 'diaria') {
        let missed = 0
        for (let i = 1; i <= 5; i++) {
          const d = new Date(); d.setDate(d.getDate() - i)
          const dow = d.getDay(); if (dow === 0 || dow === 6) continue
          const dStr = d.toISOString().split('T')[0]
          const hasDone = completions.some(c => c.routine_id === r.id && (c.reference_date === dStr || c.completed_at?.startsWith(dStr)))
          if (!hasDone) missed++; else break
        }
        if (missed >= 3) {
          criticos.push({ routine: r, type: 'consecutive_miss', count: missed })
        } else if (missed >= 1) {
          atencao.push({ routine: r, type: 'recent_miss', count: missed })
        }
      }

      // Late completions
      const lateComps = completions.filter(c => c.routine_id === r.id && c.execution_status === 'late')
      if (lateComps.length > 0) {
        tardios.push({ routine: r, lates: lateComps })
      }

      // Monthly overdue
      if (r.frequency === 'mensal') {
        const today = new Date()
        const refDate = getReference('mensal')
        const hasDoneThisMonth = completions.some(c => c.routine_id === r.id && (c.reference_date || '').startsWith(today.toISOString().slice(0,7)))
        if (!hasDoneThisMonth) {
          const dueMatch = r.description?.match(/DIA\s*(\d+)/i)
          const dueDay = dueMatch ? parseInt(dueMatch[1]) : null
          if (dueDay && today.getDate() > dueDay) {
            const daysLate = today.getDate() - dueDay
            criticos.push({ routine: r, type: 'monthly_overdue', daysLate, dueDay })
          }
        }
      }
    })
    return { criticos, atencao, tardios, total: criticos.length + atencao.length }
  }, [routines, completions])

  // ── Calendar builders ────────────────────────────────────────────────────
  function buildDailyCells(routineId) {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const firstDow = new Date(year, month, 1).getDay()
    const blanks = firstDow === 0 ? 6 : firstDow - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < blanks; i++) cells.push({ type: 'sp' })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dow  = date.getDay()
      const we   = dow === 0 || dow === 6
      const dStr = date.toISOString().split('T')[0]
      const future = dStr > todayStr
      if (future) { cells.push({ type: 'fu', d, dStr, we }); continue }
      if (we)     { cells.push({ type: 'we', d, dStr }); continue }
      const comp = completions.filter(c => c.routine_id === routineId && (c.reference_date === dStr || c.completed_at?.startsWith(dStr)))
      const status = comp.length === 0 ? 'miss' : comp.some(c => c.execution_status === 'late') ? 'late' : 'ok'
      const covComp = comp.find(c => c.completed_by !== routines.find(r=>r.id===routineId)?.assigned_to && c.execution_status !== 'late')
      const covProf = covComp ? profMap[covComp.completed_by] : null
      cells.push({ type: status, d, dStr, today: dStr === todayStr, cov: covProf })
    }
    return cells
  }

  function buildWeeklyCells(routineId) {
    const weeks = []
    const today = new Date()
    for (let w = 5; w >= 0; w--) {
      const monday = new Date(today)
      monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) - w * 7)
      const mondayStr = monday.toISOString().split('T')[0]
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
      const sundayStr = sunday.toISOString().split('T')[0]
      const isCurrent = w === 0
      if (isCurrent) { weeks.push({ wStr: mondayStr, label: 'Esta semana', status: 'pend', cur: true }); continue }
      const comp = completions.filter(c => c.routine_id === routineId && (c.reference_date || '') >= mondayStr && (c.reference_date || '') <= sundayStr)
      const status = comp.length === 0 ? 'miss' : comp.some(c => c.execution_status === 'late') ? 'late' : 'ok'
      const covComp = comp.find(c => c.completed_by !== routines.find(r=>r.id===routineId)?.assigned_to)
      const covProf = covComp ? profMap[covComp.completed_by] : null
      const wLabel = monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      weeks.push({ wStr: mondayStr, label: wLabel, status, cov: covProf })
    }
    return weeks.reverse()
  }

  function buildMonthlyCells(routineId) {
    const cells = []
    const today = new Date()
    for (let m = 5; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1)
      const mk = d.toISOString().slice(0,7)
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      const isCurrent = m === 0
      if (isCurrent) { cells.push({ mk, label, status: 'pend', cur: true }); continue }
      const comp = completions.filter(c => c.routine_id === routineId && (c.reference_date || '').startsWith(mk))
      const status = comp.length === 0 ? 'miss' : comp.some(c => c.execution_status === 'late') ? 'late' : 'ok'
      const covComp = comp.find(c => c.completed_by !== routines.find(r=>r.id===routineId)?.assigned_to)
      const covProf = covComp ? profMap[covComp.completed_by] : null
      cells.push({ mk, label, status, cov: covProf })
    }
    return cells.reverse()
  }

  const projectsForForm = form.company_id ? projects.filter(p => p.company_id === form.company_id) : projects
  const projectsForTpl  = tplState.company_id ? projects.filter(p => p.company_id === tplState.company_id) : projects

  // ── Modal de Templates ─────────────────────────────────────────────────
  function TemplateModal() {
    const tpl = TEMPLATE_LIBRARY.find(t => t.id === tplState.selectedId)

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-zinc-100">
            <div>
              <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5" style={{ color: VL }} />
                Biblioteca de Templates
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Selecione um pacote pré-montado e associe a um projeto</p>
            </div>
            <button onClick={() => { setShowTemplates(false); setTplState({ selectedId: null, company_id: '', project_id: '', assigned_to: '', step: 'choose' }) }}
              className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5">
            {tplState.step === 'choose' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {TEMPLATE_LIBRARY.map(t => (
                  <button key={t.id}
                    onClick={() => setTplState(p => ({ ...p, selectedId: t.id, step: 'configure' }))}
                    className="text-left p-4 rounded-xl border-2 hover:shadow-md transition-all"
                    style={{ borderColor: tplState.selectedId === t.id ? t.color : '#E5E7EB',
                             background: tplState.selectedId === t.id ? `${t.color}08` : '#FAFAFA' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{t.icon}</span>
                      <div>
                        <div className="text-sm font-bold text-zinc-800">{t.label}</div>
                        <div className="text-[10px] font-bold" style={{ color: t.color }}>
                          {t.routines.length} rotinas · {t.routines.filter(r => r.frequency === 'diaria').length}D / {t.routines.filter(r => r.frequency === 'semanal').length}S / {t.routines.filter(r => r.frequency === 'mensal').length}M
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{t.desc}</p>
                  </button>
                ))}
              </div>
            ) : tpl ? (
              <div>
                <button onClick={() => setTplState(p => ({ ...p, step: 'choose' }))}
                  className="text-xs text-zinc-400 hover:text-zinc-600 mb-4 flex items-center gap-1">
                  ← Voltar aos templates
                </button>

                <div className="flex items-center gap-3 mb-5 p-4 rounded-xl" style={{ background: `${tpl.color}10`, border: `1.5px solid ${tpl.color}30` }}>
                  <span className="text-3xl">{tpl.icon}</span>
                  <div>
                    <div className="font-bold text-zinc-800">{tpl.label}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {tpl.routines.length} rotinas — {tpl.routines.filter(r => r.frequency === 'diaria').length} diárias · {tpl.routines.filter(r => r.frequency === 'semanal').length} semanais · {tpl.routines.filter(r => r.frequency === 'mensal').length} mensais
                    </div>
                  </div>
                </div>

                {/* Configurar empresa/projeto/responsável */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Empresa</label>
                    <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500"
                      value={tplState.company_id}
                      onChange={e => setTplState(p => ({ ...p, company_id: e.target.value, project_id: '' }))}>
                      <option value="">— nenhuma —</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">
                      Projeto <span className="text-red-500">*</span>
                      {tplState.company_id && projectsForTpl.length > 0 && <span className="text-zinc-400 font-normal"> ({projectsForTpl.length})</span>}
                    </label>
                    <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500"
                      value={tplState.project_id}
                      onChange={e => setTplState(p => ({ ...p, project_id: e.target.value }))}>
                      <option value="">— sem projeto —</option>
                      {projectsForTpl.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Responsável padrão</label>
                    <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500"
                      value={tplState.assigned_to}
                      onChange={e => setTplState(p => ({ ...p, assigned_to: e.target.value }))}>
                      <option value="">— nenhum —</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Preview das rotinas */}
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Preview das rotinas</div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {tpl.routines.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50">
                      <FreqBadge frequency={r.frequency} />
                      <span className="text-xs text-zinc-700 flex-1 truncate">{r.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {tplState.step === 'configure' && tpl && (
            <div className="p-5 border-t border-zinc-100 flex gap-3 justify-end">
              <button onClick={() => setTplState(p => ({ ...p, step: 'choose' }))}
                className="text-sm text-zinc-500 px-4 py-2 rounded-xl hover:bg-zinc-100">
                Voltar
              </button>
              <button onClick={applyTemplate}
                disabled={!tplState.project_id}
                className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: tpl.color }}>
                <Zap className="w-4 h-4" />
                {tplState.project_id ? `Criar ${tpl.routines.length} rotinas` : 'Selecione um projeto'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Helpers de cor/status ────────────────────────────────────────────────
  const statusColors = {
    ok:   { bg: '#D1FAE5', border: '#A7F3D0', text: '#065F46', icon: '✓' },
    late: { bg: '#FEF3C7', border: '#FDE68A', text: '#92400E', icon: '⏰' },
    miss: { bg: '#FEE2E2', border: '#FECACA', text: '#991B1B', icon: '✗' },
    pend: { bg: '#EEF2FF', border: '#DDD6FE', text: VL,        icon: '●' },
    fu:   { bg: '#F9FAFB', border: '#F3F4F6', text: '#E5E7EB', icon: '' },
    we:   { bg: '#F4F5F8', border: '#F4F5F8', text: '#D1D5DB', icon: '—' },
    sp:   { bg: 'transparent', border: 'transparent', text: '', icon: '' },
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64 text-zinc-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Carregando rotinas…
    </div>
  )

  const allDone = routines.filter(r => isDoneInCycle(r)).length
  const allOverdue = routines.filter(r => !isDoneInCycle(r) && isOverdue(r)).length
  const compliance = routines.length > 0 ? Math.round(allDone / routines.length * 100) : 0
  const pctColor = compliance >= 80 ? '#4ADE80' : compliance >= 50 ? AMBER : '#F87171'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {showTemplates && <TemplateModal />}

      {/* ── HERO ── */}
      <div style={{ background: CH, flexShrink: 0, padding: '16px 24px 0' }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>
          🔄 Compliance Operacional
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Rotinas</h1>
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              {routines.length} ativas · {projectsWithRoutines.length} projeto{projectsWithRoutines.length !== 1 ? 's' : ''} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {[
              { label: 'Compliance', value: compliance + '%', color: pctColor },
              { label: 'Feitas', value: allDone, color: '#A5B4FC' },
              { label: 'Em atraso', value: allOverdue, color: allOverdue > 0 ? '#F87171' : '#4ADE80' },
              { label: 'Pendências', value: pendencias.total, color: pendencias.total > 0 ? '#FBBF24' : '#4ADE80' },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '8px 12px', textAlign: 'center', minWidth: 72 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 2 }}>{k.value}</div>
                <div style={{ fontSize: 8.5, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
            {/* Actions */}
            <button onClick={() => setShowTemplates(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <BookOpen style={{ width: 14, height: 14 }} /> Templates
            </button>
            <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: VL, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Plus style={{ width: 14, height: 14 }} /> Nova rotina
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 5, background: 'rgba(255,255,255,.1)', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', borderRadius: 99, background: compliance >= 80 ? GREEN : compliance >= 50 ? AMBER : VL, width: compliance + '%', transition: 'width .5s' }} />
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { id: 'hoje',       label: '📋 Rotinas',   cnt: routines.length },
            { id: 'historico',  label: '📊 Histórico' },
            { id: 'pendencias', label: '⚠️ Pendências', cnt: pendencias.total, warn: pendencias.total > 0 },
          ].map(t => {
            const on = activeView === t.id
            return (
              <button key={t.id} onClick={() => setActiveView(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', fontSize: 12, fontWeight: on ? 600 : 500,
                borderRadius: '8px 8px 0 0', cursor: 'pointer',
                border: '1px solid transparent', borderBottom: 'none',
                background: on ? '#fff' : 'transparent',
                color: on ? (t.warn ? RED : VL) : t.warn ? '#FCA5A5' : '#6B7280',
                borderColor: on ? 'rgba(255,255,255,.12)' : 'transparent',
                outline: 'none',
              }}>
                {t.label}
                {t.cnt !== undefined && (
                  <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 99, background: on ? (t.warn ? '#FEE2E2' : '#EEF2FF') : 'rgba(255,255,255,.1)', color: on ? (t.warn ? RED : VL) : '#9CA3AF' }}>{t.cnt}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          VIEW: HOJE — 3 colunas
      ════════════════════════════════════════════════════════════════ */}
      {activeView === 'hoje' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Project pills */}
          {projectsWithRoutines.length > 1 && (
            <div style={{ padding: '8px 24px 0', background: '#F4F5F8', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>Projeto:</span>
              {[{ id: 'all', name: 'Todos', cnt: routines.length, color: '#6366F1', pct: null }, ...projectsWithRoutines.map(p => {
                const prs = routinesByProject[p.id] || []
                const pct = calcCompliance(prs)
                return { id: p.id, name: p.name, cnt: prs.length, color: '#F59E0B', pct }
              })].map(p => {
                const on = projFilter === p.id
                return (
                  <button key={p.id} onClick={() => setProjFilter(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                    borderRadius: 99, cursor: 'pointer', fontSize: 11.5, fontWeight: on ? 600 : 500,
                    border: `1.5px solid ${on ? VL : '#E5E7EB'}`,
                    background: on ? '#EEF2FF' : '#fff', color: on ? VL : '#6B7280',
                    outline: 'none',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    {p.name.length > 20 ? p.name.slice(0,20)+'…' : p.name}
                    <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 99, background: on ? '#DDD6FE' : 'rgba(0,0,0,.06)', color: on ? VL : '#9CA3AF', fontWeight: 600 }}>{p.cnt}</span>
                    {p.pct !== null && <span style={{ fontSize: 10, fontWeight: 700, color: p.pct >= 80 ? GREEN : p.pct >= 50 ? AMBER : RED }}>{p.pct}%</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* 3 columns */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 14, padding: '10px 24px 16px' }}>
            {['diaria', 'semanal', 'mensal'].map(freq => {
              const cfg = FREQ_CFG[freq]
              const rs  = filteredByProjAndFreq(freq)
              if (!rs.length) return <div key={freq} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 12 }}>Sem {cfg.title.toLowerCase()} neste projeto</div>
              const done = rs.filter(r => isDoneInCycle(r)).length
              const pct  = Math.round(done / rs.length * 100)
              const bc   = pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED
              const pc   = pct >= 80 ? '#6EE7B7' : pct >= 50 ? '#FCD34D' : '#FCA5A5'

              // Group by project within column
              const byProj = {}
              rs.forEach(r => { const pid = r.project_id || '__'; if (!byProj[pid]) byProj[pid] = []; byProj[pid].push(r) })

              return (
                <div key={freq} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Column header */}
                  <div style={{ background: `linear-gradient(135deg,${cfg.hbg},${cfg.hbg}ee)`, borderRadius: '9px 9px 0 0', padding: '11px 13px', flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      {cfg.icon} {cfg.title}
                      <span style={{ fontSize: 8.5, background: 'rgba(255,255,255,.15)', padding: '1px 7px', borderRadius: 99, marginLeft: 'auto' }}>{rs.length}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginBottom: 2 }}>{cfg.ref()}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginBottom: 7 }}>🔄 {cfg.cycle}</div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,.12)', borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
                      <div style={{ height: '100%', borderRadius: 99, background: bc, width: pct + '%', transition: 'width .4s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700 }}>
                      <span style={{ color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Compliance</span>
                      <span style={{ color: pc }}>{done}/{rs.length} · {pct}%</span>
                    </div>
                  </div>
                  {/* Column body */}
                  <div style={{ border: '1px solid #EAECF0', borderTop: 'none', borderRadius: '0 0 9px 9px', flex: 1, overflowY: 'auto', background: '#fff' }}>
                    {Object.entries(byProj).map(([pid, prs]) => {
                      const proj = projMap[pid]
                      const pdone = prs.filter(r => isDoneInCycle(r)).length
                      return (
                        <div key={pid}>
                          {projFilter === 'all' && Object.keys(byProj).length > 1 && (
                            <div style={{ padding: '4px 13px 3px', background: '#F4F5F8', borderBottom: '1px solid #EAECF0', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj?.name || 'Sem projeto'}</span>
                              <span style={{ fontSize: 9, color: '#9CA3AF' }}>{pdone}/{prs.length}</span>
                            </div>
                          )}
                          {prs.map(r => {
                            const doneCycle = isDoneInCycle(r)
                            const st = getCycleStatus(r)
                            const overdueFl = !doneCycle && isOverdue(r)
                            const prof = profMap[r.assigned_to]
                            const lastDate = lastDone(r.id)
                            const isLate = st === 'late'
                            const rowBg = doneCycle ? (isLate ? '#FFFBEB' : '#F0FDF4') : overdueFl ? '#FEF9F9' : '#fff'
                            return (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 13px', borderBottom: '1px solid #F9FAFB', cursor: 'pointer', background: rowBg, transition: 'background .1s' }}
                                onMouseEnter={e => { if (!doneCycle) e.currentTarget.style.background = '#FAFBFF' }}
                                onMouseLeave={e => e.currentTarget.style.background = rowBg}
                              >
                                {/* Checkbox */}
                                <button onClick={() => toggle(r)} disabled={saving === r.id} style={{
                                  width: 20, height: 20, borderRadius: '50%', border: `2px solid ${doneCycle ? (isLate ? AMBER : GREEN) : overdueFl ? RED : '#D1D5DB'}`,
                                  background: doneCycle ? (isLate ? AMBER : GREEN) : '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 1,
                                  transition: 'all .15s'
                                }}>
                                  {saving === r.id
                                    ? <div style={{ width: 8, height: 8, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                    : doneCycle ? <Check style={{ width: 10, height: 10, color: '#fff' }} /> : null
                                  }
                                </button>
                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11.5, fontWeight: 500, color: doneCycle ? '#9CA3AF' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: doneCycle ? 'line-through' : 'none' }}>
                                    {r.title}
                                  </div>
                                  {r.description && <div style={{ fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                                  {/* Late warning for monthly */}
                                  {r.frequency === 'mensal' && !doneCycle && (() => {
                                    const m = r.description?.match(/DIA\s*(\d+)/i); const dueDay = m ? parseInt(m[1]) : null
                                    const today = new Date().getDate()
                                    if (!dueDay) return null
                                    if (today > dueDay) return <div style={{ fontSize: 9.5, fontWeight: 600, color: RED, marginTop: 2 }}>⚠ {today - dueDay}d atrasada · prazo era dia {dueDay}</div>
                                    if (dueDay - today <= 5) return <div style={{ fontSize: 9.5, fontWeight: 600, color: AMBER, marginTop: 2 }}>⏰ Vence em {dueDay - today}d (dia {dueDay})</div>
                                    return <div style={{ fontSize: 9.5, color: '#9CA3AF', marginTop: 2 }}>Até dia {dueDay}</div>
                                  })()}
                                </div>
                                {/* Meta */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginTop: 1 }}>
                                  {doneCycle && isLate && <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: '#FEF3C7', color: '#92400E' }}>⏰ atraso</span>}
                                  {overdueFl && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: '#FEE2E2', color: RED, border: '1px solid #FECACA' }}>atraso</span>}
                                  {prof && <Avatar prof={prof} size={5} />}
                                  <button onClick={() => { setActiveView('historico'); setHistRoutine(r); setHistProj(r.project_id) }}
                                    style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #EAECF0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10 }}>
                                    📊
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW: HISTÓRICO — split panel
      ════════════════════════════════════════════════════════════════ */}
      {activeView === 'historico' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Summary bar */}
          <div style={{ background: '#fff', borderBottom: '1px solid #EAECF0', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            {[
              { label: 'Geral',    value: compliance + '%', color: compliance >= 80 ? GREEN : AMBER },
              { label: 'Diárias',  value: (() => { const rs = routines.filter(r=>r.frequency==='diaria'); const d=rs.filter(r=>isDoneInCycle(r)).length; return rs.length ? Math.round(d/rs.length*100)+'%' : '—' })(), color: '#6366F1' },
              { label: 'Semanais', value: (() => { const rs = routines.filter(r=>r.frequency==='semanal'); const d=rs.filter(r=>isDoneInCycle(r)).length; return rs.length ? Math.round(d/rs.length*100)+'%' : '—' })(), color: '#F59E0B' },
              { label: 'Mensais',  value: (() => { const rs = routines.filter(r=>r.frequency==='mensal'); const d=rs.filter(r=>isDoneInCycle(r)).length; return rs.length ? Math.round(d/rs.length*100)+'%' : '—' })(), color: GREEN },
              { label: 'Misses',   value: allOverdue, color: allOverdue > 0 ? RED : GREEN },
            ].map((k, i, arr) => (
              <div key={k.label} style={{ padding: '0 14px', borderRight: i < arr.length-1 ? '1px solid #EAECF0' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 8.5, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Panels */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            {/* Panel A: projects + routines */}
            <div style={{ width: 260, minWidth: 260, borderRight: '1px solid #EAECF0', display: 'flex', flexDirection: 'column', background: '#FAFBFD', overflow: 'hidden' }}>
              {/* Project tabs */}
              <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid #EAECF0', flexShrink: 0 }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 5, padding: '0 2px' }}>Projetos</div>
                {projectsWithRoutines.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#9CA3AF', padding: '4px 2px' }}>Nenhum projeto com rotinas</div>
                ) : projectsWithRoutines.map(p => {
                  const prs = routinesByProject[p.id] || []
                  const ppct = calcCompliance(prs)
                  const on = histProj === p.id
                  return (
                    <button key={p.id} onClick={() => { setHistProj(p.id); if (prs.length) setHistRoutine(prs[0]) }} style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px',
                      borderRadius: 7, cursor: 'pointer', border: `1.5px solid ${on ? 'rgba(84,82,193,.3)' : 'transparent'}`,
                      background: on ? '#EEF2FF' : 'transparent', fontFamily: 'inherit',
                      textAlign: 'left', width: '100%', marginBottom: 2, outline: 'none',
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, fontWeight: on ? 600 : 500, color: on ? VL : '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: on ? '#DDD6FE' : '#EAECF0', color: on ? VL : '#9CA3AF', fontWeight: 600 }}>{prs.length}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, minWidth: 28, textAlign: 'right', color: ppct >= 80 ? GREEN : ppct >= 60 ? AMBER : RED }}>{ppct}%</span>
                    </button>
                  )
                })}
              </div>

              {/* Routine list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {['diaria', 'semanal', 'mensal'].map(freq => {
                  const cfg = FREQ_CFG[freq]
                  const frs = histProj
                    ? (routinesByProject[histProj] || []).filter(r => r.frequency === freq)
                    : routines.filter(r => r.frequency === freq)
                  if (!frs.length) return null
                  const avg = Math.round(frs.reduce((s,r) => s + (isDoneInCycle(r) ? 100 : 0), 0) / frs.length)
                  const avgClr = avg >= 80 ? GREEN : avg >= 60 ? AMBER : RED
                  return (
                    <div key={freq}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px 3px', position: 'sticky', top: 0, zIndex: 1, background: '#F1F3F7', borderBottom: '1px solid #EAECF0' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
                        <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: cfg.dot }}>{cfg.title}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 'auto', color: avgClr }}>{avg}%</span>
                      </div>
                      {frs.map(r => {
                        const doneCycle = isDoneInCycle(r)
                        const st = getCycleStatus(r)
                        const sd = doneCycle ? (st === 'late' ? AMBER : GREEN) : isOverdue(r) ? RED : '#9CA3AF'
                        const isSel = histRoutine?.id === r.id
                        const hasMiss = !doneCycle && isOverdue(r)
                        return (
                          <div key={r.id} onClick={() => setHistRoutine(r)} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                            cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                            background: isSel ? '#EEF2FF' : 'transparent',
                            borderLeft: isSel ? `3px solid ${VL}` : '3px solid transparent',
                            transition: 'all .1s'
                          }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: sd, flexShrink: 0 }} />
                            <span style={{ fontSize: 11.5, fontWeight: isSel ? 600 : 400, color: isSel ? VL : '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                            {hasMiss && <span style={{ fontSize: 10, flexShrink: 0 }}>⚠️</span>}
                            {st === 'late' && <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 99, background: '#FEF3C7', color: '#92400E', flexShrink: 0, fontWeight: 600 }}>⏰</span>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Panel B: calendar */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
              {!histRoutine ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', padding: 40 }}>
                  <div style={{ fontSize: 48, opacity: .2, marginBottom: 12 }}>📅</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Selecione uma rotina</div>
                  <div style={{ fontSize: 11.5, textAlign: 'center', lineHeight: 1.6 }}>Escolha um projeto e uma rotina à esquerda para ver o histórico completo</div>
                </div>
              ) : (() => {
                const r = histRoutine
                const prof = profMap[r.assigned_to]
                const doneCycle = isDoneInCycle(r)
                const st = getCycleStatus(r)
                const freqCfg = {
                  diaria:  { bg: '#EEF2FF', clr: '#4338CA', lbl: 'Diária' },
                  semanal: { bg: '#FEF3C7', clr: '#92400E', lbl: 'Semanal' },
                  mensal:  { bg: '#D1FAE5', clr: '#065F46', lbl: 'Mensal' },
                }[r.frequency]
                const allComps = completions.filter(c => c.routine_id === r.id)
                const okCnt   = allComps.filter(c => c.execution_status !== 'late').length
                const lateCnt = allComps.filter(c => c.execution_status === 'late').length
                const covCnt  = allComps.filter(c => c.completed_by !== r.assigned_to).length

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    {/* Calendar header */}
                    <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #EAECF0', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0, marginTop: 4, background: freqCfg.bg, color: freqCfg.clr }}>{freqCfg.lbl}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', flex: 1, lineHeight: 1.3 }}>{r.title}</span>
                        {prof && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B7280', flexShrink: 0, marginTop: 3 }}><Avatar prof={prof} size={5} />{prof.full_name.split(' ')[0]}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => archive(r.id)} title="Arquivar" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #EAECF0', background: '#fff', cursor: 'pointer', fontSize: 10, color: '#9CA3AF' }}>
                            <Archive style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      </div>
                      {/* Metrics */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[
                          { label: 'No prazo',  value: okCnt,   color: GREEN },
                          { label: 'Em atraso', value: lateCnt, color: AMBER },
                          { label: 'Coberturas',value: covCnt,  color: VL   },
                          { label: 'Ciclo atual',value: doneCycle ? (st === 'late' ? '⏰' : '✅') : '⏳', color: doneCycle ? (st === 'late' ? AMBER : GREEN) : '#9CA3AF' },
                        ].map(m => (
                          <div key={m.label} style={{ flex: 1, background: '#F9FAFB', border: '1px solid #EAECF0', borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1, marginBottom: 2, color: m.color }}>{m.value}</div>
                            <div style={{ fontSize: 8.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Calendar grid */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
                      {r.frequency === 'diaria' && (() => {
                        const cells = buildDailyCells(r.id)
                        const wkH = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
                        return (
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
                              {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 4, marginBottom: 4 }}>
                              {wkH.map((w, i) => <div key={w} style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textAlign: 'center', opacity: i >= 5 ? .4 : 1 }}>{w}</div>)}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 4 }}>
                              {cells.map((c, i) => {
                                const sc = statusColors[c.type] || statusColors.sp
                                const canMarkLate = c.type === 'miss'
                                return (
                                  <div key={i} title={c.type === 'miss' ? `${c.dStr} — Clique para registrar atraso` : c.dStr || ''} onClick={() => canMarkLate && setLateModal({ routine: r, refDate: c.dStr, freq: 'diaria' })}
                                    style={{
                                      width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9.5, fontWeight: 600, cursor: canMarkLate ? 'pointer' : 'default',
                                      position: 'relative', border: `1.5px solid ${sc.border}`,
                                      background: sc.bg, color: sc.text,
                                      outline: c.today ? `2px solid ${VL}` : 'none', outlineOffset: 2,
                                      visibility: c.type === 'sp' ? 'hidden' : 'visible',
                                      transition: 'transform .1s',
                                    }}
                                    onMouseEnter={e => { if (canMarkLate) e.currentTarget.style.transform = 'scale(1.15)' }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                                  >
                                    {sc.icon}
                                    {c.cov && c.type !== 'miss' && <div style={{ position: 'absolute', bottom: 2, right: 2, width: 7, height: 7, borderRadius: '50%', background: c.cov.avatar_color || VL, border: '1.5px solid #fff' }} />}
                                  </div>
                                )
                              })}
                            </div>
                            {cells.some(c => c.type === 'miss') && (
                              <div style={{ marginTop: 10, padding: '8px 11px', background: '#FFF8EE', border: '1px solid #FDE68A', borderRadius: 7, fontSize: 11, color: '#92400E', display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span>⏰</span>
                                <span>Clique em qualquer célula <strong>vermelha ✗</strong> para registrar execução com atraso — muda para <strong style={{ color: AMBER }}>amarelo</strong></span>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {r.frequency === 'semanal' && (() => {
                        const weeks = buildWeeklyCells(r.id)
                        return (
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>Semanas — referência: segunda-feira</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {weeks.map((w, i) => {
                                const sc = statusColors[w.status]
                                const canMarkLate = w.status === 'miss'
                                const icon = w.status === 'ok' ? '✅' : w.status === 'late' ? '⏰' : w.status === 'miss' ? '❌' : '🔄'
                                return (
                                  <div key={i} onClick={() => canMarkLate && setLateModal({ routine: r, refDate: w.wStr, freq: 'semanal' })}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '9px 12px', borderRadius: 9, minWidth: 76, cursor: canMarkLate ? 'pointer' : 'default', border: `1.5px solid ${w.cur ? VL : sc.border}`, background: sc.bg, transition: 'transform .1s' }}
                                    onMouseEnter={e => { if (canMarkLate) e.currentTarget.style.transform = 'scale(1.04)' }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                                  >
                                    <div style={{ fontSize: 15, marginBottom: 3 }}>{icon}</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: sc.text }}>{w.cur ? 'Esta semana' : w.label}</div>
                                    {w.cov && <div style={{ fontSize: 8.5, color: AMBER, marginTop: 2, display: 'flex', alignItems: 'center', gap: 2 }}><Avatar prof={w.cov} size={3} />{w.cov.full_name?.split(' ')[0]} (cob.)</div>}
                                  </div>
                                )
                              })}
                            </div>
                            {weeks.some(w => w.status === 'miss') && (
                              <div style={{ marginTop: 12, padding: '8px 11px', background: '#FFF8EE', border: '1px solid #FDE68A', borderRadius: 7, fontSize: 11, color: '#92400E', display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span>⏰</span><span>Clique em qualquer semana <strong>vermelha ❌</strong> para registrar atraso</span>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {r.frequency === 'mensal' && (() => {
                        const months = buildMonthlyCells(r.id)
                        const dueMatch = r.description?.match(/DIA\s*(\d+)/i)
                        const dueDay = dueMatch ? parseInt(dueMatch[1]) : null
                        const today = new Date().getDate()
                        return (
                          <div>
                            {dueDay && !isDoneInCycle(r) && today > dueDay && (
                              <div style={{ background: '#FEF9F9', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: RED, marginBottom: 14 }}>
                                <span style={{ fontSize: 16 }}>⚠️</span>
                                <strong>Prazo vencido:</strong> era até dia {dueDay} · {today - dueDay} dias de atraso
                              </div>
                            )}
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>Meses — referência: dia 1 · 1 execução por mês</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {months.map((m, i) => {
                                const sc = statusColors[m.status]
                                const canMarkLate = m.status === 'miss'
                                const icon = m.status === 'ok' ? '✅' : m.status === 'late' ? '⏰' : m.status === 'miss' ? '❌' : '🔄'
                                return (
                                  <div key={i} onClick={() => canMarkLate && setLateModal({ routine: r, refDate: m.mk + '-01', freq: 'mensal' })}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 14px', borderRadius: 9, minWidth: 76, cursor: canMarkLate ? 'pointer' : 'default', border: `1.5px solid ${m.cur ? VL : sc.border}`, background: sc.bg, transition: 'transform .1s' }}
                                    onMouseEnter={e => { if (canMarkLate) e.currentTarget.style.transform = 'scale(1.04)' }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                                  >
                                    <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: sc.text }}>{m.label}</div>
                                    {m.cov && <div style={{ fontSize: 8.5, color: AMBER, marginTop: 2, display: 'flex', alignItems: 'center', gap: 2 }}><Avatar prof={m.cov} size={3} />{m.cov.full_name?.split(' ')[0]} (cob.)</div>}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Footer legend */}
                    <div style={{ borderTop: '1px solid #EAECF0', padding: '10px 18px', background: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flexShrink: 0 }}>
                      {[
                        { bg: '#D1FAE5', border: '#A7F3D0', label: 'Feito no prazo' },
                        { bg: '#FEF3C7', border: '#FDE68A', label: 'Feito com atraso', dot: AMBER },
                        { bg: '#FEE2E2', border: '#FECACA', label: 'Não feito' },
                        { bg: '#EEF2FF', border: '#DDD6FE', label: 'Pendente' },
                      ].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#6B7280' }}>
                          <div style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${l.border}`, background: l.bg, flexShrink: 0, position: 'relative' }}>
                            {l.dot && <div style={{ position: 'absolute', bottom: -1, right: -1, width: 6, height: 6, borderRadius: '50%', background: l.dot, border: '1px solid #fff' }} />}
                          </div>
                          {l.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW: PENDÊNCIAS
      ════════════════════════════════════════════════════════════════ */}
      {activeView === 'pendencias' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#fff', borderBottom: '1px solid #EAECF0', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Pendências & Alertas</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>· {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

            {/* Críticos */}
            {pendencias.criticos.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>🔴 Críticos — ação imediata</div>
                {pendencias.criticos.map((a, i) => {
                  const proj = projMap[a.routine.project_id]
                  const prof = profMap[a.routine.assigned_to]
                  return (
                    <div key={i} style={{ background: '#fff', border: '1px solid #EAECF0', borderLeft: `3px solid ${RED}`, borderRadius: 10, padding: '13px 15px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>🔴</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', marginBottom: 3 }}>
                          {a.routine.title}
                          {a.type === 'consecutive_miss' && ` — ${a.count} dias consecutivos sem execução`}
                          {a.type === 'monthly_overdue' && ` — prazo vencido há ${a.daysLate} dias`}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, marginBottom: 7 }}>
                          {proj && <strong>{proj.name}</strong>}{prof && <> · <strong>{prof.full_name}</strong></>}
                          {a.type === 'monthly_overdue' && <> · prazo era dia {a.dueDay}</>}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: '#FEE2E2', color: '#991B1B' }}>🔴 {FREQ[a.routine.frequency]?.label}</span>
                        </div>
                      </div>
                      <button onClick={() => { setActiveView('historico'); setHistRoutine(a.routine); setHistProj(a.routine.project_id) }}
                        style={{ fontSize: 11, fontWeight: 600, color: VL, cursor: 'pointer', padding: '5px 10px', borderRadius: 7, border: '1px solid #DDD6FE', background: '#EEF2FF', flexShrink: 0, alignSelf: 'center', outline: 'none' }}>
                        Ver histórico →
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Atenção */}
            {pendencias.atencao.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>🟡 Atenção — monitorar</div>
                {pendencias.atencao.map((a, i) => {
                  const proj = projMap[a.routine.project_id]
                  const prof = profMap[a.routine.assigned_to]
                  return (
                    <div key={i} style={{ background: '#fff', border: '1px solid #EAECF0', borderLeft: `3px solid ${AMBER}`, borderRadius: 10, padding: '13px 15px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>🟡</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', marginBottom: 3 }}>
                          {a.routine.title} — {a.count} miss{a.count > 1 ? 'es' : ''} recente{a.count > 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 7 }}>
                          {proj && <strong>{proj.name}</strong>}{prof && <> · <strong>{prof.full_name}</strong></>}
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: '#FEF3C7', color: '#92400E' }}>🟡 {FREQ[a.routine.frequency]?.label}</span>
                        </div>
                      </div>
                      <button onClick={() => { setActiveView('historico'); setHistRoutine(a.routine); setHistProj(a.routine.project_id) }}
                        style={{ fontSize: 11, fontWeight: 600, color: VL, cursor: 'pointer', padding: '5px 10px', borderRadius: 7, border: '1px solid #DDD6FE', background: '#EEF2FF', flexShrink: 0, alignSelf: 'center', outline: 'none' }}>
                        Ver histórico →
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tardios */}
            {pendencias.tardios.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>⏰ Executados em atraso — registrados</div>
                {pendencias.tardios.map((a, i) => {
                  const proj = projMap[a.routine.project_id]
                  const prof = profMap[a.routine.assigned_to]
                  return (
                    <div key={i} style={{ background: '#fff', border: '1px solid #EAECF0', borderLeft: `3px solid ${VL}`, borderRadius: 10, padding: '13px 15px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>⏰</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', marginBottom: 3 }}>
                          {a.routine.title} — {a.lates.length} execução{a.lates.length > 1 ? 'ões' : ''} com atraso registrada{a.lates.length > 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 7 }}>
                          {proj && <strong>{proj.name}</strong>}{prof && <> · <strong>{prof.full_name}</strong></>}
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: '#EEF2FF', color: VL }}>⏰ {FREQ[a.routine.frequency]?.label} · atraso registrado</span>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: '#F0FDF4', color: '#065F46' }}>✓ Registrada</span>
                        </div>
                      </div>
                      <button onClick={() => { setActiveView('historico'); setHistRoutine(a.routine); setHistProj(a.routine.project_id) }}
                        style={{ fontSize: 11, fontWeight: 600, color: VL, cursor: 'pointer', padding: '5px 10px', borderRadius: 7, border: '1px solid #DDD6FE', background: '#EEF2FF', flexShrink: 0, alignSelf: 'center', outline: 'none' }}>
                        Ver histórico →
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* OK summary */}
            {pendencias.total === 0 && pendencias.tardios.length === 0 && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>✅</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#065F46' }}>Tudo em ordem!</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Todas as rotinas estão em conformidade neste período</div>
                </div>
              </div>
            )}

            {pendencias.total > 0 && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#065F46' }}>{routines.length - pendencias.criticos.length - pendencias.atencao.length} rotinas em conformidade</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Executadas corretamente no período</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{compliance}%</div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Nova Rotina form ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-zinc-800">Nova Rotina</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Título *</label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Nome da rotina" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Frequência</label>
                  <select value={form.frequency} onChange={e => setForm(p => ({...p, frequency: e.target.value}))} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500">
                    <option value="diaria">Diária</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Responsável</label>
                  <select value={form.assigned_to} onChange={e => setForm(p => ({...p, assigned_to: e.target.value}))} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500">
                    <option value="">— nenhum —</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Empresa</label>
                  <select value={form.company_id} onChange={e => setForm(p => ({...p, company_id: e.target.value, project_id: ''}))} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500">
                    <option value="">— nenhuma —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Projeto *</label>
                  <select value={form.project_id} onChange={e => setForm(p => ({...p, project_id: e.target.value}))} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500">
                    <option value="">— selecione —</option>
                    {projectsForForm.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Descrição / Prazo</label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Ex: ATÉ DIA 05. Verificar todos os extratos..." className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowForm(false)} className="text-sm text-zinc-500 px-4 py-2 rounded-xl hover:bg-zinc-100">Cancelar</button>
              <button onClick={createRoutine} className="text-sm font-bold text-white px-5 py-2 rounded-xl" style={{ background: VL }}>Criar rotina</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Late Execution Modal ── */}
      {lateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setLateModal(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <span style={{ fontSize: 22 }}>⏰</span>
              <h3 className="text-sm font-bold text-zinc-800">Registrar execução em atraso</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Rotina: <strong>{lateModal.routine.title}</strong><br/>
              Referência: <strong>{new Date(lateModal.refDate + 'T12:00').toLocaleDateString('pt-BR')}</strong> — não foi marcada no prazo.<br/>
              Ao registrar, aparecerá em <strong style={{ color: AMBER }}>amarelo ⏰</strong> no calendário.
            </p>
            <div className="p-3 rounded-lg mb-4 text-xs" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
              💡 O registro preserva o histórico real — o dia de referência fica amarelo (feito tarde), não vermelho (não feito).
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Quem executou *</label>
                <select value={lateWho} onChange={e => setLateWho(e.target.value)} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500">
                  <option value="">— selecione —</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Data em que foi executada *</label>
                <input type="date" value={lateDate} onChange={e => setLateDate(e.target.value)} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Observação (opcional)</label>
                <input type="text" value={lateObs} onChange={e => setLateObs(e.target.value)} placeholder="Ex: cliente enviou dados com atraso" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setLateModal(null)} className="text-sm text-zinc-500 px-4 py-2 rounded-xl hover:bg-zinc-100">Cancelar</button>
              <button onClick={saveLate} disabled={lateSaving || !lateWho || !lateDate}
                className="text-sm font-bold text-white px-5 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: AMBER }}>
                {lateSaving ? 'Salvando…' : '⏰ Registrar atraso'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
