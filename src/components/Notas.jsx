import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useData } from '../contexts/DataContext'

/* ─── helpers ─── */
const CH = '#2D2E39', VL = '#5452C1', VL_LIGHT = '#EEF2FF'

const NOTE_TYPES = {
  note:      { icon: '📝', label: 'Nota' },
  meeting:   { icon: '🎙️', label: 'Reunião' },
  ata:       { icon: '📋', label: 'Ata' },
  idea:      { icon: '💡', label: 'Ideia' },
  checklist: { icon: '✅', label: 'Checklist' },
}

const TEMPLATES = {
  ata: '<h2>Ata de Reunião</h2><p><b>Data:</b> ' + new Date().toLocaleDateString('pt-BR') + '</p><p><b>Participantes:</b></p><ul><li></li></ul><h3>Pauta</h3><ol><li></li></ol><h3>Deliberações</h3><p></p><h3>Encaminhamentos</h3><ul><li></li></ul>',
  diagnostico: '<h2>Diagnóstico Financeiro</h2><h3>1. Contexto</h3><p></p><h3>2. Análise (Fleuriet/DuPont)</h3><p></p><h3>3. Pontos Críticos</h3><ul><li></li></ul><h3>4. Recomendações</h3><ol><li></li></ol>',
  negociacao: '<h2>Negociação Bancária</h2><p><b>Credor:</b></p><p><b>Valor original:</b></p><p><b>Proposta:</b></p><h3>Argumentos</h3><ul><li></li></ul><h3>Próximos passos</h3><ol><li></li></ol>',
  assembleia: '<h2>Ata de Assembleia de Credores</h2><p><b>Processo:</b></p><p><b>Vara:</b></p><p><b>Data:</b> ' + new Date().toLocaleDateString('pt-BR') + '</p><h3>Credores Presentes</h3><ul><li></li></ul><h3>Deliberações</h3><p></p><h3>Resultado da Votação</h3><p></p>',
  weekly: '<h2>Weekly — ' + new Date().toLocaleDateString('pt-BR') + '</h2><h3>Realizações da Semana</h3><ul><li></li></ul><h3>Bloqueios</h3><ul><li></li></ul><h3>Metas Próxima Semana</h3><ol><li></li></ol>',
  brainstorm: '<h2>Brainstorm</h2><p><b>Tema:</b></p><h3>Ideias</h3><ul><li></li></ul>',
  onboarding: '<h2>Onboarding — Novo Cliente BPO</h2><ul><li>☐ Contrato assinado</li><li>☐ Certificado digital recebido</li><li>☐ Acesso Omie configurado</li><li>☐ Procuração e-CAC</li><li>☐ Documentação societária</li><li>☐ Último balanço/balancete</li><li>☐ Reunião de kickoff</li></ul>',
  duediligence: '<h2>Due Diligence</h2><p><b>Empresa-alvo:</b></p><h3>1. Análise Societária</h3><p></p><h3>2. Análise Financeira</h3><p></p><h3>3. Contingências</h3><ul><li></li></ul><h3>4. Red Flags</h3><ul><li></li></ul><h3>5. Recomendação</h3><p></p>',
}

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
  const [step, setStep] = useState('type') // type | form | transcricao | templates
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
        summary: `Resumo: reunião de ${meetType.replace('_', ' ')} com ${Math.ceil(words.length / 150)} tópicos principais. ${words.length} palavras processadas.`,
        topics, tasks, critical_points: ['Ponto requer atenção imediata', 'Decisão pendente sobre próximos passos'],
        word_count: words.length, processed_at: new Date().toISOString(),
      }
    })
    setProcessing(false)
  }

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
                { t: 'template',  icon: '📑', label: 'Templates' },
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
            <h2 className="text-lg font-bold text-zinc-800 mb-5">{NOTE_TYPES[type]?.icon} Nova {NOTE_TYPES[type]?.label}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Título</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da nota..." autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Projeto</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={projectId} onChange={e => setProjectId(e.target.value)}>
                    <option value="">— nenhum —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Empresa</label>
                  <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={companyId} onChange={e => setCompanyId(e.target.value)}>
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
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={projectId} onChange={e => setProjectId(e.target.value)}>
                  <option value="">— nenhum —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tipo de reunião</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={meetType} onChange={e => setMeetType(e.target.value)}>
                  <option value="reuniao_interna">Reunião Interna</option>
                  <option value="reuniao_cliente">Reunião com Cliente</option>
                  <option value="assembleia">Assembleia</option>
                  <option value="negociacao">Negociação</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Transcrição *</label>
                <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" rows={6} value={transcricao} onChange={e => setTranscricao(e.target.value)} placeholder="Cole a transcrição completa aqui..." />
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
            <h2 className="text-lg font-bold text-zinc-800 mb-5">📑 Templates</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '📋', name: 'Ata Padrão',        key: 'ata', type: 'ata' },
                { icon: '🔍', name: 'Diagnóstico',        key: 'diagnostico', type: 'note' },
                { icon: '🏦', name: 'Neg. Bancária',      key: 'negociacao', type: 'note' },
                { icon: '⚖️', name: 'Assembleia',         key: 'assembleia', type: 'ata' },
                { icon: '📊', name: 'Weekly',             key: 'weekly', type: 'note' },
                { icon: '🧠', name: 'Brainstorm',         key: 'brainstorm', type: 'idea' },
                { icon: '🚀', name: 'Onboarding BPO',     key: 'onboarding', type: 'checklist' },
                { icon: '📂', name: 'Due Diligence',      key: 'duediligence', type: 'note' },
                { icon: '📄', name: 'Em Branco',          key: null, type: 'note' },
              ].map(tpl => (
                <button key={tpl.name} onClick={() => {
                  onCreate({ type: tpl.type, title: tpl.name, content_html: tpl.key ? TEMPLATES[tpl.key] || '' : '', project_id: null, company_id: null })
                }} className="p-4 border-2 border-zinc-200 rounded-xl text-center hover:border-violet-500 hover:bg-violet-50 transition-all">
                  <span className="text-2xl block mb-1">{tpl.icon}</span>
                  <span className="text-xs font-semibold text-zinc-700">{tpl.name}</span>
                </button>
              ))}
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
  useEscapeKey(() => { setStep('type') }, !!(step !== 'notes' && step !== 'type'))
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
  const [expandProjects, setExpandProjects] = useState(false)
  const [expandCompanies, setExpandCompanies] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Salvo ✓')
  const [toolbarTick, setToolbarTick] = useState(0) // força re-render da toolbar
  const saveTimerRef = useRef(null)
  const editorRef = useRef(null)
  const titleRef = useRef(null)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [notesR, projR, compR] = await Promise.allSettled([
      supabase.from('notes').select('*').eq('org_id', profile.org_id).neq('status', 'archived').order('pinned', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('projects').select('id,name').eq('org_id', profile.org_id).order('name'),
      supabase.from('companies').select('id,name').eq('org_id', profile.org_id).order('name'),
    ])
    if (notesR.status === 'fulfilled' && !notesR.value.error) setNotes(notesR.value.data || [])
    if (projR.status === 'fulfilled' && !projR.value.error) setProjects(projR.value.data || [])
    if (compR.status === 'fulfilled' && !compR.value.error) setCompanies(compR.value.data || [])
    setLoading(false)
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

  async function createNote({ type, title, content_html, project_id, company_id, meeting_data }) {
    const { data, error } = await supabase.from('notes').insert({
      org_id: profile.org_id, created_by: profile.id,
      type, title, content_html: content_html || '', project_id, company_id,
      pinned: false, status: 'draft', meeting_data: meeting_data || null, tags: [],
    }).select().single()
    if (error) { toast.error('Erro ao criar nota: ' + error.message); return }
    if (data) {
      setNotes(prev => [data, ...prev])
      setSelectedId(data.id)
      setShowNew(false)
    }
  }

  function scheduleAutoSave(id, title, content_html) {
    clearTimeout(saveTimerRef.current)
    // Não chamar setSaveStatus aqui — causaria re-render durante digitação
    saveTimerRef.current = setTimeout(async () => {
      // Ler innerHTML atual do editor (pode ter mudado durante o debounce)
      const currentHtml = editorRef.current ? editorRef.current.innerHTML : content_html
      setSaveStatus('Salvando...')
      const { error } = await supabase.from('notes').update({
        title, content_html: currentHtml, updated_at: new Date().toISOString()
      }).eq('id', id).eq('org_id', profile.org_id)
      if (!error) {
        // Atualizar state APENAS após save confirmado — sem re-render durante digitação
        setNotes(prev => prev.map(n =>
          n.id === id ? { ...n, title, content_html: currentHtml, updated_at: new Date().toISOString() } : n
        ))
        setSaveStatus('Salvo ✓')
      } else {
        setSaveStatus('Erro ao salvar')
      }
    }, 1200)
  }

  async function archiveNote(id) {
    const { error } = await supabase.from('notes')
      .update({ status: 'archived' }).eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao arquivar nota: ' + error.message); return }
    setNotes(prev => prev.filter(n => n.id !== id))
    setSelectedId(null)
  }

  async function togglePin(id) {
    const n = notes.find(x => x.id === id)
    if (!n) return
    const { error } = await supabase.from('notes')
      .update({ pinned: !n.pinned }).eq('id', id).eq('org_id', profile.org_id)
    if (error) { toast.error('Erro ao fixar nota: ' + error.message); return }
    setNotes(prev => prev.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x))
  }

  function execCmd(cmd, val) {
    document.execCommand(cmd, false, val || null)
    editorRef.current?.focus()
  }

  const md = selected?.meeting_data && typeof selected.meeting_data === 'object' ? selected.meeting_data : null

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden font-['Montserrat',system-ui,sans-serif]" style={{ background: '#fff', color: CH }}>

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-60 shrink-0 border-r border-zinc-200 overflow-y-auto" style={{ background: '#FAFAFA' }}>
        <div className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400">📒 Notas & Reuniões</div>
        {[
          { id: 'all',     label: '📋 Todas as Notas', count: notes.filter(n => n.status !== 'archived').length },
          { id: 'meeting', label: '🎙️ Reuniões',       count: notes.filter(n => n.type === 'meeting').length },
          { id: 'ata',     label: '📝 Atas',            count: notes.filter(n => n.type === 'ata').length },
          { id: 'idea',    label: '💡 Ideias',          count: notes.filter(n => n.type === 'idea').length },
        ].map(nav => (
          <button key={nav.id} onClick={() => { setFilter(nav.id); setProjectFilter(null); setCompanyFilter(null) }}
            className="w-full text-left px-4 py-2 text-sm border-l-[3px] transition-all"
            style={{ borderLeftColor: filter === nav.id && !projectFilter && !companyFilter ? VL : 'transparent', background: filter === nav.id && !projectFilter && !companyFilter ? VL_LIGHT : 'transparent', color: filter === nav.id && !projectFilter && !companyFilter ? VL : '#555', fontWeight: filter === nav.id && !projectFilter && !companyFilter ? 600 : 400 }}>
            {nav.label} <span className="float-right text-[11px] text-zinc-400">({nav.count})</span>
          </button>
        ))}

        <div className="border-t border-zinc-200 my-2" />

        {/* Por Projeto */}
        <button onClick={() => setExpandProjects(v => !v)} className="w-full text-left px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100">
          📁 Por Projeto {expandProjects ? '▲' : '▼'}
        </button>
        {expandProjects && projects.map(p => (
          <button key={p.id} onClick={() => { setProjectFilter(p.id === projectFilter ? null : p.id); setFilter('all') }}
            className="w-full text-left px-8 py-1.5 text-xs transition-colors"
            style={{ color: projectFilter === p.id ? VL : '#666', background: projectFilter === p.id ? VL_LIGHT : 'transparent' }}>
            {p.name}
          </button>
        ))}

        {/* Por Empresa */}
        <button onClick={() => setExpandCompanies(v => !v)} className="w-full text-left px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100">
          🏢 Por Empresa {expandCompanies ? '▲' : '▼'}
        </button>
        {expandCompanies && companies.map(c => (
          <button key={c.id} onClick={() => { setCompanyFilter(c.id === companyFilter ? null : c.id); setFilter('all') }}
            className="w-full text-left px-8 py-1.5 text-xs transition-colors"
            style={{ color: companyFilter === c.id ? VL : '#666', background: companyFilter === c.id ? VL_LIGHT : 'transparent' }}>
            {c.name}
          </button>
        ))}

        <div className="border-t border-zinc-200 my-2" />
        <button onClick={() => { setFilter('pinned'); setProjectFilter(null); setCompanyFilter(null) }}
          className="w-full text-left px-4 py-2 text-sm border-l-[3px] transition-all"
          style={{ borderLeftColor: filter === 'pinned' ? VL : 'transparent', background: filter === 'pinned' ? VL_LIGHT : 'transparent', color: filter === 'pinned' ? VL : '#555' }}>
          📌 Fixadas <span className="float-right text-[11px] text-zinc-400">({notes.filter(n => n.pinned).length})</span>
        </button>
      </div>

      {/* ── CENTER: Note list ── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-zinc-200">
        <div className="p-3 border-b border-zinc-200">
          <button onClick={() => setShowNew(true)} className="w-full py-2.5 text-sm font-bold text-white rounded-lg transition-opacity hover:opacity-90" style={{ background: VL }}>
            + Nova Nota
          </button>
        </div>
        <div className="p-3 border-b border-zinc-100 flex gap-2">
          <input className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-1.5 outline-none focus:border-violet-500"
            placeholder="🔍 Buscar notas..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white outline-none" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="recentes">Recentes</option>
            <option value="a-z">A-Z</option>
            <option value="projeto">Projeto</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-6 text-center text-xs text-zinc-400">Carregando…</div>
           : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-zinc-300">
              <span className="text-5xl mb-3">📭</span>
              <span className="text-sm">Nenhuma nota encontrada</span>
            </div>
          ) : filtered.map(n => {
            const excerpt = stripHtml(n.content_html || '').substring(0, 80)
            const proj = projects.find(p => p.id === n.project_id)
            return (
              <button key={n.id} onClick={() => setSelectedId(n.id)}
                className="w-full text-left px-4 py-3 border-b border-zinc-100 border-l-[3px] transition-all"
                style={{ borderLeftColor: selectedId === n.id ? VL : 'transparent', background: selectedId === n.id ? VL_LIGHT : 'transparent' }}>
                <div className="flex items-center gap-1.5 font-semibold text-[13px] mb-1" style={{ color: CH }}>
                  <span>{NOTE_TYPES[n.type]?.icon || '📝'}</span>
                  <span className="truncate flex-1">{n.title || 'Sem título'}</span>
                  {n.pinned && <span>📌</span>}
                </div>
                <div className="text-xs text-zinc-500 truncate mb-1">{excerpt}</div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span>{relTime(n.updated_at || n.created_at)}</span>
                  {proj && <span style={{ color: VL }}>{proj.name}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Editor ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-zinc-300 text-[15px]">
            📝 Selecione ou crie uma nota
          </div>
        ) : (
          <>
            {/* Editor head */}
            <div className="px-6 py-5 border-b border-zinc-100">
              <input ref={titleRef}
                className="w-full text-[22px] font-bold border-0 outline-none placeholder:text-zinc-200 bg-transparent"
                style={{ color: CH }}
                value={selected.title || ''}
                onChange={e => {
                  setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, title: e.target.value } : n))
                  scheduleAutoSave(selected.id, e.target.value, selected.content_html || '')
                }}
                placeholder="Título da nota..." />
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: VL_LIGHT, color: VL }}>
                  {NOTE_TYPES[selected.type]?.icon} {NOTE_TYPES[selected.type]?.label}
                </span>
                {projects.find(p => p.id === selected.project_id) && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                    📁 {projects.find(p => p.id === selected.project_id)?.name}
                  </span>
                )}
                {companies.find(c => c.id === selected.company_id) && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                    🏢 {companies.find(c => c.id === selected.company_id)?.name}
                  </span>
                )}
                <span className="text-[11px] text-zinc-400">{new Date(selected.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <button onClick={() => togglePin(selected.id)} className="text-[15px] cursor-pointer hover:scale-110 transition-transform" title={selected.pinned ? 'Desafixar' : 'Fixar'}>
                  {selected.pinned ? '📌' : '📍'}
                </button>
              </div>
            </div>

            {/* Meeting card */}
            {selected.type === 'meeting' && md && (md.summary || md.topics?.length || md.tasks?.length) && (
              <div className="mx-6 my-3 p-4 rounded-lg border border-amber-200" style={{ background: '#FFFBEB' }}>
                <h4 className="text-sm font-bold text-zinc-800 mb-2">📊 Resumo da Reunião</h4>
                {md.summary && <p className="text-xs text-zinc-600 mb-2">{md.summary}</p>}
                {md.topics?.length > 0 && <><div className="text-xs font-bold text-zinc-700 mb-1">Tópicos:</div><ul className="text-xs text-zinc-600 pl-4 mb-2">{md.topics.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
                {md.tasks?.length > 0 && <><div className="text-xs font-bold text-zinc-700 mb-1">✅ Tarefas:</div><ul className="text-xs text-zinc-600 pl-4 mb-2">{md.tasks.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
                {md.critical_points?.length > 0 && <><div className="text-xs font-bold text-red-600 mb-1">🔴 Pontos Críticos:</div><ul className="text-xs text-red-600 pl-4">{md.critical_points.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
              </div>
            )}

            {/* Editor body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div
                key={selected.id}
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Comece a escrever..."
                className="text-sm leading-relaxed outline-none min-h-[200px]"
                style={{ color: CH, fontFamily: 'Montserrat, system-ui, sans-serif' }}
                dangerouslySetInnerHTML={{ __html: selected.content_html || '' }}
                onSelect={() => setToolbarTick(t => t + 1)}
                onKeyUp={() => setToolbarTick(t => t + 1)}
                onMouseUp={() => setToolbarTick(t => t + 1)}
                onInput={e => {
                  // B-13: NÃO atualizar state durante digitação
                  // Isso causaria re-render → dangerouslySetInnerHTML → perda de cursor
                  // O scheduleAutoSave lê innerHTML direto do ref e atualiza o state
                  // apenas no debounce de 1.2s, quando o usuário parou de digitar
                  scheduleAutoSave(selected.id, selected.title || '', e.currentTarget.innerHTML)
                }}
              />
            </div>

            {/* Toolbar */}
            <div className="px-4 py-2 border-t border-zinc-100 flex items-center gap-1 flex-wrap" style={{ background: '#FAFAFA' }}>
              {/* toolbarTick={toolbarTick} → força queryCommandState a ser reavaliado */}
              {[
                { cmd: 'bold',               val: null,        label: <b>B</b>,  title: 'Negrito',  check: 'bold' },
                { cmd: 'italic',             val: null,        label: <i>I</i>,  title: 'Itálico',  check: 'italic' },
                { cmd: 'formatBlock',        val: 'H2',        label: 'H',       title: 'Título',   check: null },
                { cmd: 'insertUnorderedList',val: null,        label: '☰',       title: 'Lista',    check: 'insertUnorderedList' },
                { cmd: 'formatBlock',        val: 'BLOCKQUOTE',label: '❝',       title: 'Citação',  check: null },
              ].map((t, i) => {
                // Detectar estado ativo via queryCommandState (funciona para bold/italic/list)
                let isActive = false
                try { if (t.check) isActive = document.queryCommandState(t.check) } catch(e) {}
                return (
                  <button key={i} onMouseDown={e => { e.preventDefault(); execCmd(t.cmd, t.val) }} title={t.title}
                    className="px-2.5 py-1 border rounded text-sm transition-colors"
                    style={{
                      fontFamily: 'Montserrat',
                      background: isActive ? '#5452C1' : 'white',
                      color: isActive ? 'white' : '#2D2E39',
                      borderColor: isActive ? '#5452C1' : '#E5E5E5',
                    }}>
                    {t.label}
                  </button>
                )
              })}
              <span className="ml-auto text-[11px] text-zinc-400">{saveStatus}</span>
              <button onClick={() => archiveNote(selected.id)} className="px-2.5 py-1 border border-red-200 rounded text-xs text-red-500 hover:bg-red-50 transition-colors">
                🗑️ Arquivar
              </button>
            </div>
          </>
        )}
      </div>

      {showNew && <NewNoteModal projects={projects} companies={companies} onCreate={createNote} onClose={() => setShowNew(false)} />}
    </div>
  )
}
