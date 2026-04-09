import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ROLES, CARGO_OPTIONS } from '../lib/roles'
import { toast } from './Toast'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../contexts/DataContext'
import {
  FolderOpen,
  Building2,
  Users,
  Tag,
  Briefcase,
  Landmark,
  Archive,
  Plus,
  Search,
  Edit3,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  MapPin,
  Mail,
  Phone,
  Filter,
  Download,
  X,
} from 'lucide-react'

// ============================================================================
// Cadastro.jsx v2 — Base de dados centralizada
// ----------------------------------------------------------------------------
// ENRIQUECE o /cadastro existente do v3 (4 abas: Empresas, Colaboradores,
// Etiquetas, Projetos) adicionando:
//   - KPIs hero
//   - 2 abas novas: Instituições, Arquivados
//   - Filtros avancados
//   - Cards visuais alem das tabelas
//   - Busca textual
//   - Estatisticas por subsidiaria
//
// Todas as 4 abas originais ficam intactas. So adicionamos.
//
// Tabelas Supabase reais utilizadas:
//   companies     - id, org_id, name, cnpj, segment, contact_name,
//                   contact_email, contact_phone, city, state, status,
//                   criticality, color, trading_name, label_ids, ...
//   profiles      - id, org_id, full_name, initials, role, avatar_color,
//                   location, email
//   labels        - (existente, schema variavel)
//   projects      - (existente, schema variavel)
//   institutions  - (existente, schema variavel)
// ============================================================================

const TABS = [
  { id: 'companies',     label: 'Empresas',      icon: Building2, emoji: '🏢' },
  { id: 'profiles',      label: 'Colaboradores', icon: Users,     emoji: '👥' },
  { id: 'labels',        label: 'Etiquetas',     icon: Tag,       emoji: '🏷️' },
  { id: 'projects',      label: 'Projetos',      icon: Briefcase, emoji: '📁' },
  { id: 'institutions',  label: 'Instituições',  icon: Landmark,  emoji: '🏦' },
  { id: 'archived',      label: 'Arquivados',    icon: Archive,   emoji: '📦' },
]

