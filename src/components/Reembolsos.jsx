import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Receipt, Plus, X, Check, Trash2, FileText, Download,
  ChevronDown, ChevronRight, Search, RefreshCw, AlertTriangle,
  Plane, Hotel, Car, Utensils, Briefcase, CreditCard, Clock,
  Users, MessageSquare, Archive, Send
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import { isLeaderRole } from '../lib/roles'
import { toast, confirm } from './Toast'

const VL = '#5452C1'
const CH = '#2D2E39'

// ── Pipeline ──────────────────────────────────────────────────────────────────
const STAGES = [
  { id: 'rascunho',   label: 'Rascunho',   color: '#94A3B8', header: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8', text: '#475569', next: 'submetido'  },
  { id: 'submetido',  label: 'Submetido',  color: '#F59E0B', header: '#FFFBEB', border: '#FDE68A', dot: '#EAB308', text: '#713F12', next: 'em_analise' },
  { id: 'em_analise', label: 'Em Análise', color: '#6366F1', header: '#EEF2FF', border: '#DDD6FE', dot: '#818CF8', text: '#4338CA', next: 'aprovado'   },
  { id: 'aprovado',   label: 'Aprovado',   color: '#10B981', header: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E', text: '#14532D', next: 'pago'        },
  { id: 'pago',       label: 'Pago',       color: '#3B82F6', header: '#EFF6FF', border: '#BFDBFE', dot: '#60A5FA', text: '#1E40AF', next: null          },
]
const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]))

