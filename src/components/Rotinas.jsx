import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw, Plus, X, Check, Clock, Building2,
  ChevronDown, ChevronRight, Archive, BookOpen,
  BarChart2, Calendar, TrendingUp, AlertCircle, Zap
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
  diaria:  { label: 'Diária',  color: VL,   bg: '#EEF2FF', days: 1  },
  semanal: { label: 'Semanal', color: CH,    bg: '#F2F2F2', days: 7  },
  mensal:  { label: 'Mensal',  color: GREEN, bg: '#F0FDF4', days: 30 },
}

// Ordem fixa de exibição dentro de cada grupo de projeto
const FREQ_ORDER = { diaria: 0, semanal: 1, mensal: 2 }

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

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Rotinas() {
  const { profile } = useData()
  usePageTitle('Rotinas')

  const [routines,    setRoutines]     = useState([])
  const [completions, setCompletions]  = useState([])
  const [projects,    setProjects]     = useState([])
  const [companies,   setCompanies]    = useState([])
  const [profiles,    setProfilesList] = useState([])
  const [loading,     setLoading]      = useState(true)
  const [saving,      setSaving]       = useState(null)
  const [showForm,    setShowForm]     = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showHistory,   setShowHistory]   = useState(null)  // routineId
  const [collapsed,   setCollapsed]    = useState({})

  // Formulário nova rotina
  const [form, setForm] = useState({
    title: '', frequency: 'semanal', assigned_to: '',
    company_id: '', project_id: '', description: '',
  })

  // Formulário usar template
  const [tplState, setTplState] = useState({
    selectedId: null, company_id: '', project_id: '', assigned_to: '',
    step: 'choose', // 'choose' | 'configure'
  })

  const [filterFreq,    setFilterFreq]    = useState('all')
  const [filterProject, setFilterProject] = useState('all')
  const [search,        setSearch]        = useState('')
  const [viewMode,      setViewMode]      = useState('today') // 'today' | 'month'

  // ── Load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const since = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0] // 6 meses
    const [routR, compR, projR, profR, coR] = await Promise.allSettled([
      supabase.from('routines').select('*').eq('org_id', profile.org_id).eq('is_active', true).is('deleted_at', null).order('title'),
      supabase.from('routine_completions').select('*').eq('org_id', profile.org_id)
        .gte('reference_date', since).limit(2000),
      supabase.from('projects').select('id,name,company_id,status').eq('org_id', profile.org_id).order('name'),
      supabase.from('profiles').select('id,full_name,initials,avatar_color').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('companies').select('id,name').eq('org_id', profile.org_id).order('name'),
    ])
    if (routR.status === 'fulfilled' && !routR.value.error) setRoutines(routR.value.data || [])
    if (compR.status === 'fulfilled' && !compR.value.error) setCompletions(compR.value.data || [])
    if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
    if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    if (coR.status  === 'fulfilled' && !coR.value.error)   setCompanies(coR.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const todayStr   = todayISO()
  const currentMk  = monthKey(new Date())

  // ── Helpers de compliance ─────────────────────────────────────────────
  function isDoneToday(id) {
    return completions.some(c => {
      if (c.routine_id !== id) return false
      const d = c.reference_date || c.completed_at?.slice(0, 10) || ''
      return d === todayStr
    })
  }

  function isDoneThisMonth(id) {
    return completions.some(c => {
      if (c.routine_id !== id) return false
      const d = c.reference_date || c.completed_at?.slice(0, 10) || ''
      return d.startsWith(currentMk)
    })
  }

  function countThisMonth(id) {
    return completions.filter(c => {
      if (c.routine_id !== id) return false
      const d = c.reference_date || c.completed_at?.slice(0, 10) || ''
      return d.startsWith(currentMk)
    }).length
  }

  function isDoneInCycle(r) {
    return r.frequency === 'diaria' ? isDoneToday(r.id) : isDoneThisMonth(r.id)
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
      // Rotina nunca executada: só é "em atraso" se foi criada há mais de 1 ciclo
      const createdAt = r.created_at ? r.created_at.slice(0, 10) : todayStr
      const daysSinceCreation = Math.floor((new Date(todayStr) - new Date(createdAt)) / 86400000)
      return daysSinceCreation >= days
    }
    return Math.floor((new Date(todayStr) - new Date(last)) / 86400000) >= days
  }

  // Compliance do mês atual para uma lista de rotinas
  function monthlyCompliance(routineList) {
    const diarias = routineList.filter(r => r.frequency === 'diaria')
    const outras  = routineList.filter(r => r.frequency !== 'diaria')
    const today   = new Date(todayStr)
    const daysElapsed = today.getDate() // dias decorridos no mês

    let done = 0, total = 0
    for (const r of diarias) {
      const count = countThisMonth(r.id)
      done  += count
      total += daysElapsed
    }
    for (const r of outras) {
      if (isDoneThisMonth(r.id)) done++
      total++
    }
    return total > 0 ? Math.round(done / total * 100) : 0
  }

  // ── Maps ──────────────────────────────────────────────────────────────
  const profMap = Object.fromEntries(profiles.map(p => [p.id, p]))
  const projMap = Object.fromEntries(projects.map(p => [p.id, p]))
  const compMap = Object.fromEntries(companies.map(c => [c.id, c]))

  // ── Toggle (check diário) ─────────────────────────────────────────────
  async function toggle(r) {
    const done = isDoneToday(r.id)
    setSaving(r.id)
    try {
      if (done) {
        const comp = completions.find(c => c.routine_id === r.id && (c.reference_date === todayStr || c.completed_at?.startsWith(todayStr)))
        if (comp) {
          const { error } = await supabase.from('routine_completions').delete().eq('id', comp.id).eq('org_id', profile.org_id)
          if (error) throw error
        }
      } else {
        const { error } = await supabase.from('routine_completions').insert({
          routine_id: r.id, completed_by: profile.id,
          reference_date: todayStr, org_id: profile.org_id,
        })
        if (error) throw error
        const freqLabel = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' }
        const { error: tErr } = await supabase.from('tasks').insert({
          org_id: profile.org_id,
          title: `[Rotina ${freqLabel[r.frequency] || r.frequency}] ${r.title}`,
          description: r.description || `Gerada automaticamente pela rotina "${r.title}"`,
          column_id: 'doing', priority: 'media',
          project_id: r.project_id || null,
          assigned_to: r.assigned_to || profile.id,
          due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          created_by: profile.id,
        })
        if (!tErr) toast.success('✅ Rotina registrada — task criada no Kanban')
        else toast.success('✅ Rotina registrada')
      }
      await load()
    } catch (err) {
      toast.error('Erro ao registrar: ' + err.message)
    } finally { setSaving(null) }
  }

  // ── Criar rotina individual ────────────────────────────────────────────
  async function createRoutine() {
    if (!form.title.trim()) return
    if (!form.project_id) {
      toast.warning('Selecione um projeto antes de criar a rotina')
      return
    }
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

  // ── Aplicar template ──────────────────────────────────────────────────
  async function applyTemplate() {
    const tpl = TEMPLATE_LIBRARY.find(t => t.id === tplState.selectedId)
    if (!tpl) return
    // Bloquear se não selecionou projeto
    if (!tplState.project_id) {
      toast.warning('Selecione um projeto antes de aplicar o template')
      return
    }
    const inserts = tpl.routines.map(r => ({
      org_id: profile.org_id,
      title: r.title, description: r.description || null,
      frequency: r.frequency,
      assigned_to: tplState.assigned_to || null,
      project_id: tplState.project_id || null,
      is_active: true,
    }))
    const { error } = await supabase.from('routines').insert(inserts)
    if (error) { toast.error('Erro ao aplicar template: ' + error.message); return }
    setShowTemplates(false)
    setTplState({ selectedId: null, company_id: '', project_id: '', assigned_to: '', step: 'choose' })
    await load()
    toast.success(`✅ ${tpl.routines.length} rotinas criadas a partir do template "${tpl.label}"`)
  }

  // ── Arquivar rotina individual ─────────────────────────────────────────
  async function archive(id) {
    const { error } = await supabase.from('routines')
      .update({ is_active: false }).eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao arquivar: ' + error.message); return }
    await load()
    toast.success('Rotina arquivada — histórico preservado')
  }

  // ── Encerrar fase (arquivar todas as rotinas de um projeto) ────────────
  async function archivePhase(projectId, projectName) {
    const ok = await confirm(
      `Encerrar fase "${projectName}"?\n\nTodas as ${routines.filter(r => r.project_id === projectId).length} rotinas deste projeto serão arquivadas. O histórico de execução fica preservado e consultável.`,
      { danger: true, confirmLabel: 'Encerrar fase', cancelLabel: 'Cancelar' }
    )
    if (!ok) return
    const { error } = await supabase.from('routines')
      .update({ is_active: false })
      .eq('org_id', profile.org_id)
      .eq('project_id', projectId)
    if (error) { toast.error('Erro ao encerrar fase: ' + error.message); return }
    await load()
    toast.success(`✅ Fase "${projectName}" encerrada — ${routines.filter(r => r.project_id === projectId).length} rotinas arquivadas`)
  }

  // ── Filtros ────────────────────────────────────────────────────────────
  const filtered = routines.filter(r => {
    const matchFreq    = filterFreq    === 'all' || r.frequency  === filterFreq
    const matchProject = filterProject === 'all' || r.project_id === filterProject ||
                         (filterProject === '__sem_projeto__' && !r.project_id)
    const matchSearch  = !search.trim() ||
      (r.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase())
    return matchFreq && matchProject && matchSearch
  })

  // Métricas globais (modo hoje)
  const doneToday  = filtered.filter(r =>  isDoneToday(r.id)).length
  const overdue    = filtered.filter(r => !isDoneToday(r.id) && isOverdue(r)).length
  const compliance = filtered.length > 0 ? Math.round(doneToday / filtered.length * 100) : 0

  // Métricas mês atual
  const monthComp = monthlyCompliance(filtered)

  // ── Agrupamento Empresa → Projeto ──────────────────────────────────────
  const grouped = {}
  for (const r of filtered) {
    const proj      = projMap[r.project_id]
    const companyId = proj?.company_id || '__sem_empresa__'
    const projectId = r.project_id    || '__sem_projeto__'
    if (!grouped[companyId]) grouped[companyId] = {}
    if (!grouped[companyId][projectId]) grouped[companyId][projectId] = []
    grouped[companyId][projectId].push(r)
  }
  // Ordenar rotinas dentro de cada projeto: Diárias → Semanais → Mensais → alfabético
  for (const co of Object.values(grouped)) {
    for (const projKey of Object.keys(co)) {
      co[projKey].sort((a, b) => {
        const fo = (FREQ_ORDER[a.frequency] ?? 9) - (FREQ_ORDER[b.frequency] ?? 9)
        if (fo !== 0) return fo
        return (a.title || '').localeCompare(b.title || '')
      })
    }
  }

  const companyKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '__sem_empresa__') return 1
    if (b === '__sem_empresa__') return -1
    return (compMap[a]?.name || '').localeCompare(compMap[b]?.name || '')
  })

  const projectsForForm = form.company_id
    ? projects.filter(p => p.company_id === form.company_id)
    : projects

  const projectsForTpl = tplState.company_id
    ? projects.filter(p => p.company_id === tplState.company_id)
    : projects

  function toggleCollapse(id) { setCollapsed(prev => ({ ...prev, [id]: !prev[id] })) }

  // ── Card de rotina ─────────────────────────────────────────────────────
  function RoutineCard({ r }) {
    const done      = isDoneToday(r.id)
    const monthDone = countThisMonth(r.id)
    const overdueFl = !done && isOverdue(r)
    const last      = lastDone(r.id)
    const prof      = profMap[r.assigned_to]
    const leftColor = done ? GREEN : overdueFl ? RED : VL
    const borderColor = done ? '#BBF7D0' : overdueFl ? '#FECACA' : '#E5E7EB'
    const bgColor     = done ? '#F0FDF4' : overdueFl ? '#FFF5F5' : '#FFFFFF'
    const isExpanded  = showHistory === r.id

    return (
      <div className="rounded-xl overflow-hidden transition-all duration-200"
        style={{ border: `1px solid ${borderColor}`, background: bgColor }}>
        <div className="flex items-stretch">
          <div className="w-1 shrink-0" style={{ background: leftColor }} />
          <div className="flex-1 flex items-center gap-4 px-4 py-3">
            {/* Check button */}
            <button onClick={() => toggle(r)} disabled={saving === r.id}
              title={done ? 'Desfazer' : 'Concluir hoje'}
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all hover:scale-110"
              style={done
                ? { background: GREEN, borderColor: GREEN, color: '#fff' }
                : overdueFl ? { borderColor: RED, color: RED }
                : { borderColor: '#D1D5DB', color: '#9CA3AF' }
              }>
              {saving === r.id
                ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                : done ? <Check className="w-3.5 h-3.5" /> : null
              }
            </button>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${done ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>{r.title}</div>
              {r.description && <div className="text-xs text-zinc-400 mt-0.5 truncate">{r.description}</div>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <FreqBadge frequency={r.frequency} />
                {prof && (
                  <div className="flex items-center gap-1">
                    <Avatar prof={prof} size={5} />
                    <span className="text-xs text-zinc-500">{prof.full_name.split(' ')[0]}</span>
                  </div>
                )}
                {/* Contador do mês para diárias */}
                {r.frequency === 'diaria' && (
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {monthDone} vezes este mês
                  </span>
                )}
                {last && r.frequency !== 'diaria' && (
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(last + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                )}
                {overdueFl && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: RED }}>Em atraso</span>}
                {done && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: GREEN }}>✓ Hoje</span>}
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setShowHistory(isExpanded ? null : r.id)}
                title="Ver histórico"
                className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-violet-100' : 'hover:bg-zinc-100'}`}
                style={{ color: isExpanded ? VL : '#9CA3AF' }}>
                <BarChart2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => archive(r.id)} title="Arquivar rotina"
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-300 hover:text-zinc-500 transition-colors">
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Histórico expandido */}
        {isExpanded && (
          <div className="px-5 pb-4 border-t border-zinc-100">
            <MonthlyHistoryChart routineId={r.id} frequency={r.frequency} completions={completions} />
          </div>
        )}
      </div>
    )
  }

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

  // ── RENDER PRINCIPAL ───────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {showTemplates && <TemplateModal />}

      {/* Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: CH }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2" style={{ color: '#A5B4FC' }}>
              <RefreshCw className="w-3 h-3" /> Compliance Operacional
            </div>
            <h1 className="text-2xl font-bold mb-1">Rotinas</h1>
            <p className="text-sm text-zinc-400">{routines.length} rotina{routines.length !== 1 ? 's' : ''} ativas</p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            {/* Toggle hoje / mês */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
              {[['today','Hoje'],['month','Mês']].map(([v,l]) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className="px-4 py-2 text-xs font-bold transition-colors"
                  style={viewMode === v
                    ? { background: VL, color: '#fff' }
                    : { background: 'transparent', color: 'rgba(255,255,255,0.5)' }
                  }>{l}</button>
              ))}
            </div>
            {[
              { label: viewMode === 'today' ? 'Compliance hoje' : 'Compliance mês',
                value: `${viewMode === 'today' ? compliance : monthComp}%`,
                color: (viewMode === 'today' ? compliance : monthComp) >= 80 ? '#4ADE80' : (viewMode === 'today' ? compliance : monthComp) >= 50 ? AMBER : '#F87171' },
              { label: 'Concluídas', value: doneToday, color: '#A5B4FC' },
              { label: 'Em atraso',  value: overdue, color: overdue > 0 ? '#F87171' : '#4ADE80' },
            ].map(k => (
              <div key={k.label} className="rounded-xl px-4 py-3 text-center min-w-[90px]"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-full h-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-2 rounded-full transition-all duration-700"
            style={{ width: `${viewMode === 'today' ? compliance : monthComp}%`,
                     background: (viewMode === 'today' ? compliance : monthComp) >= 80 ? GREEN : (viewMode === 'today' ? compliance : monthComp) >= 50 ? AMBER : VL }} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input type="text" placeholder="Buscar rotina…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-violet-500 w-48" />
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white"
          value={filterFreq} onChange={e => setFilterFreq(e.target.value)}>
          <option value="all">Todas as frequências</option>
          {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white max-w-[280px]"
          value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="all">Todos os projetos</option>
          <option value="__sem_projeto__">Sem projeto</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl border-2 transition-all hover:shadow-md"
            style={{ borderColor: VL, color: VL, background: '#F5F3FF' }}>
            <BookOpen className="w-4 h-4" /> Templates
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded-xl hover:opacity-90 transition-all"
            style={{ background: VL }}>
            <Plus className="w-4 h-4" /> Nova rotina
          </button>
        </div>
      </div>

      {/* Formulário nova rotina */}
      {showForm && (
        <div className="bg-white border-2 rounded-2xl p-5 mb-6 shadow-lg" style={{ borderColor: `${VL}50` }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-800">Nova Rotina</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Associe a uma empresa e projeto para organizar sua equipe</p>
            </div>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Título *</label>
              <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Envio de relatório semanal ao cliente" autoFocus />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Empresa
              </label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500"
                value={form.company_id}
                onChange={e => setForm(p => ({ ...p, company_id: e.target.value, project_id: '' }))}>
                <option value="">— nenhuma —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">
                Projeto <span className="text-red-500">*</span>
                {form.company_id && projectsForForm.length > 0 && <span className="text-zinc-400 font-normal"> ({projectsForForm.length} disponíveis)</span>}
              </label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500"
                value={form.project_id} onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}>
                <option value="">— sem projeto —</option>
                {projectsForForm.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Frequência</label>
              <div className="flex gap-2">
                {Object.entries(FREQ).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setForm(p => ({ ...p, frequency: k }))}
                    className="flex-1 py-2.5 text-xs font-bold rounded-xl border-2 transition-all"
                    style={form.frequency === k
                      ? { background: v.bg, color: v.color, borderColor: v.color }
                      : { background: '#F9FAFB', color: '#9CA3AF', borderColor: '#E5E7EB' }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">Responsável</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500"
                value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                <option value="">— nenhum —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">
                Descrição <span className="font-normal text-zinc-400">(opcional)</span>
              </label>
              <textarea className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none"
                rows={2} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Instruções, contexto ou checklist da rotina…" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-zinc-500 px-4 py-2 rounded-xl hover:bg-zinc-100 transition-colors">Cancelar</button>
            <button onClick={createRoutine} disabled={!form.title.trim() || !form.project_id}
              className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: VL }}>
              <Plus className="w-4 h-4" /> Criar rotina
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="bg-white border border-zinc-100 rounded-2xl p-10 text-center text-sm text-zinc-400">
          <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-zinc-300" />Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-zinc-100 rounded-2xl p-14 text-center">
          <BookOpen className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <div className="text-sm text-zinc-500 font-medium">Nenhuma rotina encontrada</div>
          <div className="text-xs text-zinc-400 mt-1 mb-4">Crie uma rotina avulsa ou aplique um dos 7 templates pré-montados</div>
          <button onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl mx-auto hover:opacity-90"
            style={{ background: VL, color: '#fff' }}>
            <BookOpen className="w-4 h-4" /> Ver templates
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {companyKeys.map(companyId => {
            const company     = compMap[companyId]
            const isCollapsed = collapsed[companyId]
            const compRoutines = Object.values(grouped[companyId]).flat()
            const compDone    = compRoutines.filter(r => isDoneToday(r.id)).length
            const compMonthPct = monthlyCompliance(compRoutines)
            const compName    = companyId === '__sem_empresa__' ? 'Sem empresa' : (company?.name || companyId)
            const projectKeys = Object.keys(grouped[companyId]).sort((a, b) => {
              if (a === '__sem_projeto__') return 1
              if (b === '__sem_projeto__') return -1
              return (projMap[a]?.name || '').localeCompare(projMap[b]?.name || '')
            })
            const isDark = companyId !== '__sem_empresa__'

            return (
              <div key={companyId} className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #E5E7EB' }}>

                {/* Header empresa */}
                <div className="flex items-center" style={{ background: isDark ? CH : '#FAFAFA' }}>
                  <button onClick={() => toggleCollapse(companyId)}
                    className="flex-1 flex items-center justify-between px-5 py-4 transition-colors hover:opacity-90">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: isDark ? VL : '#D1D5DB' }}>
                        {companyId === '__sem_empresa__' ? '?' : compName.split(' ').filter(w => w).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold" style={{ color: isDark ? '#FFFFFF' : '#374151' }}>{compName}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF' }}>
                          {compRoutines.length} rotina{compRoutines.length !== 1 ? 's' : ''} · {projectKeys.length} projeto{projectKeys.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <div className="text-[10px] mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }}>
                          {viewMode === 'today' ? 'hoje' : 'mês'}
                        </div>
                        <div className="w-28">
                          <ProgressBar done={viewMode === 'today' ? compDone : Math.round(compMonthPct)} total={viewMode === 'today' ? compRoutines.length : 100} />
                        </div>
                      </div>
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }} />
                        : <ChevronDown  className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }} />
                      }
                    </div>
                  </button>
                </div>

                {/* Projetos */}
                {!isCollapsed && (
                  <div className="divide-y divide-zinc-100">
                    {projectKeys.map(projKey => {
                      const proj      = projMap[projKey]
                      const projName  = projKey === '__sem_projeto__' ? 'Sem projeto' : (proj?.name || projKey)
                      const projRouts = grouped[companyId][projKey]
                      const projDone  = projRouts.filter(r => isDoneToday(r.id)).length
                      const projMonthPct = monthlyCompliance(projRouts)

                      return (
                        <div key={projKey}>
                          {/* Sub-header projeto com botão "Encerrar fase" */}
                          <div className="flex items-center justify-between px-5 py-2.5 bg-zinc-50">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full"
                                style={{ background: projKey === '__sem_projeto__' ? '#D1D5DB' : VL }} />
                              <span className="text-[11px] font-bold uppercase tracking-wider"
                                style={{ color: projKey === '__sem_projeto__' ? '#9CA3AF' : '#4B5563' }}>
                                {projName}
                              </span>
                              <span className="text-[10px] text-zinc-400">({projRouts.length})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-24">
                                <ProgressBar
                                  done={viewMode === 'today' ? projDone : Math.round(projMonthPct)}
                                  total={viewMode === 'today' ? projRouts.length : 100} />
                              </div>
                              {projKey !== '__sem_projeto__' && (
                                <button
                                  onClick={() => archivePhase(projKey, projName)}
                                  title="Encerrar fase — arquivar todas as rotinas deste projeto"
                                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors hover:bg-red-50"
                                  style={{ color: '#9CA3AF', borderColor: '#E5E7EB' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = RED; e.currentTarget.style.borderColor = '#FECACA' }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = '#E5E7EB' }}
                                >
                                  <Archive className="w-3 h-3" /> Encerrar fase
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Cards */}
                          <div className="px-4 py-3 space-y-2">
                            {projRouts.map(r => <RoutineCard key={r.id} r={r} />)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