// Criticality real: alto, critico (extras assumidos)
const CRITICALITY_META = {
  baixo:   { label: 'Baixo',   color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  medio:   { label: 'Médio',   color: 'bg-sky-100 text-sky-700',         dot: 'bg-sky-500' },
  alto:    { label: 'Alto',    color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  critico: { label: 'Crítico', color: 'bg-rose-100 text-rose-700',       dot: 'bg-rose-500' },
}

export default function Cadastro() {
  const { profile } = useData()
  usePageTitle('Cadastro')
  useEscapeKey(() => { setShowNewCompany(false); setShowNewProfile(false); setShowNewLabel(false); setShowNewInstitution(false) }, !!(showNewCompany || showNewProfile || showNewLabel || showNewInstitution))
  const [activeTab, setActiveTab] = useState('companies')
  const [companies, setCompanies] = useState([])
  const [profiles, setProfiles] = useState([])
  const [labels, setLabels] = useState([])
  const [projects, setProjects] = useState([])
  const [institutions, setInstitutions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg,      setSuccessMsg]      = useState(null)
  const [editingCompany,  setEditingCompany]  = useState(null)
  const [editCompanyForm, setEditCompanyForm] = useState({})
  const [search, setSearch] = useState('')
  const [filterCriticality, setFilterCriticality] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'cards'
  const [showNewCompany, setShowNewCompany] = useState(false)
  const [showNewProfile, setShowNewProfile] = useState(false)
  const [newCompanyForm, setNewCompanyForm] = useState({ name: '', cnpj: '', segment: '', criticality: 'medio', status: 'ativo', notes: '' })
  const [newProfileForm, setNewProfileForm] = useState({ full_name: '', email: '', role: 'analyst', cargo: '', phone: '' })
  const [saving,        setSaving]        = useState(false)
  const navigate = useNavigate()
  // Modais de criação
  const [showNewLabel, setShowNewLabel]             = useState(false)
  const [showNewInstitution, setShowNewInstitution] = useState(false)
  const [newLabelForm, setNewLabelForm]             = useState({ name: '', color: '#5452C1' })
  const [newInstForm,  setNewInstForm]              = useState({ name: '', type: 'Banco Comercial', contact_name: '', contact_email: '', contact_phone: '', notes: '' })

  useEffect(() => {
    if (profile?.org_id) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        loadTable('companies', setCompanies),
        loadTable('profiles', setProfiles),
        loadTable('labels', setLabels),
        loadTable('projects', setProjects),
        loadTable('institutions', setInstitutions),
      ])
    } catch (err) {
      console.error('Error loading cadastro:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadTable(tableName, setter) {
    try {
      const { data, error: qErr } = await supabase
        .from(tableName)
        .select('*')
        .eq('org_id', profile?.org_id)
      if (qErr) {
        console.warn(`Tabela ${tableName}:`, qErr.message)
        setter([])
        return
      }
      setter(data || [])
    } catch (err) {
      console.warn(`Tabela ${tableName} nao acessivel:`, err.message)
      setter([])
    }
  }

  async function createLabel() {
    if (!newLabelForm.name.trim()) { toast.warning('Preencha o nome da etiqueta'); return }
    setSaving(true)
    const { error } = await supabase.from('labels').insert({
      org_id: profile.org_id,
      name: newLabelForm.name.trim(),
      color: newLabelForm.color || '#5452C1',
    })
    if (error) { toast.error('Erro ao criar etiqueta: ' + error.message) }
    else {
      setNewLabelForm({ name: '', color: '#5452C1' })
      setShowNewLabel(false)
      await loadAll()
      toast.success('Etiqueta criada')
    }
    setSaving(false)
  }

  async function createInstitution() {
    if (!newInstForm.name.trim()) { toast.warning('Preencha o nome da instituição'); return }
    setSaving(true)
    const { error } = await supabase.from('institutions').insert({
      org_id: profile.org_id,
      name: newInstForm.name.trim(),
      type: newInstForm.type,
      contact_name:  newInstForm.contact_name?.trim()  || null,
      contact_email: newInstForm.contact_email?.trim() || null,
      contact_phone: newInstForm.contact_phone?.trim() || null,
      notes:         newInstForm.notes?.trim()         || null,
      is_active: true,
    })
    if (error) { toast.error('Erro ao criar instituição: ' + error.message) }
    else {
      setNewInstForm({ name: '', type: 'Banco Comercial', contact_name: '', contact_email: '', contact_phone: '', notes: '' })
      setShowNewInstitution(false)
      await loadAll()
      toast.success('Instituição cadastrada')
    }
    setSaving(false)
  }

  async function createCompany() {
    if (!newCompanyForm.name.trim()) { toast.warning('Preencha o nome da empresa'); return }
    setSaving(true)
    const { error } = await supabase.from('companies').insert({
      org_id: profile.org_id, name: newCompanyForm.name.trim(),
      cnpj: newCompanyForm.cnpj?.trim() || null,
      segment: newCompanyForm.segment?.trim() || null,
      criticality: newCompanyForm.criticality,
      status: newCompanyForm.status,
      notes: newCompanyForm.notes?.trim() || null,
    })
    if (error) { toast.error('Erro ao criar empresa: ' + error.message) }
    else {
      setNewCompanyForm({ name: '', cnpj: '', segment: '', criticality: 'medio', status: 'ativo', notes: '' })
      setShowNewCompany(false)
      await loadAll()
      toast.success('Empresa cadastrada com sucesso')
    }
    setSaving(false)
  }

  function openEditCompany(company) {
    setEditingCompany(company)
    setEditCompanyForm({
      name:         company.name         || '',
      trading_name: company.trading_name || '',
      cnpj:         company.cnpj         || '',
      segment:      company.segment      || '',
      status:       company.status       || 'ativo',
      criticality:  company.criticality  || 'medio',
      notes:        company.notes        || '',
      powerbi_link: company.powerbi_link || '',
      contact_name: company.contact_name || '',
      contact_email:company.contact_email|| '',
      contact_phone:company.contact_phone|| '',
      website:      company.website      || '',
    })
  }

  async function updateCompany() {
    if (!editingCompany) return
    try {
      const { error } = await supabase.from('companies').update({
        name:          editCompanyForm.name.trim(),
        trading_name:  editCompanyForm.trading_name?.trim() || null,
        cnpj:          editCompanyForm.cnpj?.trim() || null,
        segment:       editCompanyForm.segment?.trim() || null,
        status:        editCompanyForm.status,
        criticality:   editCompanyForm.criticality,
        notes:         editCompanyForm.notes?.trim() || null,
        powerbi_link:  editCompanyForm.powerbi_link?.trim() || null,
        contact_name:  editCompanyForm.contact_name?.trim() || null,
        contact_email: editCompanyForm.contact_email?.trim() || null,
        contact_phone: editCompanyForm.contact_phone?.trim() || null,
        website:       editCompanyForm.website?.trim() || null,
      }).eq('id', editingCompany.id).eq('org_id', profile.org_id)
      if (error) throw error
      setEditingCompany(null)
      await loadAll()
      toast.success('Empresa atualizada')
    } catch (err) {
      toast.error('Erro ao atualizar: ' + err.message)
    }
  }

  async function createProfile() {
    if (!newProfileForm.full_name.trim() || !newProfileForm.email.trim()) {
      toast.warning('Preencha nome e email'); return
    }
    setSaving(true)
    // Gerar iniciais automaticamente
    const initials = newProfileForm.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
    const { error } = await supabase.from('profiles').insert({
      org_id: profile.org_id,
      full_name: newProfileForm.full_name.trim(),
      email: newProfileForm.email.trim(),
      role: newProfileForm.role,
      cargo: newProfileForm.cargo?.trim() || null,
      phone: newProfileForm.phone?.trim() || null,
      initials,
      is_active: true,
    })
    if (error) { toast.error('Erro ao criar colaborador: ' + error.message) }
    else {
      setNewProfileForm({ full_name: '', email: '', role: 'analyst', cargo: '', phone: '' })
      setShowNewProfile(false)
      await loadAll()
      toast.success('Colaborador cadastrado com sucesso')
    }
    setSaving(false)
  }

  // B-120: showSuccess migrado para toast.success()

  // ===== KPIs derivados =====
  const kpis = useMemo(() => {
    const activeCompanies = companies.filter(c => c.status !== 'arquivado').length
    const archivedCompanies = companies.filter(c => c.status === 'arquivado').length
    const criticalCompanies = companies.filter(c => c.criticality === 'critico' || c.criticality === 'alto').length
    return {
      companies: companies.length,
      activeCompanies,
      archivedCompanies,
      criticalCompanies,
      profiles: profiles.length,
      labels: labels.length,
      projects: projects.length,
      institutions: institutions.length,
    }
  }, [companies, profiles, labels, projects, institutions])

  // ===== Filtragem =====
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      if (search) {
        const s = search.toLowerCase()
        const hay = `${c.name || ''} ${c.cnpj || ''} ${c.segment || ''} ${c.city || ''} ${c.contact_name || ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (filterCriticality !== 'all' && c.criticality !== filterCriticality) return false
      if (filterStatus !== 'all' && c.status !== filterStatus) return false
      return true
    })
  }, [companies, search, filterCriticality, filterStatus])

  const filteredProfiles = useMemo(() => {
    if (!search) return profiles
    const s = search.toLowerCase()
    return profiles.filter(p => `${p.full_name || ''} ${p.email || ''} ${p.role || ''}`.toLowerCase().includes(s))
  }, [profiles, search])

  // Reset filters when changing tab
  useEffect(() => {
    setSearch('')
    setFilterCriticality('all')
    setFilterStatus('all')
  }, [activeTab])

  function exportCSV() {
    let header = []
    let rows = []
    if (activeTab === 'companies') {
      header = ['Nome', 'CNPJ', 'Segmento', 'Cidade/UF', 'Status', 'Criticidade', 'Contato']
      rows = filteredCompanies.map(c => [
        c.name || '',
        c.cnpj || '',
        c.segment || '',
        `${c.city || ''}/${c.state || ''}`,
        c.status || '',
        c.criticality || '',
        c.contact_name || '',
      ])
    } else if (activeTab === 'profiles') {
      header = ['Nome', 'Email', 'Role', 'Localização']
      rows = filteredProfiles.map(p => [
        p.full_name || '',
        p.email || '',
        p.role || '',
        p.location || '',
      ])
    } else {
      return
    }
    const csv = [header, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bx-cadastro-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const VL = '#5452C1'

  return (
    <>
    {/* B-187: Modal de edição de empresa */}
    {editingCompany && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={e => e.target === e.currentTarget && setEditingCompany(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <h3 className="text-base font-bold text-zinc-800">Editar Empresa</h3>
            <button onClick={() => setEditingCompany(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Razão Social *</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={editCompanyForm.name || ''} onChange={e => setEditCompanyForm(p => ({...p, name: e.target.value}))} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nome Fantasia</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={editCompanyForm.trading_name || ''} onChange={e => setEditCompanyForm(p => ({...p, trading_name: e.target.value}))} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">CNPJ</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={editCompanyForm.cnpj || ''} onChange={e => setEditCompanyForm(p => ({...p, cnpj: e.target.value}))} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Segmento</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={editCompanyForm.segment || ''} onChange={e => setEditCompanyForm(p => ({...p, segment: e.target.value}))} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Status</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={editCompanyForm.status || 'ativo'} onChange={e => setEditCompanyForm(p => ({...p, status: e.target.value}))}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Criticidade</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={editCompanyForm.criticality || 'medio'} onChange={e => setEditCompanyForm(p => ({...p, criticality: e.target.value}))}>
                  <option value="baixo">Baixo</option>
                  <option value="medio">Médio</option>
                  <option value="alto">Alto</option>
                  <option value="critico">Crítico</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Contato</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={editCompanyForm.contact_name || ''} onChange={e => setEditCompanyForm(p => ({...p, contact_name: e.target.value}))} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">E-mail</label>
                <input type="email" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={editCompanyForm.contact_email || ''} onChange={e => setEditCompanyForm(p => ({...p, contact_email: e.target.value}))} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Telefone</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  value={editCompanyForm.contact_phone || ''} onChange={e => setEditCompanyForm(p => ({...p, contact_phone: e.target.value}))} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Website</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="https://..."
                  value={editCompanyForm.website || ''} onChange={e => setEditCompanyForm(p => ({...p, website: e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Link Power BI</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="https://app.powerbi.com/..."
                  value={editCompanyForm.powerbi_link || ''} onChange={e => setEditCompanyForm(p => ({...p, powerbi_link: e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Observações</label>
                <textarea rows={3} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
                  value={editCompanyForm.notes || ''} onChange={e => setEditCompanyForm(p => ({...p, notes: e.target.value}))} />
              </div>
            </div>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-zinc-100">
            <button onClick={updateCompany}
              className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90"
              style={{ background: VL }}>
              Salvar Alterações
            </button>
            <button onClick={() => setEditingCompany(null)}
              className="px-5 text-sm text-zinc-500 hover:text-zinc-700">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
              <FolderOpen className="w-3 h-3" />
              Base de dados centralizada
            </div>
            <h1 className="text-2xl font-bold mb-1">Cadastro</h1>
            <p className="text-sm text-zinc-300">
              {kpis.companies} empresas · {kpis.profiles} colaboradores · {kpis.projects} projetos
              · {kpis.labels} etiquetas · {kpis.institutions} instituições
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadAll}
              disabled={loading}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            {(activeTab === 'companies' || activeTab === 'profiles') && (
              <button
                onClick={exportCSV}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            )}
            <button
              onClick={() => {
                if (activeTab === 'companies')    setShowNewCompany(true)
                else if (activeTab === 'profiles')     setShowNewProfile(true)
                else if (activeTab === 'labels')       setShowNewLabel(true)
                else if (activeTab === 'institutions') setShowNewInstitution(true)
                else if (activeTab === 'projects')     navigate('/timeline')
              }}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'companies' ? 'Nova Empresa'
               : activeTab === 'profiles' ? 'Novo Colaborador'
               : activeTab === 'labels' ? 'Nova Etiqueta'
               : activeTab === 'institutions' ? 'Nova Instituição'
               : activeTab === 'projects' ? 'Novo Projeto →'
               : 'Novo'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Kpi label="Empresas" value={kpis.activeCompanies} sub={`${kpis.archivedCompanies} arq.`} accent="violet" />
          <Kpi label="Críticas" value={kpis.criticalCompanies} sub="alto + crítico" accent="rose" />
          <Kpi label="Equipe" value={kpis.profiles} accent="emerald" />
          <Kpi label="Projetos" value={kpis.projects} accent="sky" />
          <Kpi label="Etiquetas" value={kpis.labels} accent="amber" />
          <Kpi label="Bancos" value={kpis.institutions} accent="violet" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 border-b border-white/10 -mb-2 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            const count = (
              tab.id === 'companies' ? kpis.activeCompanies :
              tab.id === 'profiles' ? kpis.profiles :
              tab.id === 'labels' ? kpis.labels :
              tab.id === 'projects' ? kpis.projects :
              tab.id === 'institutions' ? kpis.institutions :
              tab.id === 'archived' ? kpis.archivedCompanies :
              0
            )
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-violet-400 text-white'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <span className="text-base">{tab.emoji}</span>
                {tab.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-violet-500/30' : 'bg-white/10'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-emerald-900 font-semibold">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5" />
          <span className="text-sm text-rose-900">{error}</span>
        </div>
      )}

      {/* ============== TAB: EMPRESAS ============== */}
      {activeTab === 'companies' && (
        <>
          {/* Filtros */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar empresa, CNPJ, segmento, contato…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
                />
              </div>
              <select
                value={filterCriticality}
                onChange={(e) => setFilterCriticality(e.target.value)}
                className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
              >
                <option value="all">Todas criticidades</option>
                <option value="critico">Crítico</option>
                <option value="alto">Alto</option>
                <option value="medio">Médio</option>
                <option value="baixo">Baixo</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
              >
                <option value="all">Todos status</option>
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="arquivado">Arquivado</option>
              </select>
              <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md ${viewMode === 'table' ? 'bg-white shadow text-violet-700' : 'text-zinc-500'}`}
                >
                  Tabela
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md ${viewMode === 'cards' ? 'bg-white shadow text-violet-700' : 'text-zinc-500'}`}
                >
                  Cards
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingState />
          ) : filteredCompanies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={companies.length === 0 ? 'Nenhuma empresa cadastrada' : 'Nenhum resultado'}
              message={companies.length === 0 ? 'Clique em "Novo" para cadastrar a primeira.' : 'Ajuste os filtros para ver resultados.'}
            />
          ) : viewMode === 'table' ? (
            // ===== TABELA =====
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800 text-white">
                    <tr>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Empresa</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">CNPJ</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Segmento</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Cidade/UF</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Criticidade</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredCompanies.map(c => {
                      const crit = CRITICALITY_META[c.criticality]
                      return (
                        <tr key={c.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {c.color && (
                                <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: c.color }} />
                              )}
                              <div>
                                <div className="font-bold text-zinc-800">{c.name || '—'}</div>
                                {c.trading_name && c.trading_name !== c.name && (
                                  <div className="text-xs text-zinc-500">{c.trading_name}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{c.cnpj || '—'}</td>
                          <td className="px-4 py-3 text-zinc-600 max-w-xs truncate" title={c.segment}>{c.segment || '—'}</td>
                          <td className="px-4 py-3 text-zinc-600">
                            {c.city ? `${c.city}${c.state ? '/' + c.state : ''}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {crit ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${crit.color} uppercase tracking-wide`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${crit.dot}`} />
                                {crit.label}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                              c.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' :
                              c.status === 'arquivado' ? 'bg-zinc-200 text-zinc-600' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {c.status || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => openEditCompany(c)} className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded" title="Editar">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button className="p-1.5 text-rose-600 hover:bg-rose-50 rounded" title="Excluir">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // ===== CARDS =====
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompanies.map(c => {
                const crit = CRITICALITY_META[c.criticality]
                return (
                  <div
                    key={c.id}
                    className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md transition-shadow border-l-4"
                    style={{ borderLeftColor: c.color || '#5452C1' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-zinc-800 truncate">{c.name || '—'}</h3>
                        {c.trading_name && c.trading_name !== c.name && (
                          <div className="text-xs text-zinc-500 truncate">{c.trading_name}</div>
                        )}
                      </div>
                      {crit && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${crit.color} uppercase tracking-wide flex-shrink-0`}>
                          {crit.label}
                        </span>
                      )}
                    </div>
                    {c.segment && (
                      <p className="text-xs text-zinc-600 mb-3 line-clamp-2">{c.segment}</p>
                    )}
                    <div className="space-y-1.5 text-xs text-zinc-500 mb-3">
                      {c.cnpj && (
                        <div className="font-mono">{c.cnpj}</div>
                      )}
                      {c.city && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {c.city}{c.state ? `/${c.state}` : ''}
                        </div>
                      )}
                      {c.contact_name && (
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {c.contact_name}
                        </div>
                      )}
                      {c.contact_email && (
                        <div className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{c.contact_email}</span>
                        </div>
                      )}
                      {c.contact_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {c.contact_phone}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 pt-3 border-t border-zinc-100">
                      <button className="flex-1 px-3 py-1.5 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded">
                        <Edit3 className="w-3 h-3 inline mr-1" />
                        Editar
                      </button>
                      <button className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded" title="Arquivar">
                        <Archive className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ============== TAB: COLABORADORES ============== */}
      {activeTab === 'profiles' && (
        <>
          <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar colaborador, email, role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>
          {loading ? (
            <LoadingState />
          ) : filteredProfiles.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum colaborador" message="Ajuste a busca." />
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800 text-white">
                  <tr>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Colaborador</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Localização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredProfiles.map(p => {
                    const role = ROLES.find(r => r.value === p.role) || { label: p.role || '—', color: 'bg-zinc-100 text-zinc-600' }
                    const initials = p.initials || (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                    const avatarStyle = p.avatar_color ? { background: p.avatar_color } : {}
                    const avatarClass = p.avatar_color
                      ? 'w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0'
                      : 'w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0'
                    return (
                      <tr key={p.id} onClick={() => navigate('/timeline')} className="hover:bg-zinc-50 cursor-pointer hover:bg-violet-50 transition-colors" title="Ver na Timeline">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={avatarClass} style={avatarStyle}>{initials}</div>
                            <div className="font-bold text-zinc-800">{p.full_name || '—'}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{p.email || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${role.color} uppercase tracking-wide`}>
                            {role.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-xs">{p.location || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ============== TAB: ETIQUETAS ============== */}
      {activeTab === 'labels' && (
        <>
          {loading ? (
            <LoadingState />
          ) : labels.length === 0 ? (
            <div className="text-center py-16">
              <Tag className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-500 mb-1">Nenhuma etiqueta cadastrada</p>
              <p className="text-xs text-zinc-400 mb-4">Etiquetas classificam projetos e tarefas.</p>
              <button onClick={() => setShowNewLabel(true)} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-lg">
                + Nova Etiqueta
              </button>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl p-6">
              <div className="flex flex-wrap gap-2">
                {labels.map(l => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full"
                    style={{
                      background: l.color ? `${l.color}20` : '#F4F3FE',
                      color: l.color || '#5452C1',
                      border: `1px solid ${l.color || '#7C7AD9'}40`,
                    }}
                  >
                    {l.color && <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />}
                    {l.name || l.label || l.title || '—'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============== TAB: PROJETOS ============== */}
      {activeTab === 'projects' && (
        <>
          {loading ? (
            <LoadingState />
          ) : projects.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-500 mb-1">Nenhum projeto cadastrado</p>
              <p className="text-xs text-zinc-400 mb-4">Crie projetos na Timeline para começar.</p>
              <button onClick={() => navigate('/timeline')} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-lg">
                → Ir para Timeline
              </button>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800 text-white">
                  <tr>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Projeto</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Tipo</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Prazo</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {projects.map(p => (
                    <tr key={p.id} onClick={() => navigate('/timeline')} className="hover:bg-zinc-50 cursor-pointer hover:bg-violet-50 transition-colors" title="Ver na Timeline">
                      <td className="px-4 py-3 font-bold text-zinc-800">{p.name || p.title || '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{p.type || p.project_type || '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{p.deadline ? new Date(p.deadline).toLocaleDateString('pt-BR') : p.due_date ? new Date(p.due_date).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-4 py-3">
                        {p.status && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase tracking-wide">
                            {p.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ============== TAB: INSTITUIÇÕES (NOVA) ============== */}
      {activeTab === 'institutions' && (
        <>
          {loading ? (
            <LoadingState />
          ) : institutions.length === 0 ? (
            <div className="text-center py-16">
              <Landmark className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-500 mb-1">Nenhuma instituição cadastrada</p>
              <p className="text-xs text-zinc-400 mb-4">Cadastre bancos e instituições para usar no módulo Captação.</p>
              <button onClick={() => setShowNewInstitution(true)} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-lg">
                + Nova Instituição
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {institutions.map(i => (
                <div key={i.id} className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <Landmark className="w-6 h-6 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-zinc-800 truncate">{i.name || '—'}</h3>
                      {i.type && <div className="text-xs text-zinc-500">{i.type}</div>}
                      {i.contact_name && <div className="text-xs text-zinc-600 mt-2">{i.contact_name}</div>}
                      {i.contact_email && <div className="text-xs text-zinc-500 truncate">{i.contact_email}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============== TAB: ARQUIVADOS (NOVA) ============== */}
      {activeTab === 'archived' && (
        <>
          {loading ? (
            <LoadingState />
          ) : kpis.archivedCompanies === 0 ? (
            <EmptyState
              icon={Archive}
              title="Nenhum item arquivado"
              message="Empresas, projetos e cadastros arquivados aparecerão aqui. Você pode restaurá-los a qualquer momento."
            />
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-zinc-800 mb-4">Empresas arquivadas</h3>
              <div className="space-y-2">
                {companies.filter(c => c.status === 'arquivado').map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                    <div>
                      <div className="font-bold text-zinc-700">{c.name}</div>
                      <div className="text-xs text-zinc-500">{c.cnpj}</div>
                    </div>
                    <button className="text-xs font-bold text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded">
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>

    {/* ── Modal Nova Empresa ── */}
    {showNewCompany && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={e => e.target === e.currentTarget && setShowNewCompany(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-zinc-800">Nova Empresa</h3>
            <button onClick={() => setShowNewCompany(false)} className="text-zinc-400 hover:text-zinc-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Razão Social *</label>
              <input autoFocus className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={newCompanyForm.name} onChange={e => setNewCompanyForm(p => ({...p, name: e.target.value}))} placeholder="Nome da empresa..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">CNPJ</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newCompanyForm.cnpj} onChange={e => setNewCompanyForm(p => ({...p, cnpj: e.target.value}))} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Segmento</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newCompanyForm.segment} onChange={e => setNewCompanyForm(p => ({...p, segment: e.target.value}))} placeholder="Ex: Têxtil, Saúde..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Criticidade</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newCompanyForm.criticality} onChange={e => setNewCompanyForm(p => ({...p, criticality: e.target.value}))}>
                  <option value="baixo">Baixo</option>
                  <option value="medio">Médio</option>
                  <option value="alto">Alto</option>
                  <option value="critico">Crítico</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Status</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newCompanyForm.status} onChange={e => setNewCompanyForm(p => ({...p, status: e.target.value}))}>
                  <option value="ativo">Ativo</option>
                  <option value="em_reestruturacao">Em Reestruturação</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Observações</label>
              <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" rows={2}
                value={newCompanyForm.notes} onChange={e => setNewCompanyForm(p => ({...p, notes: e.target.value}))} placeholder="Contexto, histórico..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={createCompany} disabled={saving || !newCompanyForm.name.trim()}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                style={{ background: '#5452C1' }}>
                {saving ? 'Salvando…' : 'Criar Empresa'}
              </button>
              <button onClick={() => setShowNewCompany(false)} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Modal Nova Etiqueta ── */}
    {showNewLabel && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={e => e.target === e.currentTarget && setShowNewLabel(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-zinc-800">Nova Etiqueta</h3>
            <button onClick={() => setShowNewLabel(false)} className="text-zinc-400 hover:text-zinc-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nome *</label>
              <input autoFocus className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={newLabelForm.name} onChange={e => setNewLabelForm(p => ({...p, name: e.target.value}))} placeholder="Ex: Urgente, RJ, M&A..." />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Cor</label>
              <div className="flex items-center gap-3">
                <input type="color" className="w-10 h-10 rounded-lg border border-zinc-200 cursor-pointer"
                  value={newLabelForm.color} onChange={e => setNewLabelForm(p => ({...p, color: e.target.value}))} />
                <div className="flex gap-2 flex-wrap">
                  {['#5452C1','#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#2D2E39'].map(col => (
                    <button key={col} onClick={() => setNewLabelForm(p => ({...p, color: col}))}
                      className="w-7 h-7 rounded-full ring-offset-1 transition-all"
                      style={{ background: col, outline: newLabelForm.color === col ? `2px solid ${col}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
              {newLabelForm.name && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full"
                    style={{ background: `${newLabelForm.color}20`, color: newLabelForm.color, border: `1px solid ${newLabelForm.color}40` }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: newLabelForm.color }} />
                    {newLabelForm.name}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={createLabel} disabled={saving || !newLabelForm.name.trim()}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                style={{ background: '#5452C1' }}>
                {saving ? 'Salvando…' : 'Criar Etiqueta'}
              </button>
              <button onClick={() => setShowNewLabel(false)} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Modal Nova Instituição ── */}
    {showNewInstitution && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={e => e.target === e.currentTarget && setShowNewInstitution(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-zinc-800">Nova Instituição</h3>
            <button onClick={() => setShowNewInstitution(false)} className="text-zinc-400 hover:text-zinc-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nome *</label>
                <input autoFocus className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newInstForm.name} onChange={e => setNewInstForm(p => ({...p, name: e.target.value}))} placeholder="Ex: Itaú BBA, BNDES..." />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Tipo</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newInstForm.type} onChange={e => setNewInstForm(p => ({...p, type: e.target.value}))}>
                  <option>Banco Comercial</option>
                  <option>Banco de Investimento</option>
                  <option>Fomento</option>
                  <option>Cooperativa</option>
                  <option>Fintech</option>
                  <option>Fundo</option>
                  <option>Outro</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Contato</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newInstForm.contact_name} onChange={e => setNewInstForm(p => ({...p, contact_name: e.target.value}))} placeholder="Nome do contato..." />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Telefone</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newInstForm.contact_phone} onChange={e => setNewInstForm(p => ({...p, contact_phone: e.target.value}))} placeholder="+55 11..." />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">E-mail</label>
              <input type="email" className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={newInstForm.contact_email} onChange={e => setNewInstForm(p => ({...p, contact_email: e.target.value}))} placeholder="contato@banco.com.br" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Observações</label>
              <textarea rows={2} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
                value={newInstForm.notes} onChange={e => setNewInstForm(p => ({...p, notes: e.target.value}))} placeholder="Linhas disponíveis, condições, contatos..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={createInstitution} disabled={saving || !newInstForm.name.trim()}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                style={{ background: '#5452C1' }}>
                {saving ? 'Salvando…' : 'Cadastrar Instituição'}
              </button>
              <button onClick={() => setShowNewInstitution(false)} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Modal Novo Colaborador ── */}
    {showNewProfile && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={e => e.target === e.currentTarget && setShowNewProfile(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-zinc-800">Novo Colaborador</h3>
            <button onClick={() => setShowNewProfile(false)} className="text-zinc-400 hover:text-zinc-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nome Completo *</label>
              <input autoFocus className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={newProfileForm.full_name} onChange={e => setNewProfileForm(p => ({...p, full_name: e.target.value}))} placeholder="Nome completo..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Email *</label>
                <input type="email" className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newProfileForm.email} onChange={e => setNewProfileForm(p => ({...p, email: e.target.value}))} placeholder="email@bxgroup.com.br" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Telefone</label>
                <input className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={newProfileForm.phone} onChange={e => setNewProfileForm(p => ({...p, phone: e.target.value}))} placeholder="+55 11 9..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Cargo / Função</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 bg-white"
                  value={newProfileForm.cargo} onChange={e => setNewProfileForm(p => ({...p, cargo: e.target.value}))}>
                  <option value="">— selecione —</option>
                  {CARGO_OPTIONS.map(co => <option key={co} value={co}>{co}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Nível de acesso</label>
                <select className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 bg-white"
                  value={newProfileForm.role} onChange={e => setNewProfileForm(p => ({...p, role: e.target.value}))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <p className="text-[10px] text-zinc-400 mt-1">
                  {ROLES.find(r => r.value === newProfileForm.role)?.desc}
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={createProfile} disabled={saving || !newProfileForm.full_name.trim() || !newProfileForm.email.trim()}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                style={{ background: '#5452C1' }}>
                {saving ? 'Salvando…' : 'Criar Colaborador'}
              </button>
              <button onClick={() => setShowNewProfile(false)} className="px-4 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function Kpi({ label, value, sub, accent }) {
  const accents = {
    violet: 'text-violet-300',
    emerald: 'text-emerald-300',
    sky: 'text-sky-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
      <div className={`text-[10px] font-bold uppercase tracking-wider ${accents[accent] || 'text-zinc-300'} mb-1`}>
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
      <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2 text-zinc-400" />
      <span className="text-sm text-zinc-500">Carregando…</span>
    </div>
  )
}

function EmptyState({ icon: Icon, title, message }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
      <Icon className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
      <div className="text-sm font-bold text-zinc-700">{title}</div>
      <div className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">{message}</div>
    </div>
  )
}