// ── Tipos de despesa ─────────────────────────────────────────────────────────
const EXPENSE_TYPES = {
  voo:        { label: 'Voo',          icon: Plane,      color: '#3B82F6', bg: '#EFF6FF' },
  hotel:      { label: 'Hotel',        icon: Hotel,      color: '#8B5CF6', bg: '#F5F3FF' },
  transporte: { label: 'Transporte',   icon: Car,        color: '#F59E0B', bg: '#FFFBEB' },
  refeicao:   { label: 'Refeição',     icon: Utensils,   color: '#10B981', bg: '#ECFDF5' },
  consultor:  { label: 'Consultor',    icon: Briefcase,  color: '#EF4444', bg: '#FEF2F2' },
  outros:     { label: 'Outros',       icon: CreditCard, color: '#6B7280', bg: '#F9FAFB' },
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateShort(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ── Gerar relatório BX ────────────────────────────────────────────────────────
function generateBXReport(report, items, submitter, approver, project) {
  const byType = {}
  items.forEach(it => {
    const type = it.expense_type || it.category || 'outros'
    if (!byType[type]) byType[type] = []
    byType[type].push(it)
  })

  const EMOJI = { voo:'✈️', hotel:'🏨', transporte:'🚗', refeicao:'🍽️', consultor:'💼', outros:'💳', km:'🛣️', hospedagem:'🏨', material:'📦', transporte_km:'🛣️' }
  const TYPE_LABEL = { voo:'Voo', hotel:'Hotel / Estadia', transporte:'Transporte', refeicao:'Refeição', consultor:'Consultor', outros:'Outros', km:'KM Rodado', hospedagem:'Hospedagem', material:'Material' }
  const TYPE_COLOR = { voo:'#3B82F6', hotel:'#8B5CF6', transporte:'#F59E0B', refeicao:'#10B981', consultor:'#EF4444', outros:'#6B7280' }

  const totalByType = Object.entries(byType).map(([t, its]) => ({
    type: t, emoji: EMOJI[t]||'💳', label: TYPE_LABEL[t]||t,
    color: TYPE_COLOR[t]||'#6B7280',
    total: its.reduce((s,i)=>s+(parseFloat(i.amount)||0),0),
    count: its.length
  })).sort((a,b) => b.total - a.total)

  const grandTotal = items.reduce((s,i) => s+(parseFloat(i.amount)||0), 0)
  const today = new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'})

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório BX — ${report.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: #F8F9FC; color: #1a1a2e; }

  /* ── Capa ── */
  .cover {
    background: linear-gradient(135deg, #1a1a2e 0%, #2D2E39 50%, #16213e 100%);
    min-height: 100vh; padding: 0; display: flex; flex-direction: column;
    page-break-after: always; position: relative; overflow: hidden;
  }
  .cover-bg-circles {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; pointer-events: none;
  }
  .circle { position: absolute; border-radius: 50%; opacity: 0.06; background: #5452C1; }
  .c1 { width: 600px; height: 600px; top: -200px; right: -150px; }
  .c2 { width: 400px; height: 400px; bottom: -100px; left: -100px; }
  .c3 { width: 200px; height: 200px; top: 40%; left: 30%; background: #10B981; }

  .cover-header { padding: 40px 48px 0; display: flex; justify-content: space-between; align-items: flex-start; position: relative; }
  .logo-text { font-size: 28px; font-weight: 900; letter-spacing: -1.5px; color: white; }
  .logo-dot { color: #5452C1; }
  .logo-sub { font-size: 9px; color: #94A3B8; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; }
  .cover-badge { background: rgba(84,82,193,0.2); border: 1px solid rgba(84,82,193,0.4); border-radius: 99px; padding: 6px 16px; font-size: 11px; font-weight: 600; color: #A5B4FC; letter-spacing: 1px; }

  .cover-body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 48px; position: relative; }
  .cover-tag { font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #5452C1; margin-bottom: 16px; }
  .cover-title { font-size: 36px; font-weight: 800; color: white; line-height: 1.2; margin-bottom: 12px; max-width: 600px; }
  .cover-project { font-size: 16px; color: #94A3B8; margin-bottom: 40px; }

  .cover-kpis { display: flex; gap: 20px; margin-bottom: 48px; flex-wrap: wrap; }
  .kpi-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px 28px; backdrop-filter: blur(10px); }
  .kpi-value { font-size: 28px; font-weight: 800; color: white; line-height: 1; }
  .kpi-value.accent { color: #5452C1; }
  .kpi-value.green { color: #10B981; }
  .kpi-label { font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 6px; }

  .cover-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 520px; }
  .meta-item { }
  .meta-label { font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; }
  .meta-value { font-size: 13px; font-weight: 600; color: #CBD5E1; }

  .cover-footer { padding: 0 48px 40px; display: flex; align-items: center; justify-content: space-between; position: relative; }
  .confidential-bar { background: linear-gradient(90deg, #5452C1, #818CF8); border-radius: 99px; padding: 8px 24px; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: white; }
  .cover-date { font-size: 11px; color: #475569; }

  /* ── Conteúdo ── */
  .page { padding: 48px; page-break-inside: avoid; }
  .section { margin-bottom: 40px; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #E2E8F0; }
  .section-icon { font-size: 20px; }
  .section-title { font-size: 18px; font-weight: 700; color: #1E293B; }
  .section-count { font-size: 12px; font-weight: 600; color: #94A3B8; background: #F1F5F9; border-radius: 99px; padding: 2px 10px; }

  /* Resumo por categoria */
  .category-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 32px; }
  .cat-card { border-radius: 16px; padding: 16px 20px; border: 1px solid; position: relative; overflow: hidden; }
  .cat-emoji { font-size: 24px; margin-bottom: 8px; }
  .cat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; opacity: 0.7; }
  .cat-value { font-size: 20px; font-weight: 800; }
  .cat-count { font-size: 10px; margin-top: 2px; opacity: 0.6; }

  /* Tabela */
  .expense-table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .expense-table thead tr { background: #2D2E39; }
  .expense-table thead th { padding: 14px 16px; text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #94A3B8; }
  .expense-table tbody tr { background: white; border-bottom: 1px solid #F1F5F9; transition: background 0.2s; }
  .expense-table tbody tr:last-child { border-bottom: none; }
  .expense-table tbody tr:nth-child(even) { background: #FAFBFC; }
  .expense-table tbody td { padding: 14px 16px; font-size: 13px; vertical-align: top; }
  .type-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
  .detail-text { font-size: 11px; color: #94A3B8; margin-top: 3px; }
  .amount-cell { font-weight: 700; font-size: 14px; text-align: right; white-space: nowrap; }
  .group-header td { background: #F8F9FC; padding: 10px 16px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #64748B; border-top: 2px solid #E2E8F0; }
  .total-row td { background: #2D2E39 !important; color: white; padding: 16px; font-weight: 700; font-size: 15px; }
  .total-row td:last-child { font-size: 18px; color: #5452C1; }

  /* Aprovação */
  .approval-section { background: white; border-radius: 24px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); margin-top: 40px; }
  .approval-title { font-size: 20px; font-weight: 700; color: #1E293B; margin-bottom: 8px; }
  .approval-sub { font-size: 13px; color: #94A3B8; margin-bottom: 32px; }
  .approval-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .signer-box { }
  .signer-role { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #94A3B8; margin-bottom: 12px; }
  .signer-line { height: 1px; background: #2D2E39; margin-bottom: 12px; }
  .signer-name { font-size: 15px; font-weight: 700; color: #1E293B; }
  .signer-title { font-size: 11px; color: #94A3B8; margin-top: 4px; }
  .signer-date { font-size: 11px; color: #5452C1; margin-top: 4px; font-weight: 600; }
  .approved-stamp { display: inline-flex; align-items: center; gap: 8px; background: #ECFDF5; border: 2px solid #10B981; border-radius: 12px; padding: 8px 16px; margin-top: 12px; }
  .approved-stamp span { font-size: 12px; font-weight: 700; color: #065F46; letter-spacing: 1px; }

  /* Footer */
  .report-footer { background: #2D2E39; padding: 20px 48px; display: flex; justify-content: space-between; align-items: center; }
  .footer-logo { font-size: 14px; font-weight: 800; letter-spacing: -0.5px; color: white; }
  .footer-logo span { color: #5452C1; }
  .footer-text { font-size: 10px; color: #64748B; }

  @media print {
    body { background: white; }
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .expense-table { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .approval-section { break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- CAPA -->
<div class="cover">
  <div class="cover-bg-circles">
    <div class="circle c1"></div>
    <div class="circle c2"></div>
    <div class="circle c3"></div>
  </div>

  <div class="cover-header">
    <div>
      <div class="logo-text">BX<span class="logo-dot">.</span>Finance</div>
      <div class="logo-sub">Advisory · Restructuring · M&amp;A</div>
    </div>
    <div class="cover-badge">Relatório de Despesas</div>
  </div>

  <div class="cover-body">
    <div class="cover-tag">📋 Reembolso de Despesas</div>
    <div class="cover-title">${report.title}</div>
    <div class="cover-project">🏢 ${project?.name || 'BX Finance'}</div>

    <div class="cover-kpis">
      <div class="kpi-card">
        <div class="kpi-value accent">${fmtBRL(grandTotal)}</div>
        <div class="kpi-label">💰 Total Solicitado</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${items.length}</div>
        <div class="kpi-label">🧾 Despesas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value green">${totalByType.length}</div>
        <div class="kpi-label">📂 Categorias</div>
      </div>
    </div>

    <div class="cover-meta">
      <div class="meta-item">
        <div class="meta-label">👤 Solicitante</div>
        <div class="meta-value">${submitter?.full_name || '—'}</div>
      </div>
      ${report.period_start ? `<div class="meta-item">
        <div class="meta-label">📅 Período</div>
        <div class="meta-value">${fmtDate(report.period_start)} → ${fmtDate(report.period_end)}</div>
      </div>` : ''}
      <div class="meta-item">
        <div class="meta-label">✅ Status</div>
        <div class="meta-value" style="color:#10B981">Aprovado</div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div class="confidential-bar">🔒 Documento Confidencial</div>
    <div class="cover-date">Gerado em ${today}</div>
  </div>
</div>

<!-- CONTEÚDO -->
<div class="page">

  <!-- Resumo por categoria -->
  <div class="section">
    <div class="section-header">
      <span class="section-icon">📊</span>
      <span class="section-title">Resumo por Categoria</span>
    </div>
    <div class="category-grid">
      ${totalByType.map(t => `
        <div class="cat-card" style="background:${t.color}10;border-color:${t.color}30;">
          <div class="cat-emoji">${t.emoji}</div>
          <div class="cat-label" style="color:${t.color}">${t.label}</div>
          <div class="cat-value" style="color:${t.color}">${fmtBRL(t.total)}</div>
          <div class="cat-count">${t.count} item${t.count>1?'s':''}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Tabela detalhada -->
  <div class="section">
    <div class="section-header">
      <span class="section-icon">🧾</span>
      <span class="section-title">Detalhamento das Despesas</span>
      <span class="section-count">${items.length} itens</span>
    </div>
    <table class="expense-table">
      <thead>
        <tr>
          <th>Categoria</th>
          <th>Descrição</th>
          <th>Data</th>
          <th>Detalhes</th>
          <th style="text-align:right">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(byType).map(([type, typeItems]) => {
          const emoji = EMOJI[type]||'💳'
          const label = TYPE_LABEL[type]||type
          const color = TYPE_COLOR[type]||'#6B7280'
          const typeTotal = typeItems.reduce((s,i)=>s+(parseFloat(i.amount)||0),0)
          return `
            <tr class="group-header"><td colspan="5">${emoji} ${label} &nbsp;·&nbsp; ${fmtBRL(typeTotal)}</td></tr>
            ${typeItems.map(it => `<tr>
              <td>
                <span class="type-pill" style="background:${color}15;color:${color}">${emoji} ${label}</span>
              </td>
              <td>
                <div style="font-weight:600;color:#1E293B">${it.description||it.consultant_name||it.airline||label}</div>
                ${it.consultant_scope ? `<div class="detail-text">📋 ${it.consultant_scope}</div>` : ''}
                ${it.receipt_url ? `<div class="detail-text">📎 <a href="${it.receipt_url}" style="color:#5452C1">Comprovante</a></div>` : ''}
              </td>
              <td style="color:#64748B;white-space:nowrap">${fmtDate(it.date||it.checkin_date)}</td>
              <td>
                ${type==='voo' ? `<div class="detail-text">✈️ ${it.origin||''}→${it.destination||''} ${it.flight_class?'· '+it.flight_class:''} ${it.airline?'· '+it.airline:''}</div>` : ''}
                ${type==='hotel' ? `<div class="detail-text">🌙 ${it.num_nights||'?'} noite${it.num_nights>1?'s':''} · ${fmtBRL(it.daily_rate)}/noite ${it.checkin_date?'<br>📅 '+fmtDate(it.checkin_date)+' → '+fmtDate(it.checkout_date):''}</div>` : ''}
                ${type==='transporte' ? `<div class="detail-text">🚗 ${it.transport_type||''} ${it.origin&&it.destination?it.origin+'→'+it.destination:''}</div>` : ''}
                ${type==='refeicao' ? `<div class="detail-text">👥 ${it.num_people?it.num_people+' pessoas':''}</div>` : ''}
                ${type==='consultor' && it.checkin_date ? `<div class="detail-text">📅 ${fmtDate(it.checkin_date)} → ${fmtDate(it.checkout_date)}</div>` : ''}
              </td>
              <td class="amount-cell" style="color:${color}">${fmtBRL(it.amount)}</td>
            </tr>`).join('')}
          `
        }).join('')}
        <tr class="total-row">
          <td colspan="4">💰 TOTAL GERAL</td>
          <td style="text-align:right">${fmtBRL(grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Aprovação -->
  <div class="approval-section">
    <div class="approval-title">✅ Aprovação e Autorização</div>
    <div class="approval-sub">Este relatório foi revisado e aprovado conforme política de reembolso da BX Finance.</div>
    <div class="approval-grid">
      <div class="signer-box">
        <div class="signer-role">👤 Solicitante</div>
        <div class="signer-line"></div>
        <div class="signer-name">${submitter?.full_name || '—'}</div>
        <div class="signer-title">BX Finance</div>
        ${report.submitted_at ? `<div class="signer-date">📅 ${fmtDate(report.submitted_at.split('T')[0])}</div>` : ''}
      </div>
      <div class="signer-box">
        <div class="signer-role">✍️ Aprovador — Sócio</div>
        <div class="signer-line" style="background:#5452C1"></div>
        <div class="signer-name">Gabriel Molina</div>
        <div class="signer-title">Sócio · BX Finance</div>
        ${report.approved_at ? `<div class="signer-date">📅 ${fmtDate(report.approved_at.split('T')[0])}</div>` : ''}
        <div class="approved-stamp">
          <span>✅ APROVADO</span>
        </div>
      </div>
    </div>
  </div>

  ${report.notes ? `
  <div style="background:#EEF2FF;border-left:4px solid #5452C1;border-radius:0 12px 12px 0;padding:16px 20px;margin-top:24px;">
    <div style="font-size:11px;font-weight:700;color:#4338CA;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📝 Observações</div>
    <div style="font-size:13px;color:#374151">${report.notes}</div>
  </div>` : ''}
</div>

<div class="report-footer">
  <div class="footer-logo">BX<span>.</span>Finance</div>
  <div class="footer-text">Advisory · Restructuring · M&amp;A · Documento Confidencial</div>
  <div class="footer-text">Gerado em ${today}</div>
</div>

</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 1200)
}


// ── ExpenseModal ──────────────────────────────────────────────────────────────
function ExpenseModal({ report, profiles, projects, onClose, onSave, onDelete, onAdvance, onReject }) {
  const { profile } = useData()
  const [items, setItems] = useState([])
  const [comments, setComments] = useState([])
  const [form, setForm] = useState({
    title:       report.title || '',
    notes:       report.notes || '',
    project_id:  report.project_id || '',
    period_start: report.period_start || '',
    period_end:   report.period_end || '',
  })
  const [newComment, setNewComment] = useState('')
  const [showAddItem, setShowAddItem] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingItems, setLoadingItems] = useState(true)
  const [newItem, setNewItem] = useState({
    expense_type: 'voo', description: '', amount: '', date: '',
    origin: '', destination: '', airline: '', flight_class: 'econômica',
    checkin_date: '', checkout_date: '', num_nights: '', daily_rate: '',
    transport_type: 'Uber', consultant_name: '', consultant_scope: '',
    num_people: '', receipt_url: '', notes: ''
  })
  const commentEndRef = useRef(null)
  const isLeader = isLeaderRole(profile?.role)
  const stage = STAGE_MAP[report.status] || STAGE_MAP.rascunho
  const canEdit = report.status === 'rascunho'
  const project = projects.find(p => p.id === (form.project_id || report.project_id))
  const submitter = profiles.find(p => p.id === report.submitted_by)
  const approver = profiles.find(p => p.id === report.approved_by)

  useEffect(() => {
    if (!report.id) { setLoadingItems(false); return }
    Promise.all([
      supabase.from('expense_items').select('*').eq('report_id', report.id).order('date'),
      supabase.from('task_comments').select('*').eq('task_id', report.id).order('created_at')
    ]).then(([itemsR, commR]) => {
      setItems(itemsR.data || [])
      setComments(commR.data || [])
      setLoadingItems(false)
    })
  }, [report.id])

  useEffect(() => { commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments.length])

  const total = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)

  function calcItemAmount() {
    if (newItem.expense_type === 'hotel' && newItem.num_nights && newItem.daily_rate) {
      return parseFloat(newItem.num_nights) * parseFloat(newItem.daily_rate)
    }
    return parseFloat(newItem.amount) || 0
  }

  async function addItem() {
    const amount = calcItemAmount()
    if (!amount) return
    setSaving(true)
    const payload = {
      report_id: report.id, org_id: profile.org_id,
      expense_type: newItem.expense_type,
      category: newItem.expense_type,
      description: newItem.description || newItem.consultant_name || newItem.airline || newItem.transport_type || newItem.expense_type,
      amount,
      date: newItem.date || newItem.checkin_date || new Date().toISOString().split('T')[0],
      origin: newItem.origin || null,
      destination: newItem.destination || null,
      airline: newItem.airline || null,
      flight_class: newItem.flight_class || null,
      checkin_date: newItem.checkin_date || null,
      checkout_date: newItem.checkout_date || null,
      num_nights: newItem.num_nights ? parseInt(newItem.num_nights) : null,
      daily_rate: newItem.daily_rate ? parseFloat(newItem.daily_rate) : null,
      num_people: newItem.num_people ? parseInt(newItem.num_people) : null,
      transport_type: newItem.transport_type || null,
      consultant_name: newItem.consultant_name || null,
      consultant_scope: newItem.consultant_scope || null,
      receipt_url: newItem.receipt_url || null,
      notes: newItem.notes || null,
    }
    const { data, error } = await supabase.from('expense_items').insert(payload).select().single()
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    const newItems = [...items, data]
    const newTotal = newItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
    await supabase.from('expense_reports').update({ total_amount: newTotal }).eq('id', report.id)
    setItems(newItems)
    setShowAddItem(false)
    setNewItem({ expense_type: 'voo', description: '', amount: '', date: '', origin: '', destination: '', airline: '', flight_class: 'econômica', checkin_date: '', checkout_date: '', num_nights: '', daily_rate: '', transport_type: 'Uber', consultant_name: '', consultant_scope: '', num_people: '', receipt_url: '', notes: '' })
    setSaving(false)
  }

  async function deleteItem(id) {
    await supabase.from('expense_items').delete().eq('id', id)
    const remaining = items.filter(it => it.id !== id)
    const newTotal = remaining.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
    await supabase.from('expense_reports').update({ total_amount: newTotal }).eq('id', report.id)
    setItems(remaining)
  }

  async function sendComment() {
    if (!newComment.trim()) return
    const { data } = await supabase.from('task_comments').insert({
      task_id: report.id, org_id: profile.org_id,
      user_id: profile.id, user_name: profile.full_name,
      content: newComment.trim(), type: 'comment',
    }).select().single()
    if (data) { setComments(p => [...p, data]); setNewComment('') }
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('expense_reports').update({
      title: form.title, notes: form.notes,
      project_id: form.project_id || null,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
    }).eq('id', report.id)
    toast.success('Salvo')
    setSaving(false)
    onSave?.()
  }

  const TypeIcon = EXPENSE_TYPES[newItem.expense_type]?.icon || CreditCard

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,16,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 'min(98vw, 1240px)', height: '88vh', borderTop: `3px solid ${stage.dot}` }}>

        {/* HEADER */}
        <div className="shrink-0 px-7 pt-5 pb-4 border-b border-zinc-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Linha 1: breadcrumb projeto */}
              {project && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.dot }} />
                  <span className="text-xs text-zinc-400 font-medium">{project.name}</span>
                </div>
              )}
              {/* Linha 2: título grande */}
              <input className="w-full text-2xl font-bold text-zinc-800 border-0 outline-none placeholder:text-zinc-300 bg-transparent mb-3 leading-snug"
                placeholder="Título do relatório…"
                value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))}
                disabled={!canEdit} />
              {/* Linha 3: período editável em destaque + status + solicitante */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-3 py-1.5 rounded-full border"
                  style={{ background: stage.header, color: stage.text, borderColor: stage.border }}>
                  {stage.label}
                </span>
                {/* Período — sempre visível e editável */}
                <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1">
                  <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                  {canEdit ? (
                    <>
                      <input type="date" className="text-xs border-0 bg-transparent outline-none text-zinc-600 w-32"
                        title="Início do período"
                        value={form.period_start} onChange={e => setForm(p => ({...p, period_start: e.target.value}))} />
                      <span className="text-zinc-300 text-xs">→</span>
                      <input type="date" className="text-xs border-0 bg-transparent outline-none text-zinc-600 w-32"
                        title="Fim do período"
                        value={form.period_end} onChange={e => setForm(p => ({...p, period_end: e.target.value}))} />
                    </>
                  ) : (
                    <span className="text-xs text-zinc-600">
                      {form.period_start ? `${fmtDateShort(form.period_start)} → ${fmtDateShort(form.period_end)}` : 'Período não definido'}
                    </span>
                  )}
                </div>
                {submitter && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ background: submitter.avatar_color || VL }}>
                      {initials(submitter.full_name)}
                    </div>
                    <span className="text-xs text-zinc-500">{submitter.full_name?.split(' ')[0]}</span>
                  </div>
                )}
                <span className="text-base font-bold" style={{ color: stage.dot }}>{fmtBRL(total)}</span>
              </div>
            </div>

            {/* Botões topo direito */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Avançar estágio */}
              {isLeader && stage.next && (
                <button onClick={() => onAdvance(report, stage.next)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border transition-all hover:shadow-sm"
                  style={{ color: stage.text, borderColor: stage.border, background: stage.header }}>
                  <Check className="w-3.5 h-3.5" />
                  {STAGE_MAP[stage.next]?.label} →
                </button>
              )}
              {/* Gerar relatório */}
              {report.status === 'aprovado' && (
                <button onClick={() => generateBXReport(report, items, submitter, approver, project)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl"
                  style={{ background: CH }}>
                  <FileText className="w-3.5 h-3.5" /> Relatório BX
                </button>
              )}
              {/* Rejeitar */}
              {isLeader && !['rejeitado','pago'].includes(report.status) && (
                <button onClick={() => onReject(report)} title="Rejeitar"
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 border border-zinc-200 hover:border-red-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 border border-zinc-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* CORPO: 3 colunas */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* COL 1: Itens de despesa */}
          <div className="shrink-0 border-r border-zinc-100 bg-zinc-50/40 flex flex-col overflow-hidden" style={{ width: 340 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Despesas</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold" style={{ color: VL }}>{fmtBRL(total)}</span>
                {canEdit && (
                  <button onClick={() => setShowAddItem(p => !p)}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-white text-sm" style={{ background: VL }}>+</button>
                )}
              </div>
            </div>

            {/* Form novo item */}
            {showAddItem && canEdit && (
              <div className="border-b border-violet-100 bg-violet-50/60 px-4 py-3 shrink-0">
                {/* Tipo */}
                <div className="flex gap-1 flex-wrap mb-3">
                  {Object.entries(EXPENSE_TYPES).map(([key, t]) => {
                    const Icon = t.icon
                    return (
                      <button key={key} onClick={() => setNewItem(p => ({...p, expense_type: key}))}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all"
                        style={newItem.expense_type === key
                          ? { background: t.color, color: 'white', borderColor: t.color }
                          : { background: 'white', color: t.color, borderColor: t.color + '44' }}>
                        <Icon className="w-2.5 h-2.5" />{t.label}
                      </button>
                    )
                  })}
                </div>

                {/* Campos por tipo */}
                {newItem.expense_type === 'voo' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input className="col-span-2 text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Cia Aérea" value={newItem.airline} onChange={e => setNewItem(p => ({...p, airline: e.target.value}))} />
                      <input className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Origem" value={newItem.origin} onChange={e => setNewItem(p => ({...p, origin: e.target.value}))} />
                      <input className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Destino" value={newItem.destination} onChange={e => setNewItem(p => ({...p, destination: e.target.value}))} />
                      <input type="date" className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" value={newItem.date} onChange={e => setNewItem(p => ({...p, date: e.target.value}))} />
                      <select className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none" value={newItem.flight_class} onChange={e => setNewItem(p => ({...p, flight_class: e.target.value}))}>
                        <option>econômica</option><option>executiva</option><option>primeira classe</option>
                      </select>
                    </div>
                    <input type="number" className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Valor (R$) *" value={newItem.amount} onChange={e => setNewItem(p => ({...p, amount: e.target.value}))} />
                  </div>
                )}
                {newItem.expense_type === 'hotel' && (
                  <div className="space-y-2">
                    <input className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Hotel / Local" value={newItem.description} onChange={e => setNewItem(p => ({...p, description: e.target.value}))} />
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-[9px] text-zinc-400 uppercase block mb-1">Check-in</label>
                        <input type="date" className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" value={newItem.checkin_date} onChange={e => {
                          const d = e.target.value; setNewItem(p => {
                            const nights = p.checkout_date && d ? Math.max(1, Math.ceil((new Date(p.checkout_date) - new Date(d)) / 86400000)) : p.num_nights
                            return {...p, checkin_date: d, num_nights: nights}
                          })
                        }} /></div>
                      <div><label className="text-[9px] text-zinc-400 uppercase block mb-1">Check-out</label>
                        <input type="date" className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" value={newItem.checkout_date} onChange={e => {
                          const d = e.target.value; setNewItem(p => {
                            const nights = p.checkin_date && d ? Math.max(1, Math.ceil((new Date(d) - new Date(p.checkin_date)) / 86400000)) : p.num_nights
                            return {...p, checkout_date: d, num_nights: nights}
                          })
                        }} /></div>
                      <div><label className="text-[9px] text-zinc-400 uppercase block mb-1">Diárias</label>
                        <input type="number" className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white" value={newItem.num_nights} readOnly /></div>
                      <div><label className="text-[9px] text-zinc-400 uppercase block mb-1">Valor/noite</label>
                        <input type="number" className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="R$" value={newItem.daily_rate} onChange={e => setNewItem(p => ({...p, daily_rate: e.target.value}))} /></div>
                    </div>
                    {newItem.num_nights && newItem.daily_rate && (
                      <div className="text-xs font-bold text-violet-700 bg-violet-50 px-3 py-2 rounded-lg">
                        Total: {fmtBRL(parseFloat(newItem.num_nights) * parseFloat(newItem.daily_rate))}
                      </div>
                    )}
                  </div>
                )}
                {newItem.expense_type === 'transporte' && (
                  <div className="space-y-2">
                    <select className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none" value={newItem.transport_type} onChange={e => setNewItem(p => ({...p, transport_type: e.target.value}))}>
                      <option>Uber</option><option>Taxi</option><option>Ônibus</option><option>Trem</option><option>KM Rodado</option><option>Combustível</option><option>Pedágio</option><option>Outro</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Origem" value={newItem.origin} onChange={e => setNewItem(p => ({...p, origin: e.target.value}))} />
                      <input className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Destino" value={newItem.destination} onChange={e => setNewItem(p => ({...p, destination: e.target.value}))} />
                      <input type="date" className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white" value={newItem.date} onChange={e => setNewItem(p => ({...p, date: e.target.value}))} />
                      <input type="number" className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Valor (R$) *" value={newItem.amount} onChange={e => setNewItem(p => ({...p, amount: e.target.value}))} />
                    </div>
                  </div>
                )}
                {newItem.expense_type === 'refeicao' && (
                  <div className="space-y-2">
                    <input className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Restaurante / Estabelecimento" value={newItem.description} onChange={e => setNewItem(p => ({...p, description: e.target.value}))} />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="date" className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white" value={newItem.date} onChange={e => setNewItem(p => ({...p, date: e.target.value}))} />
                      <input type="number" className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white" placeholder="Pessoas" value={newItem.num_people} onChange={e => setNewItem(p => ({...p, num_people: e.target.value}))} />
                      <input type="number" className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Total R$*" value={newItem.amount} onChange={e => setNewItem(p => ({...p, amount: e.target.value}))} />
                    </div>
                  </div>
                )}
                {newItem.expense_type === 'consultor' && (
                  <div className="space-y-2">
                    <input className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Nome do Consultor *" value={newItem.consultant_name} onChange={e => setNewItem(p => ({...p, consultant_name: e.target.value}))} />
                    <input className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Escopo / Serviço prestado" value={newItem.consultant_scope} onChange={e => setNewItem(p => ({...p, consultant_scope: e.target.value}))} />
                    {/* Período de serviço — controle de sobreposição */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <div className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Período de serviço</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[9px] text-amber-600 mb-1">Início *</div>
                          <input type="date" className="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-amber-400"
                            value={newItem.checkin_date} onChange={e => setNewItem(p => ({...p, checkin_date: e.target.value}))} />
                        </div>
                        <div>
                          <div className="text-[9px] text-amber-600 mb-1">Fim *</div>
                          <input type="date" className="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-amber-400"
                            value={newItem.checkout_date} onChange={e => setNewItem(p => ({...p, checkout_date: e.target.value}))} />
                        </div>
                      </div>
                      {newItem.checkin_date && newItem.checkout_date && (
                        <div className="text-[9px] text-amber-700 mt-1.5 font-medium">
                          {Math.ceil((new Date(newItem.checkout_date) - new Date(newItem.checkin_date)) / 86400000)} dias de serviço
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] text-zinc-400 mb-1">Data pgto.</div>
                        <input type="date" className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" value={newItem.date} onChange={e => setNewItem(p => ({...p, date: e.target.value}))} />
                      </div>
                      <div>
                        <div className="text-[9px] text-zinc-400 mb-1">Valor total (R$) *</div>
                        <input type="number" className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="0,00" value={newItem.amount} onChange={e => setNewItem(p => ({...p, amount: e.target.value}))} />
                      </div>
                    </div>
                  </div>
                )}
                {newItem.expense_type === 'outros' && (
                  <div className="space-y-2">
                    <input className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Descrição *" value={newItem.description} onChange={e => setNewItem(p => ({...p, description: e.target.value}))} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 bg-white" value={newItem.date} onChange={e => setNewItem(p => ({...p, date: e.target.value}))} />
                      <input type="number" className="text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Valor (R$) *" value={newItem.amount} onChange={e => setNewItem(p => ({...p, amount: e.target.value}))} />
                    </div>
                  </div>
                )}

                {/* Comprovante */}
                <input className="w-full mt-2 text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white" placeholder="Link do comprovante (URL) — opcional" value={newItem.receipt_url} onChange={e => setNewItem(p => ({...p, receipt_url: e.target.value}))} />

                <div className="flex gap-2 mt-3">
                  <button onClick={addItem} disabled={saving || !calcItemAmount()}
                    className="flex-1 py-2 text-xs font-bold text-white rounded-lg disabled:opacity-40"
                    style={{ background: VL }}>
                    {saving ? 'Salvando…' : '+ Adicionar'}
                  </button>
                  <button onClick={() => setShowAddItem(false)} className="px-3 py-2 text-xs text-zinc-500">Cancelar</button>
                </div>
              </div>
            )}

            {/* Lista de itens */}
            <div className="flex-1 overflow-y-auto">
              {loadingItems ? (
                <div className="p-4 text-xs text-zinc-400 text-center">Carregando…</div>
              ) : items.length === 0 ? (
                <div className="p-6 text-center">
                  <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">Nenhuma despesa ainda</p>
                  {canEdit && <button onClick={() => setShowAddItem(true)} className="mt-2 text-xs font-semibold hover:underline" style={{ color: VL }}>+ Adicionar despesa</button>}
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {items.map(it => {
                    const typeInfo = EXPENSE_TYPES[it.expense_type || it.category] || EXPENSE_TYPES.outros
                    const Icon = typeInfo.icon
                    return (
                      <div key={it.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/60 group">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: typeInfo.bg }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: typeInfo.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <div className="text-xs font-semibold text-zinc-800 truncate">
                              {it.description || it.consultant_name || it.airline || typeInfo.label}
                            </div>
                            <span className="text-xs font-bold shrink-0" style={{ color: typeInfo.color }}>{fmtBRL(it.amount)}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            {it.expense_type === 'voo' && `${it.origin || ''}→${it.destination || ''} · ${it.flight_class || ''}`}
                            {it.expense_type === 'hotel' && `${it.num_nights}n × ${fmtBRL(it.daily_rate)}/noite · ${fmtDateShort(it.checkin_date)}→${fmtDateShort(it.checkout_date)}`}
                            {it.expense_type === 'transporte' && `${it.transport_type || ''} ${it.origin && it.destination ? it.origin+'→'+it.destination : ''}`}
                            {it.expense_type === 'refeicao' && `${it.num_people ? it.num_people+' pessoas' : ''} · ${fmtDate(it.date)}`}
                            {it.expense_type === 'consultor' && (
                              <span>{it.consultant_scope || ''} {it.checkin_date ? `· ${fmtDateShort(it.checkin_date)}→${fmtDateShort(it.checkout_date)}` : `· ${fmtDate(it.date)}`}</span>
                            )}
                            {(!it.expense_type || it.expense_type === 'outros') && fmtDate(it.date)}
                          </div>
                          {it.receipt_url && (
                            <a href={it.receipt_url} target="_blank" rel="noopener noreferrer"
                              className="text-[9px] font-semibold mt-0.5 inline-block hover:underline" style={{ color: VL }}>
                              📎 Ver comprovante
                            </a>
                          )}
                        </div>
                        {canEdit && (
                          <button onClick={() => deleteItem(it.id)} className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 shrink-0 transition-opacity">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Total footer */}
            <div className="shrink-0 border-t border-zinc-200 px-4 py-3 bg-white flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-semibold">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              <span className="text-sm font-bold" style={{ color: VL }}>{fmtBRL(total)}</span>
            </div>
          </div>

          {/* COL 2: Comentários */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="shrink-0 px-5 py-2.5 border-b border-zinc-100 bg-zinc-50/30 flex items-center gap-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Discussão</span>
              {comments.length > 0 && <span className="text-[10px] text-zinc-400 bg-white border border-zinc-200 rounded-full px-1.5 py-0.5">{comments.length}</span>}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <MessageSquare className="w-10 h-10 text-zinc-200 mb-2" />
                  <p className="text-xs text-zinc-400">Sem comentários ainda.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((cm, i) => {
                    const p = profiles.find(pr => pr.id === cm.user_id)
                    const isMine = cm.user_id === profile?.id
                    return (
                      <div key={i} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                          style={{ background: p?.avatar_color || VL }}>
                          {initials(cm.user_name)}
                        </div>
                        <div className={`flex-1 min-w-0 ${isMine ? 'items-end' : ''} flex flex-col`}>
                          <div className={`flex items-baseline gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs font-bold text-zinc-700">{cm.user_name?.split(' ')[0]}</span>
                            <span className="text-[10px] text-zinc-400">{new Date(cm.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className={`text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl max-w-[85%] ${isMine ? 'text-white' : 'bg-zinc-100 text-zinc-700'}`}
                            style={isMine ? { background: VL, borderRadius: '16px 4px 16px 16px' } : { borderRadius: '4px 16px 16px 16px' }}>
                            {cm.content}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={commentEndRef} />
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-zinc-100 px-4 py-3 bg-white">
              <div className="flex gap-2.5 items-end">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: profile?.avatar_color || VL }}>
                  {initials(profile?.full_name)}
                </div>
                <div className="flex-1 border border-zinc-200 rounded-xl overflow-hidden focus-within:border-violet-400 transition-colors">
                  <textarea rows={2}
                    className="w-full text-sm px-3.5 pt-2.5 pb-1 resize-none outline-none placeholder:text-zinc-400 leading-relaxed bg-white"
                    placeholder="Comentário… Enter para enviar"
                    value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() }}} />
                  <div className="flex justify-end px-2 pb-2">
                    <button onClick={sendComment} disabled={!newComment.trim()}
                      className="px-3 py-1 text-xs font-bold text-white rounded-lg disabled:opacity-30"
                      style={{ background: VL }}>Enviar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COL 3: Sidebar metadados */}
          <div className="shrink-0 border-l border-zinc-100 bg-zinc-50/40 flex flex-col overflow-hidden" style={{ width: 280 }}>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

              {/* Título */}
              {canEdit && (
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Título</label>
                  <input className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500 bg-white"
                    value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} />
                </div>
              )}

              {/* Período */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Período</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] text-zinc-400 mb-1">Início</div>
                    <input type="date" className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-violet-500"
                      value={form.period_start} onChange={e => setForm(p => ({...p, period_start: e.target.value}))} disabled={!canEdit} />
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-400 mb-1">Fim</div>
                    <input type="date" className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-violet-500"
                      value={form.period_end} onChange={e => setForm(p => ({...p, period_end: e.target.value}))} disabled={!canEdit} />
                  </div>
                </div>
              </div>

              {/* Resumo por tipo */}
              {items.length > 0 && (
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Por categoria</label>
                  <div className="space-y-1.5">
                    {Object.entries(EXPENSE_TYPES).map(([key, t]) => {
                      const typeItems = items.filter(it => (it.expense_type || it.category) === key)
                      if (!typeItems.length) return null
                      const typeTotal = typeItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
                      const Icon = t.icon
                      return (
                        <div key={key} className="flex items-center gap-2 bg-white border border-zinc-100 rounded-lg px-2.5 py-1.5">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: t.bg }}>
                            <Icon className="w-3 h-3" style={{ color: t.color }} />
                          </div>
                          <span className="text-[10px] text-zinc-600 flex-1">{t.label}</span>
                          <span className="text-[10px] font-bold" style={{ color: t.color }}>{fmtBRL(typeTotal)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="h-px bg-zinc-200" />

              {/* Projeto */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Projeto / Mandato</label>
                <select className="w-full text-xs bg-white border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-violet-500"
                  value={form.project_id} onChange={e => setForm(p => ({...p, project_id: e.target.value}))} disabled={!canEdit}>
                  <option value="">— nenhum —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Solicitante */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Solicitante</label>
                {submitter && (
                  <div className="flex items-center gap-2 bg-white border border-zinc-100 rounded-lg px-2.5 py-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ background: submitter.avatar_color || VL }}>{initials(submitter.full_name)}</div>
                    <span className="text-xs text-zinc-700">{submitter.full_name}</span>
                  </div>
                )}
              </div>

              {/* Aprovador */}
              {(report.approved_by || isLeader) && (
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Aprovador</label>
                  {approver ? (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ background: approver.avatar_color || '#10B981' }}>{initials(approver.full_name)}</div>
                      <div>
                        <div className="text-xs text-zinc-700 font-medium">{approver.full_name}</div>
                        {report.approved_at && <div className="text-[9px] text-zinc-400">{fmtDate(report.approved_at.split('T')[0])}</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-400 italic px-1">Aguardando aprovação</div>
                  )}
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Observações</label>
                <textarea rows={3} className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-violet-500 bg-white placeholder:text-zinc-300"
                  placeholder="Observações gerais…"
                  value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} disabled={!canEdit} />
              </div>

              <div className="h-px bg-zinc-200" />

              {/* Datas */}
              <div className="space-y-1">
                {report.submitted_at && <div className="text-[10px] text-zinc-400">Submetido: <span className="text-zinc-500 font-medium">{fmtDate(report.submitted_at.split('T')[0])}</span></div>}
                {report.approved_at && <div className="text-[10px] text-zinc-400">Aprovado: <span className="text-zinc-500 font-medium">{fmtDate(report.approved_at.split('T')[0])}</span></div>}
                {report.paid_at && <div className="text-[10px] text-zinc-400">Pago: <span className="text-zinc-500 font-medium">{fmtDate(report.paid_at.split('T')[0])}</span></div>}
                <div className="text-[10px] text-zinc-400">Criado: <span className="text-zinc-500">{fmtDate(report.created_at?.split('T')[0])}</span></div>
              </div>
            </div>

            {/* Salvar */}
            {canEdit && (
              <div className="shrink-0 border-t border-zinc-100 p-3.5 bg-white">
                <button onClick={handleSave} disabled={saving}
                  className="w-full py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 hover:opacity-90"
                  style={{ background: VL }}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            )}
            {/* Gerar relatório sempre visível quando aprovado */}
            {report.status === 'aprovado' && (
              <div className="shrink-0 border-t border-zinc-100 p-3.5 bg-white">
                <button onClick={() => generateBXReport(report, items, submitter, approver, project)}
                  className="w-full py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: '#2D2E39' }}>
                  <FileText className="w-4 h-4" /> Gerar Relatório BX
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Reembolsos ───────────────────────────────────────────────────────────
export default function Reembolsos() {
  const { profile } = useData()
  usePageTitle('Reembolsos')

  const [reports, setReports] = useState([])
  const [profiles, setProfilesList] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [modalReport, setModalReport] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ title: '', project_id: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const isLeader = isLeaderRole(profile?.role)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [repR, profR, projR] = await Promise.allSettled([
      supabase.from('expense_reports').select('*').eq('org_id', profile.org_id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,initials,avatar_color,role').eq('org_id', profile.org_id).order('full_name'),
      supabase.from('projects').select('id,name,status').eq('org_id', profile.org_id).order('name'),
    ])
    if (repR.status === 'fulfilled' && !repR.value.error) setReports(repR.value.data || [])
    if (profR.status === 'fulfilled' && !profR.value.error) setProfilesList(profR.value.data || [])
    if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  async function createReport() {
    if (!newForm.title.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('expense_reports').insert({
      org_id: profile.org_id, submitted_by: profile.id,
      title: newForm.title.trim(), project_id: newForm.project_id || null,
      status: 'rascunho', total_amount: 0,
    }).select().single()
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    setShowNew(false)
    setNewForm({ title: '', project_id: '' })
    await load()
    setModalReport(data)
    setSaving(false)
  }

  async function advanceStatus(report, nextStatus) {
    const updates = { status: nextStatus }
    if (nextStatus === 'aprovado')   { updates.approved_by = profile.id; updates.approved_at = new Date().toISOString() }
    if (nextStatus === 'pago')       { updates.paid_at = new Date().toISOString() }
    if (nextStatus === 'submetido')  { updates.submitted_at = new Date().toISOString() }
    const { error } = await supabase.from('expense_reports')
      .update(updates).eq('id', report.id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao avançar: ' + error.message); return }
    toast.success(`Movido para ${STAGE_MAP[nextStatus]?.label}`)
    await load()
    if (modalReport?.id === report.id) setModalReport(p => ({...p, ...updates, status: nextStatus}))
  }

  async function rejectReport() {
    if (!rejectModal) return
    await supabase.from('expense_reports').update({
      status: 'rejeitado', rejection_reason: rejectReason
    }).eq('id', rejectModal.id).eq('org_id', profile.org_id)
    toast.success('Relatório rejeitado')
    setRejectModal(null); setRejectReason('')
    await load()
    if (modalReport?.id === rejectModal.id) setModalReport(null)
  }

  async function deleteReport(id) {
    if (!await confirm('Excluir este relatório?', { danger: true })) return
    await supabase.from('expense_items').delete().eq('report_id', id)
    await supabase.from('expense_reports').delete().eq('id', id).eq('org_id', profile.org_id)
    toast.success('Excluído')
    await load()
  }

  // Drag & drop entre colunas
  function onDragStart(e, report) { setDragging(report); e.dataTransfer.effectAllowed = 'move' }
  function onDragEnd() { setDragging(null); setDragOver(null) }
  function onDragOver(e, stageId) { e.preventDefault(); setDragOver(stageId) }
  async function onDrop(e, stageId) {
    e.preventDefault(); setDragOver(null)
    if (!dragging || dragging.status === stageId) return
    if (!isLeader && stageId !== 'submetido') { toast.warning('Sem permissão para este estágio'); return }
    await advanceStatus(dragging, stageId)
    setDragging(null)
  }

  const filtered = reports.filter(r =>
    !search || r.title?.toLowerCase().includes(search.toLowerCase())
  )

  const profMap = Object.fromEntries(profiles.map(p => [p.id, p]))

  // KPIs
  const totalPendente = reports.filter(r => r.status === 'submetido' || r.status === 'em_analise').reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0)
  const totalAprovado = reports.filter(r => r.status === 'aprovado').reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0)
  const totalPago = reports.filter(r => r.status === 'pago').reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0)

  return (
    <div className="p-6 max-w-[1600px] mx-auto">

      {/* Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: CH }}>
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2" style={{ color: '#A5B4FC' }}>
              <Receipt className="w-3 h-3" /> Gestão de Despesas
            </div>
            <h1 className="text-2xl font-bold mb-1">Reembolsos</h1>
            <div className="text-sm text-zinc-400">{reports.length} relatório{reports.length !== 1 ? 's' : ''} · {profiles.length} membros</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
              <div className="text-lg font-bold text-amber-400">{fmtBRL(totalPendente)}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Aguardando</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
              <div className="text-lg font-bold text-emerald-400">{fmtBRL(totalAprovado)}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Aprovado</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
              <div className="text-lg font-bold text-blue-400">{fmtBRL(totalPago)}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Pago</div>
            </div>
          </div>
        </div>
        {/* Contador por estágio */}
        <div className="grid grid-cols-5 gap-2">
          {STAGES.map(s => (
            <div key={s.id} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center">
              <div className="text-base font-bold" style={{ color: s.dot === '#94A3B8' ? '#94A3B8' : s.dot }}>
                {reports.filter(r => r.status === s.id).length}
              </div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros + novo */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input className="pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:border-violet-500 w-64"
            placeholder="Buscar relatórios…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={load} className="p-2 text-zinc-400 hover:text-zinc-600 border border-zinc-200 rounded-lg bg-white">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button onClick={() => setShowNew(true)}
          className="ml-auto flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded-xl hover:opacity-90"
          style={{ background: VL }}>
          <Plus className="w-4 h-4" /> Novo Relatório
        </button>
      </div>

      {/* Form novo relatório */}
      {showNew && (
        <div className="bg-white border border-violet-200 rounded-xl p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2"><Receipt className="w-4 h-4 text-violet-600" /> Novo Relatório de Despesas</h3>
            <button onClick={() => setShowNew(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3">
            <input className="border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
              placeholder="Título (ex: Viagem Braskem RJ — Abr/2026) *"
              value={newForm.title} onChange={e => setNewForm(p => ({...p, title: e.target.value}))}
              onKeyDown={e => e.key === 'Enter' && createReport()} autoFocus />
            <select className="border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-500"
              value={newForm.project_id} onChange={e => setNewForm(p => ({...p, project_id: e.target.value}))}>
              <option value="">Projeto (opcional)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={createReport} disabled={saving || !newForm.title.trim()}
              className="px-5 py-2.5 text-sm font-bold text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ background: VL }}>
              {saving ? 'Criando…' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      {/* Kanban pipeline */}
      {loading ? (
        <div className="text-center py-12 text-sm text-zinc-400">Carregando…</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {STAGES.map(stage => {
            const stageCols = filtered.filter(r => r.status === stage.id)
            const stageTotal = stageCols.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0)
            const isOver = dragOver === stage.id
            return (
              <div key={stage.id}
                className={`flex flex-col rounded-2xl border-2 transition-all ${isOver ? 'border-violet-400 ring-2 ring-violet-300 ring-offset-2' : 'border-zinc-200'}`}
                style={{ background: '#F8F9FC' }}
                onDragOver={e => onDragOver(e, stage.id)}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => onDrop(e, stage.id)}>

                {/* Column header */}
                <div className="px-4 py-3 rounded-t-2xl border-b" style={{ background: stage.header, borderColor: stage.border }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.dot }} />
                      <span className="text-xs font-bold text-zinc-700">{stage.label}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border"
                        style={{ color: stage.text, borderColor: stage.border }}>{stageCols.length}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-600">{fmtBRL(stageTotal)}</span>
                    <span className="text-[10px] text-zinc-400">{stageCols.length === 0 ? 'Vazio' : `${stageCols.length} relatório${stageCols.length > 1 ? 's' : ''}`}</span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-3 flex-1 min-h-[200px]">
                  {stageCols.length === 0 ? (
                    <div className="text-center py-10 text-xs text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl">
                      {isOver ? '↓ Soltar aqui' : 'Vazio'}
                    </div>
                  ) : stageCols.map(report => {
                    const submitter = profMap[report.submitted_by]
                    const proj = projects.find(p => p.id === report.project_id)
                    const isStale = report.updated_at &&
                      (new Date() - new Date(report.updated_at)) / 86400000 > 7 &&
                      report.status !== 'pago' && report.status !== 'rascunho'

                    return (
                      <div key={report.id} draggable
                        onDragStart={e => onDragStart(e, report)} onDragEnd={onDragEnd}
                        onClick={() => setModalReport(report)}
                        className={`bg-white rounded-xl cursor-pointer overflow-hidden transition-all ${dragging?.id === report.id ? 'opacity-30 scale-95' : 'hover:shadow-lg hover:-translate-y-0.5'}`}
                        style={{
                          boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(0,0,0,0.05)',
                          borderLeft: `3px solid ${isStale ? '#EF4444' : stage.dot}`,
                        }}>
                        <div className="p-4">
                          {/* Badge */}
                          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                              style={{ background: isStale ? '#FEF2F2' : stage.header, color: isStale ? '#B91C1C' : stage.text, borderColor: isStale ? '#FECACA' : stage.border }}>
                              {isStale ? 'Parado +7d' : stage.label}
                            </span>
                            {report.status === 'rejeitado' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Rejeitado</span>
                            )}
                          </div>

                          {/* Projeto */}
                          {proj && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stage.dot + 'CC' }} />
                              <span className="text-[10px] text-zinc-400 font-medium truncate">{proj.name}</span>
                            </div>
                          )}

                          {/* Título */}
                          <div className="text-sm font-bold text-zinc-800 leading-snug mb-3 line-clamp-2">{report.title}</div>

                          {/* Valor total em destaque */}
                          <div className="mb-3">
                            <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold mb-0.5">Total solicitado</div>
                            <div className="text-lg font-bold" style={{ color: stage.dot }}>{fmtBRL(report.total_amount)}</div>
                          </div>

                          {/* Período — destaque visual */}
                          {report.period_start ? (
                            <div className="flex items-center gap-1.5 mb-3">
                              <div className="flex items-center gap-1 bg-white border rounded-lg px-2.5 py-1.5 text-[10px] font-semibold"
                                style={{ borderColor: stage.border, color: stage.text }}>
                                <Clock className="w-3 h-3 shrink-0" />
                                {fmtDateShort(report.period_start)} → {fmtDateShort(report.period_end)}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 mb-3">
                              <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-medium">
                                ⚠ Período não definido
                              </span>
                            </div>
                          )}

                          {/* Footer: responsável + data */}
                          <div className="flex items-center justify-between">
                            {submitter ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                  style={{ background: submitter.avatar_color || VL }}>
                                  {initials(submitter.full_name)}
                                </div>
                                <span className="text-[10px] text-zinc-500">{submitter.full_name?.split(' ')[0]}</span>
                              </div>
                            ) : <span className="text-[10px] text-zinc-400 italic">—</span>}
                            <span className="text-[9px] text-zinc-400">
                              {report.created_at ? fmtDateShort(report.created_at.split('T')[0]) : ''}
                            </span>
                          </div>
                        </div>

                        {/* Botão Relatório BX — só no Aprovado */}
                        {report.status === 'aprovado' && (
                          <div className="border-t border-emerald-100 px-3 py-2"
                            style={{ background: '#F0FDF4' }}>
                            <button
                              onClick={async e => {
                                e.stopPropagation()
                                // Load items then generate
                                const { data: its } = await supabase.from('expense_items').select('*').eq('report_id', report.id)
                                const sub = profiles.find(p => p.id === report.submitted_by)
                                const apr = profiles.find(p => p.id === report.approved_by)
                                const proj = projects.find(p => p.id === report.project_id)
                                generateBXReport(report, its || [], sub, apr, proj)
                              }}
                              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg text-white transition-all hover:opacity-90"
                              style={{ background: 'linear-gradient(135deg, #2D2E39 0%, #5452C1 100%)' }}>
                              <FileText className="w-3.5 h-3.5" />
                              Gerar Relatório BX
                            </button>
                          </div>
                        )}

                        {/* Navegação de estágio */}
                        {report.status !== 'rejeitado' && (() => {
                          const idx = STAGES.findIndex(s => s.id === report.status)
                          const prev = STAGES[idx - 1]
                          const next = STAGES[idx + 1]
                          return (
                            <div className="border-t border-zinc-100 flex">
                              {prev ? (
                                <button onClick={e => { e.stopPropagation(); advanceStatus(report, prev.id) }}
                                  className="flex-1 text-[9px] py-2 px-2 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-colors text-center truncate">
                                  ← {prev.label}
                                </button>
                              ) : <div className="flex-1" />}
                              {prev && next && <div className="w-px bg-zinc-100" />}
                              {next ? (
                                <button onClick={e => { e.stopPropagation(); advanceStatus(report, next.id) }}
                                  className="flex-1 text-[9px] py-2 px-2 font-bold transition-colors text-center truncate hover:bg-zinc-50"
                                  style={{ color: stage.dot }}>
                                  {next.label} →
                                </button>
                              ) : <div className="flex-1" />}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de rejeição */}
      {rejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-zinc-800 mb-1">Rejeitar Relatório</h3>
            <p className="text-xs text-zinc-500 mb-4">Motivo da rejeição (opcional)</p>
            <textarea rows={3} autoFocus
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400 mb-4"
              placeholder="Ex: comprovantes faltando, valor acima do limite…"
              value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={rejectReport} className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl bg-red-500 hover:bg-red-600">Rejeitar</button>
              <button onClick={() => { setRejectModal(null); setRejectReason('') }} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de despesa */}
      {modalReport && (
        <ExpenseModal
          report={modalReport}
          profiles={profiles}
          projects={projects}
          onClose={() => setModalReport(null)}
          onSave={async () => { await load(); }}
          onDelete={deleteReport}
          onAdvance={advanceStatus}
          onReject={r => { setRejectModal(r); setModalReport(null) }}
        />
      )}
    </div>
  )
}
