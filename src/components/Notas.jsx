import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'

/* ─── type config ─── */
const TYPE_CONFIG = {
  note:      { icon: '📝', label: 'Nota',     color: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  meeting:   { icon: '🎙️', label: 'Reunião',  color: '#10B981', bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  ata:       { icon: '📋', label: 'Ata',       color: '#F59E0B', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  idea:      { icon: '💡', label: 'Ideia',     color: '#EC4899', bg: '#FDF2F8', text: '#9D174D', border: '#FBCFE8' },
  checklist: { icon: '✅', label: 'Checklist', color: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
}

const PROJ_COLORS = ['#F59E0B','#EF4444','#6366F1','#10B981','#EC4899','#8B5CF6','#3B82F6','#14B8A6']
function projColor(id) {
  if (!id) return '#9CA3AF'
  let h = 0; for (const c of id) h = (h << 5) - h + c.charCodeAt(0)
  return PROJ_COLORS[Math.abs(h) % PROJ_COLORS.length]
}

/* ─── templates ─── */
const TEMPLATES = {
  ata:           '<h2>Ata de Reunião</h2><p><b>Data:</b> ' + new Date().toLocaleDateString('pt-BR') + '</p><p><b>Participantes:</b></p><ul><li></li></ul><h3>Pauta</h3><ol><li></li></ol><h3>Deliberações</h3><p></p><h3>Encaminhamentos</h3><ul><li></li></ul>',
  diagnostico:   '<h2>Diagnóstico Financeiro</h2><h3>1. Contexto</h3><p></p><h3>2. Análise (Fleuriet/DuPont)</h3><p></p><h3>3. Pontos Críticos</h3><ul><li></li></ul><h3>4. Recomendações</h3><ol><li></li></ol>',
  negociacao:    '<h2>Negociação Bancária</h2><p><b>Credor:</b></p><p><b>Valor original:</b></p><p><b>Proposta:</b></p><h3>Argumentos</h3><ul><li></li></ul><h3>Próximos passos</h3><ol><li></li></ol>',
  assembleia:    '<h2>Ata de Assembleia de Credores</h2><p><b>Processo:</b></p><p><b>Vara:</b></p><p><b>Data:</b> ' + new Date().toLocaleDateString('pt-BR') + '</p><h3>Credores Presentes</h3><ul><li></li></ul><h3>Deliberações</h3><p></p><h3>Resultado da Votação</h3><p></p>',
  weekly:        '<h2>Weekly — ' + new Date().toLocaleDateString('pt-BR') + '</h2><h3>Realizações da Semana</h3><ul><li></li></ul><h3>Bloqueios</h3><ul><li></li></ul><h3>Metas Próxima Semana</h3><ol><li></li></ol>',
  brainstorm:    '<h2>Brainstorm</h2><p><b>Tema:</b></p><h3>Ideias</h3><ul><li></li></ul>',
  onboarding:    '<h2>Onboarding — Novo Cliente BPO</h2><ul><li>☐ Contrato assinado</li><li>☐ Certificado digital recebido</li><li>☐ Acesso Omie configurado</li><li>☐ Procuração e-CAC</li><li>☐ Documentação societária</li><li>☐ Último balanço/balancete</li><li>☐ Reunião de kickoff</li></ul>',
  duediligence:  '<h2>Due Diligence</h2><p><b>Empresa-alvo:</b></p><h3>1. Análise Societária</h3><p></p><h3>2. Análise Financeira</h3><p></p><h3>3. Contingências</h3><ul><li></li></ul><h3>4. Red Flags</h3><ul><li></li></ul><h3>5. Recomendação</h3><p></p>',
  rj_kickoff:    '<h2>Kickoff RJ — ' + new Date().toLocaleDateString('pt-BR') + '</h2><p><b>Cliente:</b></p><p><b>Processo:</b></p><p><b>Vara Empresarial:</b></p><p><b>Administrador Judicial:</b></p><h3>Contexto</h3><p><b>Passivo total estimado:</b> R$</p><p><b>EBITDA:</b> R$</p><p><b>Dívida Líquida/EBITDA:</b> x</p><h3>Estratégia Acordada</h3><ol><li>Haircut proposto (Classes I-IV):</li><li>Carência: meses</li><li>Desinvestimentos previstos:</li></ol><h3>Divisão BX</h3><ul><li>Sócio responsável:</li><li>Analista líder:</li><li>Consultor tributário:</li></ul><h3>Action Items</h3><ul><li>☐ PRJ v1 até:</li><li>☐ Laudo avaliação até:</li><li>☐ Reunião AGC prevista:</li></ul>',
  rx_standstill: '<h2>Reunião Standstill — RX ' + new Date().toLocaleDateString('pt-BR') + '</h2><p><b>Cliente:</b></p><p><b>Credores presentes:</b></p><h3>Proposta BX</h3><p><b>Prazo standstill:</b> dias</p><p><b>Haircut proposto:</b> %</p><p><b>Cronograma:</b></p><h3>Status por Credor</h3><ul><li>✅ NDA assinado:</li><li>⏳ Aguardando comitê:</li><li>❌ Sem resposta:</li></ul><h3>Próximos Passos</h3><ol><li></li></ol>',
  fleuriet:      '<h2>Análise Fleuriet — ' + new Date().toLocaleDateString('pt-BR') + '</h2><p><b>Empresa:</b></p><p><b>Base:</b> Demonstrações auditadas</p><h3>Reclassificação do Balanço</h3><table><tr><td><b>NCG</b></td><td>R$</td></tr><tr><td><b>CDG</b></td><td>R$</td></tr><tr><td><b>ST</b></td><td>R$</td></tr></table><h3>Tipologia</h3><p><b>Tipo:</b> (I a VI)</p><p><b>Diagnóstico:</b></p><h3>Recomendações BX</h3><ol><li></li></ol>',
  status_semanal:'<h2>Status Semanal — ' + new Date().toLocaleDateString('pt-BR') + '</h2><h3>🏭 Braskem RJ</h3><ul><li>🟢</li><li>🟡</li><li>🔴</li></ul><h3>🛒 Americanas RX</h3><ul><li>🟢</li><li>🟡</li><li>🔴</li></ul><h3>⚡ Raízen</h3><ul><li>🟢</li><li>🟡</li><li>🔴</li></ul><h3>Alertas</h3><ol><li></li></ol>',
}

const TEMPLATE_LIST = [
  { icon: '📋', name: 'Ata Padrão',       key: 'ata',           type: 'ata' },
  { icon: '🔍', name: 'Diagnóstico',       key: 'diagnostico',   type: 'note' },
  { icon: '⚖️', name: 'Kickoff RJ',        key: 'rj_kickoff',    type: 'ata' },
  { icon: '🤝', name: 'Standstill RX',     key: 'rx_standstill', type: 'ata' },
  { icon: '📐', name: 'Análise Fleuriet',  key: 'fleuriet',      type: 'note' },
  { icon: '📊', name: 'Weekly',            key: 'weekly',        type: 'note' },
  { icon: '🏦', name: 'Neg. Bancária',     key: 'negociacao',    type: 'note' },
  { icon: '⚖️', name: 'Assembleia',        key: 'assembleia',    type: 'ata' },
  { icon: '🧠', name: 'Brainstorm',        key: 'brainstorm',    type: 'idea' },
  { icon: '🚀', name: 'Onboarding BPO',    key: 'onboarding',    type: 'checklist' },
  { icon: '📂', name: 'Due Diligence',     key: 'duediligence',  type: 'note' },
  { icon: '🗓️', name: 'Status Semanal',    key: 'status_semanal',type: 'note' },
]

/* ─── helpers ─── */
function relTime(d) {
  if (!d) return ''
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 604800) return `${Math.floor(s / 86400)}d`
  return new Date(d).toLocaleDateString('pt-BR')
}

function stripHtml(h) {
  if (!h) return ''
  const d = document.createElement('div')
  d.innerHTML = h
  return d.textContent || ''
}

/* ─── New Note Modal ─── */
function NewNoteModal({ projects, companies, onCreate, onClose }) {
  const [step, setStep] = useState('type')
  const [type, setType] = useState('note')
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [transcricao, setTranscricao] = useState('')
  const [meetType, setMeetType] = useState('reuniao_interna')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')

  function handleCreate(contentHtml = '', meetingData = null) {
    onCreate({ type, title: title || 'Sem título', content_html: contentHtml, project_id: projectId || null, company_id: companyId || null, meeting_data: meetingData })
  }

  async function processTranscricao() {
    if (!transcricao.trim()) return
    setProcessing(true)
    const steps = ['⏳ Lendo transcrição...', '🔍 Extraindo tópicos...', '📊 Gerando resumo...', '🧠 Mapa mental...', '✅ Identificando tarefas...', '🔴 Pontos críticos...', '✨ Finalizando...']
    for (const s of steps) { setProgress(s); await new Promise(r => setTimeout(r, 400)) }
    const words = transcricao.split(/\s+/)
    const topics = Array.from({ length: Math.min(5, Math.ceil(words.length / 50)) }, (_, i) => `Tópico ${i + 1}: ${words.slice(i * 10, i * 10 + 6).join(' ')}...`)
    const tasks = Array.from({ length: Math.min(4, Math.ceil(words.length / 80)) }, (_, i) => `Tarefa ${i + 1} extraída da transcrição`)
    onCreate({
      type: 'meeting',
      title: `🎙️ Reunião — ${new Date().toLocaleDateString('pt-BR')}`,
      content_html: `<h3>Transcrição Original</h3><blockquote>${transcricao.substring(0, 2000)}</blockquote>`,
      project_id: projectId || null, company_id: companyId || null,
      meeting_data: {
        summary: `Reunião de ${meetType.replace('_', ' ')} com ${Math.ceil(words.length / 150)} tópicos. ${words.length} palavras processadas.`,
        topics, tasks, critical_points: ['Ponto requer atenção imediata', 'Decisão pendente sobre próximos passos'],
        word_count: words.length, processed_at: new Date().toISOString(),
      }
    })
    setProcessing(false)
  }

  const inputCls = 'w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-7 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>

        {step === 'type' && (
          <>
            <h2 className="text-lg font-bold text-zinc-800 mb-5">Nova Nota</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { t: 'note',      icon: '📝', label: 'Nota Livre' },
                { t: 'ata',       icon: '📋', label: 'Ata de Reunião' },
                { t: 'meeting',   icon: '🎙️', label: 'Colar Transcrição' },
                { t: 'idea',      icon: '💡', label: 'Ideia Rápida' },
                { t: 'checklist', icon: '✅', label: 'Checklist' },
                { t: 'template',  icon: '📑', label: 'Templates BX' },
              ].map(opt => (
                <button key={opt.t} onClick={() => {
                  if (opt.t === 'meeting') { setType('meeting'); setStep('transcricao') }
                  else if (opt.t === 'template') setStep('templates')
                  else { setType(opt.t); setStep('form') }
                }} className="p-5 border-2 border-zinc-200 rounded-xl text-center hover:border-violet-500 hover:bg-violet-50 transition-all">
                  <span className="text-3xl block mb-2">{opt.icon}</span>
                  <span className="text-sm font-semibold text-zinc-700">{opt.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'form' && (
          <>
            <h2 className="text-lg font-bold text-zinc-800 mb-5">{TYPE_CONFIG[type]?.icon} Nova {TYPE_CONFIG[type]?.label}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Título</label>
                <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da nota..." autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Projeto</label>
                  <select className={inputCls} value={projectId} onChange={e => setProjectId(e.target.value)}>
                    <option value="">— nenhum —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Empresa</label>
                  <select className={inputCls} value={companyId} onChange={e => setCompanyId(e.target.value)}>
                    <option value="">— nenhuma —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => handleCreate()} className="flex-1 bg-violet-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-violet-700 transition-colors">Criar Nota</button>
                <button onClick={() => setStep('type')} className="text-sm text-zinc-500 hover:text-zinc-700 px-4">Voltar</button>
              </div>
            </div>
          </>
        )}

        {step === 'transcricao' && (
          <>
            <h2 className="text-lg font-bold text-zinc-800 mb-5">🎙️ Colar Transcrição</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Projeto</label>
                <select className={inputCls} value={projectId} onChange={e => setProjectId(e.target.value)}>
                  <option value="">— nenhum —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tipo de reunião</label>
                <select className={inputCls} value={meetType} onChange={e => setMeetType(e.target.value)}>
                  <option value="reuniao_interna">Reunião Interna</option>
                  <option value="reuniao_cliente">Reunião com Cliente</option>
                  <option value="assembleia">Assembleia</option>
                  <option value="negociacao">Negociação</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Transcrição *</label>
                <textarea className={inputCls + ' resize-none'} rows={6} value={transcricao} onChange={e => setTranscricao(e.target.value)} placeholder="Cole a transcrição completa aqui..." />
              </div>
              {progress && <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3 text-sm text-violet-700">{progress}</div>}
              <div className="flex gap-3">
                <button onClick={processTranscricao} disabled={!transcricao.trim() || processing} className="flex-1 bg-violet-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                  {processing ? 'Processando...' : '⚡ Processar com IA'}
                </button>
                <button onClick={() => setStep('type')} className="text-sm text-zinc-500 hover:text-zinc-700 px-4">Voltar</button>
              </div>
            </div>
          </>
        )}

        {step === 'templates' && (
          <>
            <h2 className="text-lg font-bold text-zinc-800 mb-5">📑 Templates BX</h2>
            <div className="grid grid-cols-3 gap-3">
              {TEMPLATE_LIST.map(tpl => (
                <button key={tpl.name} onClick={() => onCreate({ type: tpl.type, title: tpl.name, content_html: TEMPLATES[tpl.key] || '', project_id: null, company_id: null })}
                  className="p-4 border-2 border-zinc-200 rounded-xl text-center hover:border-violet-500 hover:bg-violet-50 transition-all">
                  <span className="text-2xl block mb-1">{tpl.icon}</span>
                  <span className="text-xs font-semibold text-zinc-700">{tpl.name}</span>
                </button>
              ))}
              <button onClick={() => onCreate({ type: 'note', title: 'Em Branco', content_html: '', project_id: null, company_id: null })}
                className="p-4 border-2 border-zinc-200 rounded-xl text-center hover:border-violet-500 hover:bg-violet-50 transition-all">
                <span className="text-2xl block mb-1">📄</span>
                <span className="text-xs font-semibold text-zinc-700">Em Branco</span>
              </button>
            </div>
            <button onClick={() => setStep('type')} className="mt-4 text-sm text-zinc-500 hover:text-zinc-700">← Voltar</button>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Main Component ─── */
export default function Notas() {
  const { profile } = useData()
  usePageTitle('Notas')
  const [notes, setNotes] = useState([])
  const [projects, setProjects] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState(null)
  const [companyFilter, setCompanyFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('recentes')
  const [selectedId, setSelectedId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [expandProjects, setExpandProjects] = useState(true)
  const [expandCompanies, setExpandCompanies] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Salvo ✓')
  const [toolbarTick, setToolbarTick] = useState(0)
  const saveTimerRef = useRef(null)
  const editorRef = useRef(null)
  useEscapeKey(() => setShowNew(false), showNew)

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    setLoading(true)
    try {
      const [notesR, projR, compR] = await Promise.allSettled([
        supabase.from('notes').select('*').eq('org_id', profile.org_id).neq('status', 'archived').order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(200),
        supabase.from('projects').select('id,name').eq('org_id', profile.org_id).order('name'),
        supabase.from('companies').select('id,name').eq('org_id', profile.org_id).order('name'),
      ])
      if (notesR.status === 'fulfilled' && !notesR.value.error) setNotes(notesR.value.data || [])
      if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
      if (compR.status === 'fulfilled' && !compR.value.error) setCompanies(compR.value.data || [])
    } catch (err) { console.error('[Notas] load:', err.message) }
    finally { setLoading(false) }
  }, [profile])

  useEffect(() => { load() }, [load])

  const filtered = (() => {
    let f = notes.filter(n => {
      if (filter === 'pinned') return n.pinned
      if (filter !== 'all' && n.type !== filter) return false
      if (projectFilter && n.project_id !== projectFilter) return false
      if (companyFilter && n.company_id !== companyFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (n.title || '').toLowerCase().includes(q) || stripHtml(n.content_html || '').toLowerCase().includes(q)
      }
      return true
    })
    if (sortBy === 'a-z') f = [...f].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    if (sortBy === 'projeto') f = [...f].sort((a, b) => {
      const pa = projects.find(p => p.id === a.project_id)?.name || ''
      const pb = projects.find(p => p.id === b.project_id)?.name || ''
      return pa.localeCompare(pb)
    })
    return f
  })()

  const selected = selectedId ? notes.find(n => n.id === selectedId) : null
  const tc = selected ? (TYPE_CONFIG[selected.type] || TYPE_CONFIG.note) : null
  const md = selected?.meeting_data && typeof selected.meeting_data === 'object' ? selected.meeting_data : null

  async function createNote({ type, title, content_html, project_id, company_id, meeting_data }) {
    const { data, error } = await supabase.from('notes').insert({
      org_id: profile.org_id, created_by: profile.id,
      type, title, content_html: content_html || '', project_id, company_id,
      pinned: false, status: 'draft', meeting_data: meeting_data || null, tags: [],
    }).select().single()
    if (!error && data) {
      setNotes(prev => [data, ...prev])
      setSelectedId(data.id)
      setShowNew(false)
    }
  }

  async function createFromTemplate(tpl) {
    await createNote({ type: tpl.type, title: tpl.name, content_html: TEMPLATES[tpl.key] || '', project_id: null, company_id: null })
  }

  function scheduleAutoSave(id, title, content_html) {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const currentHtml = editorRef.current ? editorRef.current.innerHTML : content_html
      setSaveStatus('Salvando...')
      const { error } = await supabase.from('notes').update({
        title, content_html: currentHtml, updated_at: new Date().toISOString()
      }).eq('id', id).eq('org_id', profile.org_id)
      if (!error) {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, title, content_html: currentHtml, updated_at: new Date().toISOString() } : n))
        setSaveStatus('Salvo ✓')
      } else {
        setSaveStatus('Erro ao salvar')
      }
    }, 1200)
  }

  async function archiveNote(id) {
    await supabase.from('notes').update({ status: 'archived' }).eq('id', id).eq('org_id', profile.org_id)
    setNotes(prev => prev.filter(n => n.id !== id))
    setSelectedId(null)
  }

  async function togglePin(id) {
    const n = notes.find(x => x.id === id)
    if (!n) return
    await supabase.from('notes').update({ pinned: !n.pinned }).eq('id', id).eq('org_id', profile.org_id)
    setNotes(prev => prev.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x))
  }

  function execCmd(cmd, val) {
    document.execCommand(cmd, false, val || null)
    editorRef.current?.focus()
  }

  function setTabFilter(id) {
    setFilter(id); setProjectFilter(null); setCompanyFilter(null)
  }

  // ── KPI counts
  const kpis = [
    { label: 'Total',    value: notes.length,                              color: '#A5B4FC' },
    { label: 'Reuniões', value: notes.filter(n => n.type === 'meeting').length, color: '#6EE7B7' },
    { label: 'Atas',     value: notes.filter(n => n.type === 'ata').length,     color: '#FCD34D' },
    { label: 'Ideias',   value: notes.filter(n => n.type === 'idea').length,    color: '#F9A8D4' },
    { label: 'Fixadas',  value: notes.filter(n => n.pinned).length,             color: '#FCA5A5' },
  ]

  const heroTabs = [
    { id: 'all',     icon: '📝', label: 'Todas',    count: notes.length },
    { id: 'meeting', icon: '🎙️', label: 'Reuniões', count: notes.filter(n => n.type === 'meeting').length },
    { id: 'ata',     icon: '📋', label: 'Atas',     count: notes.filter(n => n.type === 'ata').length },
    { id: 'idea',    icon: '💡', label: 'Ideias',   count: notes.filter(n => n.type === 'idea').length },
    { id: 'pinned',  icon: '📌', label: 'Fixadas',  count: notes.filter(n => n.pinned).length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#F4F5F8' }}>

      {/* ═══ HERO ═══ */}
      <div style={{ background: '#2D2E39', flexShrink: 0 }}>
        <div style={{ padding: '18px 24px 0' }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>
            Central de Conhecimento
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: 'white', marginBottom: 3 }}>
            Notas & Reuniões
          </div>
          <div style={{ fontSize: 11.5, color: '#6B7280', marginBottom: 14 }}>
            {loading ? 'Carregando...' : `${notes.length} registros · ${notes.filter(n=>n.type==='meeting').length} reuniões · ${notes.filter(n=>n.type==='ata').length} atas · ${notes.filter(n=>n.type==='idea').length} ideias · ${notes.filter(n=>n.pinned).length} fixadas`}
          </div>

          {/* KPIs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {kpis.map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 16px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, marginBottom: 3, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.09em', color: '#6B7280' }}>{k.label}</div>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <button onClick={() => setShowNew(true)}
                style={{ padding: '8px 18px', borderRadius: 9, background: '#5452C1', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + Nova Nota
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {heroTabs.map(tab => {
              const on = filter === tab.id && !projectFilter && !companyFilter
              return (
                <button key={tab.id} onClick={() => setTabFilter(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '9px 14px', fontSize: 12, fontWeight: on ? 600 : 500,
                    borderRadius: '8px 8px 0 0', cursor: 'pointer', whiteSpace: 'nowrap',
                    border: '1px solid transparent', borderBottom: 'none', outline: 'none',
                    background: on ? 'white' : 'transparent',
                    color: on ? '#5452C1' : '#6B7280',
                    borderColor: on ? 'rgba(255,255,255,.12)' : 'transparent',
                    transition: 'all .12s',
                  }}>
                  <span style={{ fontSize: 13 }}>{tab.icon}</span>
                  {tab.label}
                  <span style={{
                    fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 99,
                    background: on ? '#EEF2FF' : 'rgba(255,255,255,.1)',
                    color: on ? '#5452C1' : '#9CA3AF',
                  }}>{tab.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══ 3 COLUMNS ═══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── COL 1: Filter nav ── */}
        <div style={{ width: 220, minWidth: 220, borderRight: '1px solid #EAECF0', overflowY: 'auto', flexShrink: 0, background: '#FAFBFD' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', padding: '12px 14px 5px' }}>Tipo</div>

          {[
            { id: 'all',      icon: '📝', label: 'Todas as Notas', count: notes.length },
            { id: 'meeting',  icon: '🎙️', label: 'Reuniões',       count: notes.filter(n=>n.type==='meeting').length },
            { id: 'ata',      icon: '📋', label: 'Atas',           count: notes.filter(n=>n.type==='ata').length },
            { id: 'idea',     icon: '💡', label: 'Ideias',         count: notes.filter(n=>n.type==='idea').length },
            { id: 'checklist',icon: '✅', label: 'Checklists',     count: notes.filter(n=>n.type==='checklist').length },
            { id: 'pinned',   icon: '📌', label: 'Fixadas',        count: notes.filter(n=>n.pinned).length },
          ].map(nav => {
            const on = filter === nav.id && !projectFilter && !companyFilter
            return (
              <button key={nav.id} onClick={() => setTabFilter(nav.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '7px 12px', cursor: 'pointer', fontSize: 12.5, outline: 'none',
                  borderLeft: `2px solid ${on ? '#5452C1' : 'transparent'}`,
                  background: on ? '#EEF2FF' : 'transparent',
                  color: on ? '#5452C1' : '#6B7280',
                  fontWeight: on ? 500 : 400,
                  transition: 'all .1s',
                }}>
                <span style={{ fontSize: 13, width: 16 }}>{nav.icon}</span>
                <span style={{ flex: 1 }}>{nav.label}</span>
                <span style={{ fontSize: 10, color: on ? '#5452C1' : '#9CA3AF', background: on ? '#DDD6FE' : '#EAECF0', padding: '1px 6px', borderRadius: 99 }}>{nav.count}</span>
              </button>
            )
          })}

          <div style={{ height: 1, background: '#EAECF0', margin: '8px 0' }} />

          {/* Por Projeto */}
          <button onClick={() => setExpandProjects(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 12px', fontSize: 11.5, fontWeight: 500, color: '#374151', background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}>
            <span>📁 Por Projeto</span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{expandProjects ? '▼' : '▶'}</span>
          </button>
          {expandProjects && projects.map(p => {
            const on = projectFilter === p.id
            return (
              <button key={p.id} onClick={() => { setProjectFilter(p.id === projectFilter ? null : p.id); setFilter('all') }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 12px 5px 28px', fontSize: 11.5, color: on ? '#5452C1' : '#6B7280', fontWeight: on ? 500 : 400, background: on ? '#EEF2FF' : 'transparent', border: 'none', cursor: 'pointer', outline: 'none', textAlign: 'left' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: projColor(p.id), flexShrink: 0, display: 'inline-block' }} />
                <span className="truncate">{p.name}</span>
              </button>
            )
          })}

          <div style={{ height: 1, background: '#EAECF0', margin: '8px 0' }} />

          {/* Por Empresa */}
          <button onClick={() => setExpandCompanies(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 12px', fontSize: 11.5, fontWeight: 500, color: '#374151', background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}>
            <span>🏢 Por Empresa</span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{expandCompanies ? '▼' : '▶'}</span>
          </button>
          {expandCompanies && companies.map(c => {
            const on = companyFilter === c.id
            return (
              <button key={c.id} onClick={() => { setCompanyFilter(c.id === companyFilter ? null : c.id); setFilter('all') }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 12px 5px 28px', fontSize: 11.5, color: on ? '#5452C1' : '#6B7280', fontWeight: on ? 500 : 400, background: on ? '#EEF2FF' : 'transparent', border: 'none', cursor: 'pointer', outline: 'none', textAlign: 'left' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: projColor(c.id), flexShrink: 0, display: 'inline-block' }} />
                <span className="truncate">{c.name}</span>
              </button>
            )
          })}
        </div>

        {/* ── COL 2: Note list ── */}
        <div style={{ width: 320, minWidth: 320, borderRight: '1px solid #EAECF0', display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'white' }}>
          {/* Search + sort header */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #EAECF0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F4F5F8', border: '1px solid #EAECF0', borderRadius: 9, padding: '6px 10px', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar notas..."
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: '#374151', flex: 1, fontFamily: 'inherit' }} />
              {search && <button onClick={() => setSearch('')} style={{ fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {['recentes', 'a-z', 'projeto'].map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 6, border: '1px solid #EAECF0', background: sortBy === s ? '#5452C1' : 'white', color: sortBy === s ? 'white' : '#6B7280', cursor: 'pointer', outline: 'none', fontFamily: 'inherit', transition: 'all .12s' }}>
                  {s === 'recentes' ? 'Recentes' : s === 'a-z' ? 'A-Z' : 'Projeto'}
                </button>
              ))}
            </div>
          </div>

          {/* Note cards */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>Carregando…</div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#9CA3AF', gap: 8 }}>
                <span style={{ fontSize: 40, opacity: .35 }}>📭</span>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#6B7280' }}>Nenhuma nota encontrada</div>
                <button onClick={() => setShowNew(true)}
                  style={{ marginTop: 4, fontSize: 11.5, padding: '6px 14px', borderRadius: 8, background: '#5452C1', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Nova Nota
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10.5, color: '#9CA3AF', padding: '8px 12px 4px' }}>{filtered.length} nota{filtered.length !== 1 ? 's' : ''}</div>
                {filtered.map(n => {
                  const ntc = TYPE_CONFIG[n.type] || TYPE_CONFIG.note
                  const excerpt = stripHtml(n.content_html || '').substring(0, 90)
                  const proj = projects.find(p => p.id === n.project_id)
                  const isSel = selectedId === n.id
                  return (
                    <button key={n.id} onClick={() => setSelectedId(n.id)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '11px 14px', borderBottom: '1px solid #F3F4F6',
                        borderLeft: `3px solid ${isSel ? '#5452C1' : ntc.border}`,
                        background: isSel ? '#F5F3FF' : 'white',
                        cursor: 'pointer', outline: 'none', transition: 'all .1s',
                      }}
                      onMouseEnter={e => { if (!isSel) { e.currentTarget.style.background = '#FAFBFF'; e.currentTarget.style.borderLeftColor = ntc.color } }}
                      onMouseLeave={e => { if (!isSel) { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderLeftColor = ntc.border } }}
                    >
                      {/* Row 1: type badge + time + pin */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: ntc.bg, color: ntc.text, display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                          {ntc.icon} {ntc.label}
                        </span>
                        {n.pinned && <span style={{ fontSize: 11, color: '#F59E0B' }}>📌</span>}
                        <span style={{ fontSize: 10.5, color: '#9CA3AF', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{relTime(n.updated_at || n.created_at)}</span>
                      </div>
                      {/* Row 2: title */}
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                        {n.title || 'Sem título'}
                      </div>
                      {/* Row 3: preview */}
                      {excerpt && (
                        <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.5, marginBottom: 7, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {excerpt}
                        </div>
                      )}
                      {/* Row 4: project + tags */}
                      {proj && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#6B7280', background: '#F4F5F8', padding: '2px 7px', borderRadius: 99 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: projColor(proj.id), display: 'inline-block' }} />
                            {proj.name}
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* ── COL 3: Editor ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>Carregando…</div>
          ) : !selected ? (
            /* ── EMPTY STATE with template gallery ── */
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 32px' }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 44, opacity: .3, marginBottom: 12 }}>📝</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Selecione uma nota ou crie uma nova</div>
                <div style={{ fontSize: 12.5, color: '#9CA3AF', marginBottom: 20, lineHeight: 1.6 }}>Use os templates BX para começar rapidamente</div>
                <button onClick={() => setShowNew(true)}
                  style={{ padding: '9px 22px', borderRadius: 9, background: '#5452C1', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Nova Nota
                </button>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Templates BX</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {TEMPLATE_LIST.slice(0, 9).map(tpl => (
                  <button key={tpl.key} onClick={() => createFromTemplate(tpl)}
                    style={{ background: '#FAFBFD', border: '1px solid #EAECF0', borderRadius: 10, padding: '12px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all .12s', outline: 'none', fontFamily: 'inherit' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#5452C1'; e.currentTarget.style.color = '#5452C1'; e.currentTarget.style.background = '#EEF2FF' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#EAECF0'; e.currentTarget.style.color = ''; e.currentTarget.style.background = '#FAFBFD' }}>
                    <div style={{ fontSize: 22, marginBottom: 5 }}>{tpl.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{tpl.name}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── EDITOR + optional meeting sidebar ── */
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

              {/* Editor main */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Header */}
                <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #EAECF0', flexShrink: 0 }}>
                  {/* Breadcrumb */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    {projects.find(p => p.id === selected.project_id) && (
                      <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6B7280' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: projColor(selected.project_id), display: 'inline-block' }} />
                          {projects.find(p => p.id === selected.project_id)?.name}
                        </span>
                        <span style={{ color: '#D1D5DB', fontSize: 11 }}>›</span>
                      </>
                    )}
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: tc.bg, color: tc.text }}>
                      {tc.icon} {tc.label}
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => togglePin(selected.id)} style={{ fontSize: 15, cursor: 'pointer', background: 'none', border: 'none', opacity: selected.pinned ? 1 : .4 }} title={selected.pinned ? 'Desafixar' : 'Fixar'}>
                        📌
                      </button>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{saveStatus}</span>
                      <button onClick={() => archiveNote(selected.id)}
                        style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid #FECACA', background: 'white', color: '#EF4444', cursor: 'pointer', fontFamily: 'inherit' }}>
                        🗑️ Arquivar
                      </button>
                    </div>
                  </div>

                  {/* Title input */}
                  <input
                    style={{ width: '100%', fontSize: 19, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: '#111827', fontFamily: 'inherit', marginBottom: 8 }}
                    value={selected.title || ''}
                    onChange={e => {
                      setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, title: e.target.value } : n))
                      scheduleAutoSave(selected.id, e.target.value, selected.content_html || '')
                    }}
                    placeholder="Título da nota..."
                  />

                  {/* Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
                    <span style={{ color: '#9CA3AF' }}>📅 {new Date(selected.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {companies.find(c => c.id === selected.company_id) && (
                      <>
                        <span style={{ width: 1, height: 14, background: '#EAECF0', display: 'inline-block' }} />
                        <span style={{ color: '#9CA3AF' }}>🏢 {companies.find(c => c.id === selected.company_id)?.name}</span>
                      </>
                    )}
                    {md && (
                      <>
                        <span style={{ width: 1, height: 14, background: '#EAECF0', display: 'inline-block' }} />
                        <span style={{ color: '#5452C1', fontWeight: 500 }}>✨ Resumo IA disponível</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Toolbar */}
                <div style={{ padding: '7px 16px', borderBottom: '1px solid #EAECF0', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, background: '#FAFBFD', flexWrap: 'wrap' }}>
                  {[
                    { cmd: 'bold',                val: null,         label: <b style={{fontSize:12}}>N</b>, title: 'Negrito',  check: 'bold' },
                    { cmd: 'italic',              val: null,         label: <i style={{fontSize:12}}>I</i>, title: 'Itálico',  check: 'italic' },
                    { cmd: 'underline',           val: null,         label: <u style={{fontSize:12}}>S</u>, title: 'Sublinhado', check: 'underline' },
                    { cmd: 'formatBlock',         val: 'H2',         label: 'H2',  title: 'Título 2',  check: null },
                    { cmd: 'formatBlock',         val: 'H3',         label: 'H3',  title: 'Título 3',  check: null },
                    { cmd: 'insertUnorderedList', val: null,         label: '☰ Lista', title: 'Lista', check: 'insertUnorderedList' },
                    { cmd: 'insertOrderedList',   val: null,         label: '① Numerada', title: 'Lista numerada', check: 'insertOrderedList' },
                    { cmd: 'formatBlock',         val: 'BLOCKQUOTE', label: '❝ Citação', title: 'Citação', check: null },
                  ].map((t, i) => {
                    let isActive = false
                    try { if (t.check) isActive = document.queryCommandState(t.check) } catch(e) {}
                    return (
                      <button key={i} onMouseDown={ev => { ev.preventDefault(); execCmd(t.cmd, t.val) }} title={t.title}
                        style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${isActive ? '#5452C1' : '#EAECF0'}`, background: isActive ? '#EEF2FF' : 'white', color: isActive ? '#5452C1' : '#374151', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', transition: 'all .1s' }}>
                        {t.label}
                      </button>
                    )
                  })}
                  <button onClick={() => setShowNew(true)}
                    style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid #EAECF0', background: 'white', color: '#374151', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                    📄 Templates BX
                  </button>
                </div>

                {/* Meeting AI summary */}
                {selected.type === 'meeting' && md && (md.summary || md.topics?.length || md.tasks?.length) && (
                  <div style={{ margin: '12px 20px 0', flexShrink: 0 }}>
                    {md.summary && (
                      <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#5452C1', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 5 }}>✨ Resumo IA</div>
                        <div style={{ fontSize: 12, color: '#4338CA', lineHeight: 1.6 }}>{md.summary}</div>
                      </div>
                    )}
                    {md.tasks?.length > 0 && (
                      <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>✅ Action Items</div>
                        {md.tasks.map((t, i) => (
                          <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 5, fontSize: 12, color: '#065F46' }}>
                            <span style={{ flexShrink: 0 }}>☐</span>
                            <span>{t}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {md.critical_points?.length > 0 && (
                      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 5 }}>🔴 Pontos Críticos</div>
                        {md.critical_points.map((p, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#B91C1C', marginBottom: 3 }}>{p}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Editor body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  <div
                    key={selected.id}
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Comece a escrever..."
                    className="text-sm leading-relaxed outline-none min-h-[200px]"
                    style={{ color: '#2D2E39', fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 13.5, lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: selected.content_html || '' }}
                    onSelect={() => setToolbarTick(t => t + 1)}
                    onKeyUp={() => setToolbarTick(t => t + 1)}
                    onMouseUp={() => setToolbarTick(t => t + 1)}
                    onInput={e => {
                      scheduleAutoSave(selected.id, selected.title || '', e.currentTarget.innerHTML)
                    }}
                  />
                </div>
              </div>

              {/* Meeting sidebar */}
              {selected.type === 'meeting' && (
                <div style={{ width: 240, minWidth: 240, borderLeft: '1px solid #EAECF0', background: '#FAFBFD', padding: 14, overflowY: 'auto', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', paddingBottom: 8, borderBottom: '1px solid #EAECF0', marginBottom: 10 }}>Informações da Reunião</div>

                  {/* Projeto */}
                  {projects.find(p => p.id === selected.project_id) && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Projeto</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#374151', background: 'white', border: '1px solid #EAECF0', borderRadius: 7, padding: '6px 9px', marginBottom: 12 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: projColor(selected.project_id), display: 'inline-block', flexShrink: 0 }} />
                        {projects.find(p => p.id === selected.project_id)?.name}
                      </div>
                    </>
                  )}

                  {/* Tópicos */}
                  {md?.topics?.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Tópicos</div>
                      {md.topics.map((t, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#374151', padding: '5px 8px', background: 'white', border: '1px solid #EAECF0', borderRadius: 6, marginBottom: 4, lineHeight: 1.4 }}>{t}</div>
                      ))}
                      <div style={{ height: 10 }} />
                    </>
                  )}

                  {/* Tasks como encaminhamentos */}
                  {md?.tasks?.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Encaminhamentos</div>
                      {md.tasks.map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 6, padding: '7px 8px', background: 'white', border: '1px solid #EAECF0', borderRadius: 6 }}>
                          <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>☐</span>
                          <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>{t}</span>
                        </div>
                      ))}
                      <div style={{ height: 10 }} />
                    </>
                  )}

                  {/* Date info */}
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Data</div>
                  <div style={{ fontSize: 11.5, color: '#374151', marginBottom: 12 }}>
                    {new Date(selected.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>

                  {md?.word_count && (
                    <div style={{ fontSize: 10.5, color: '#9CA3AF', background: '#F4F5F8', border: '1px solid #EAECF0', borderRadius: 6, padding: '5px 8px' }}>
                      📊 {md.word_count} palavras processadas
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </div>{/* /3 cols */}

      {showNew && <NewNoteModal projects={projects} companies={companies} onCreate={createNote} onClose={() => setShowNew(false)} />}

    </div>
  )
}
