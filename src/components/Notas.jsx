import React, { useState, useEffect, useCallback } from 'react'
import { FileText, Plus, Search, X, Save, Trash2, Building2, FolderOpen, Clock, Edit3, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

const NOTE_TYPES = [
  { value: 'reuniao', label: 'Reunião', color: 'bg-violet-100 text-violet-700' },
  { value: 'decisao', label: 'Decisão', color: 'bg-amber-100 text-amber-700' },
  { value: 'analise', label: 'Análise', color: 'bg-blue-100 text-blue-700' },
  { value: 'ata', label: 'Ata', color: 'bg-green-100 text-green-700' },
  { value: 'geral', label: 'Geral', color: 'bg-zinc-100 text-zinc-600' },
]

const TEMPLATES = {
  reuniao: `# Reunião — [Data]\n\n**Participantes:** \n\n**Pauta:**\n- \n\n**Discussão:**\n\n\n**Decisões:**\n- \n\n**Próximos Passos:**\n- [ ] `,
  decisao: `# Decisão — [Tema]\n\n**Contexto:**\n\n\n**Opções Avaliadas:**\n1. \n2. \n\n**Decisão:**\n\n\n**Responsável:** \n**Prazo:** `,
  ata: `# Ata — [Data]\n\n**Empresa:** \n**Responsável BX:** \n\n**Resumo:**\n\n\n**Itens Discutidos:**\n1. \n\n**Pendências:**\n- [ ] `,
  analise: `# Análise — [Tema]\n\n**Objetivo:**\n\n\n**Dados Base:**\n\n\n**Conclusão:**\n\n\n**Recomendação:** `,
  geral: ``,
}

function TypeBadge({ type }) {
  const t = NOTE_TYPES.find(x => x.value === type) || NOTE_TYPES[4]
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${t.color}`}>{t.label}</span>
}

export default function Notas() {
  const { profile } = useData()
  const [notes, setNotes] = useState([])
  const [companies, setCompanies] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newNote, setNewNote] = useState({ title: '', content: '', type: 'geral', company_id: '', project_id: '' })

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const [notesRes, companiesRes, projectsRes] = await Promise.allSettled([
      supabase.from('notes').select('*').eq('org_id', profile.org_id).order('created_at', { ascending: false }),
      supabase.from('companies').select('id,name').eq('org_id', profile.org_id).order('name'),
      supabase.from('projects').select('id,name,company_id').eq('org_id', profile.org_id).order('name'),
    ])
    if (notesRes.status === 'fulfilled' && !notesRes.value.error) setNotes(notesRes.value.data || [])
    if (companiesRes.status === 'fulfilled' && !companiesRes.value.error) setCompanies(companiesRes.value.data || [])
    if (projectsRes.status === 'fulfilled' && !projectsRes.value.error) setProjects(projectsRes.value.data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  const filtered = notes.filter(n => {
    const matchSearch = !search || n.title?.toLowerCase().includes(search.toLowerCase()) || n.content?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || n.type === filterType
    const matchCompany = filterCompany === 'all' || n.company_id === filterCompany
    return matchSearch && matchType && matchCompany
  })

  async function saveNote() {
    if (!selected) return
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('notes').update({
      title: selected.title, content: selected.content,
      type: selected.type, company_id: selected.company_id || null, project_id: selected.project_id || null,
    }).eq('id', selected.id)
    if (err) { setError(err.message); setSaving(false); return }
    await load(); setEditing(false); setSaving(false)
  }

  async function deleteNote(id) {
    if (!window.confirm('Excluir esta nota?')) return
    await supabase.from('notes').delete().eq('id', id)
    setSelected(null); await load()
  }

  async function createNote() {
    if (!newNote.title.trim()) return
    setSaving(true)
    const content = newNote.content || TEMPLATES[newNote.type] || ''
    const { data, error: err } = await supabase.from('notes').insert({
      org_id: profile.org_id, title: newNote.title, content, type: newNote.type,
      company_id: newNote.company_id || null, project_id: newNote.project_id || null, created_by: profile.id,
    }).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    await load(); setSelected(data); setEditing(true)
    setShowNew(false); setNewNote({ title: '', content: '', type: 'geral', company_id: '', project_id: '' }); setSaving(false)
  }

  function fmtDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const companyName = (id) => companies.find(c => c.id === id)?.name || ''
  const projectName = (id) => projects.find(p => p.id === id)?.name || ''
  const filteredProjects = newNote.company_id ? projects.filter(p => p.company_id === newNote.company_id) : projects

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Documentação
            </div>
            <h1 className="text-2xl font-bold mb-1">Notas e Reuniões</h1>
            <p className="text-sm text-zinc-400">{notes.length} nota{notes.length !== 1 ? 's' : ''} registradas</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {NOTE_TYPES.map(t => (
              <div key={t.value} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[60px]">
                <div className="text-lg font-bold text-violet-300">{notes.filter(n => n.type === t.value).length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
        {/* LIST PANEL */}
        <div className="w-80 shrink-0 flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-zinc-100 space-y-2">
            <div className="flex items-center gap-2 bg-zinc-50 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input className="flex-1 text-sm bg-transparent outline-none placeholder:text-zinc-400" placeholder="Buscar notas…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')}><X className="w-3 h-3 text-zinc-400" /></button>}
            </div>
            <div className="flex gap-2">
              <select className="flex-1 text-xs border border-zinc-200 rounded-md px-2 py-1.5 bg-white" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="all">Todos os tipos</option>
                {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select className="flex-1 text-xs border border-zinc-200 rounded-md px-2 py-1.5 bg-white" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
                <option value="all">Todas empresas</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => setShowNew(true)} className="mx-3 mt-3 flex items-center gap-2 text-sm font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg px-3 py-2 transition-colors">
            <Plus className="w-4 h-4" /> Nova nota
          </button>
          <div className="flex-1 overflow-y-auto mt-2 pb-2">
            {loading ? (
              <div className="p-6 text-center text-xs text-zinc-400">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <div className="text-xs text-zinc-500">Nenhuma nota encontrada</div>
              </div>
            ) : filtered.map(n => (
              <button key={n.id} onClick={() => { setSelected(n); setEditing(false) }}
                className={`w-full text-left px-3 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors ${selected?.id === n.id ? 'bg-violet-50 border-l-2 border-l-violet-500' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-sm font-semibold text-zinc-800 truncate leading-tight">{n.title}</div>
                  <TypeBadge type={n.type} />
                </div>
                {n.company_id && <div className="text-xs text-zinc-500 flex items-center gap-1"><Building2 className="w-3 h-3" />{companyName(n.company_id)}</div>}
                {n.project_id && <div className="text-xs text-zinc-500 flex items-center gap-1"><FolderOpen className="w-3 h-3" />{projectName(n.project_id)}</div>}
                <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(n.created_at)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* DETAIL PANEL */}
        <div className="flex-1 bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col">
          {showNew ? (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-zinc-800">Nova Nota</h2>
                <button onClick={() => setShowNew(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Título *</label>
                  <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" placeholder="Título da nota" value={newNote.title} onChange={e => setNewNote(p => ({...p, title: e.target.value}))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tipo</label>
                    <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={newNote.type} onChange={e => setNewNote(p => ({...p, type: e.target.value}))}>
                      {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Empresa</label>
                    <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={newNote.company_id} onChange={e => setNewNote(p => ({...p, company_id: e.target.value, project_id: ''}))}>
                      <option value="">— nenhuma —</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Projeto</label>
                    <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={newNote.project_id} onChange={e => setNewNote(p => ({...p, project_id: e.target.value}))}>
                      <option value="">— nenhum —</option>
                      {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={createNote} disabled={saving || !newNote.title.trim()} className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50">
                    <Plus className="w-4 h-4" /> {saving ? 'Criando…' : 'Criar nota'}
                  </button>
                  <button onClick={() => setShowNew(false)} className="text-sm text-zinc-500 hover:text-zinc-700 px-4 py-2">Cancelar</button>
                </div>
              </div>
            </div>
          ) : selected ? (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <TypeBadge type={selected.type} />
                  {selected.company_id && <span className="text-xs text-zinc-500 flex items-center gap-1"><Building2 className="w-3 h-3" />{companyName(selected.company_id)}</span>}
                  {selected.project_id && <span className="text-xs text-zinc-500 flex items-center gap-1"><FolderOpen className="w-3 h-3" />{projectName(selected.project_id)}</span>}
                  <span className="text-xs text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(selected.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <button onClick={saveNote} disabled={saving} className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                        <Save className="w-3 h-3" />{saving ? 'Salvando…' : 'Salvar'}
                      </button>
                      <button onClick={() => setEditing(false)} className="text-xs text-zinc-500 hover:text-zinc-700 px-3 py-1.5">Cancelar</button>
                    </>
                  ) : (
                    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-violet-600 border border-zinc-200 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-colors">
                      <Edit3 className="w-3 h-3" /> Editar
                    </button>
                  )}
                  <button onClick={() => deleteNote(selected.id)} className="text-zinc-400 hover:text-red-500 p-1.5 rounded transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {editing ? (
                <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Título</label>
                      <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={selected.title} onChange={e => setSelected(p => ({...p, title: e.target.value}))} />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tipo</label>
                      <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" value={selected.type} onChange={e => setSelected(p => ({...p, type: e.target.value}))}>
                        {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Conteúdo</label>
                    <textarea
                      className="flex-1 min-h-[300px] border border-zinc-200 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
                      value={selected.content || ''}
                      onChange={e => setSelected(p => ({...p, content: e.target.value}))}
                      placeholder="Conteúdo da nota…"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6">
                  <h2 className="text-xl font-bold text-zinc-800 mb-4">{selected.title}</h2>
                  <pre className="text-sm text-zinc-700 whitespace-pre-wrap font-sans leading-relaxed">{selected.content || <span className="text-zinc-400 italic">Sem conteúdo.</span>}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                <div className="text-sm font-semibold text-zinc-500">Selecione uma nota</div>
                <div className="text-xs text-zinc-400 mt-1">ou crie uma nova à esquerda</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
