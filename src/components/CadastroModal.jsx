import React, { useState, useRef } from 'react'
import { X, Search, Sparkles, Loader2, Building2, User, FolderOpen, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import { toast } from './Toast'
import { ROLES, CARGO_OPTIONS } from '../lib/roles'

const VL = '#5452C1'
const CH = '#2D2E39'

// ─── Utilitários ──────────────────────────────────────────────────────────────
function fmtCNPJ(v) {
  return v.replace(/\D/g,'').slice(0,14)
    .replace(/(\d{2})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1/$2')
    .replace(/(\d{4})(\d)/,'$1-$2')
}
function fmtCPF(v) {
  return v.replace(/\D/g,'').slice(0,11)
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1-$2')
}
function fmtPhone(v) {
  const d = v.replace(/\D/g,'').slice(0,11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d)/,'($1) $2-$3')
  return d.replace(/(\d{2})(\d{5})(\d)/,'($1) $2-$3')
}

// ─── API BrasilAPI ─────────────────────────────────────────────────────────────
async function fetchCNPJ(cnpj) {
  const clean = cnpj.replace(/\D/g,'')
  if (clean.length !== 14) throw new Error('CNPJ deve ter 14 dígitos')
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`)
  if (!r.ok) throw new Error('CNPJ não encontrado na Receita Federal')
  return r.json()
}

// ─── AI via Claude API ─────────────────────────────────────────────────────────
async function callClaude(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const d = await r.json()
  return d.content?.[0]?.text || ''
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL NOVA EMPRESA
// ══════════════════════════════════════════════════════════════════════════════
export function NovaEmpresaModal({ onClose, onSave, companies }) {
  const { profile } = useData()
  const [form, setForm] = useState({
    name: '', trading_name: '', cnpj: '', segment: '', criticality: 'medio',
    status: 'ativo', contact_name: '', contact_email: '', contact_phone: '',
    notes: '', city: '', state: '', cnae: '', porte: '', socios: '',
    data_abertura: '', situacao: '', regime_tributario: '',
    ai_summary: '', label_ids: [],
  })
  const [loadingCNPJ, setLoadingCNPJ]   = useState(false)
  const [loadingAI,   setLoadingAI]     = useState(false)
  const [saving,      setSaving]        = useState(false)
  const [cnpjData,    setCnpjData]      = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  async function buscarCNPJ() {
    if (!form.cnpj || form.cnpj.replace(/\D/g,'').length !== 14) {
      toast.warning('Digite o CNPJ completo (14 dígitos)')
      return
    }
    setLoadingCNPJ(true)
    try {
      const d = await fetchCNPJ(form.cnpj)
      setCnpjData(d)
      const socios = (d.qsa || []).map(s => s.nome_socio).join(', ')
      setForm(p => ({
        ...p,
        name:              d.razao_social || p.name,
        trading_name:      d.nome_fantasia || p.trading_name,
        cnae:              d.cnae_fiscal_descricao || '',
        porte:             d.porte || '',
        city:              d.municipio || '',
        state:             d.uf || '',
        contact_phone:     d.ddd_telefone_1 ? `(${d.ddd_telefone_1.slice(0,2)}) ${d.ddd_telefone_1.slice(2)}` : p.contact_phone,
        contact_email:     d.email || p.contact_email,
        socios:            socios,
        data_abertura:     d.data_inicio_atividade || '',
        situacao:          d.descricao_situacao_cadastral || '',
        regime_tributario: d.regime_tributario || '',
        // Sugerir segmento baseado no CNAE
        segment:           sugerirSegmento(d.cnae_fiscal_descricao, d.cnae_fiscal),
        criticality:       sugerirCriticidade(d),
      }))
      toast.success('Dados da Receita Federal carregados ✓')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoadingCNPJ(false)
    }
  }

  function sugerirSegmento(cnaeDesc, cnaeCod) {
    if (!cnaeDesc) return ''
    const d = cnaeDesc.toLowerCase()
    if (d.includes('financ') || d.includes('banco') || d.includes('crédito') || d.includes('seguro')) return 'Financeiro'
    if (d.includes('indústria') || d.includes('fabricação') || d.includes('manufatura')) return 'Indústria'
    if (d.includes('comércio') || d.includes('varejista') || d.includes('atacadista')) return 'Varejo / Distribuição'
    if (d.includes('serviço') || d.includes('consultoria') || d.includes('assessoria')) return 'Serviços'
    if (d.includes('construção') || d.includes('incorporação') || d.includes('imobil')) return 'Construção / Imobiliário'
    if (d.includes('saúde') || d.includes('hospitalar') || d.includes('médico')) return 'Saúde'
    if (d.includes('tecnologia') || d.includes('software') || d.includes('informática')) return 'Tecnologia'
    if (d.includes('educação') || d.includes('ensino') || d.includes('escola')) return 'Educação'
    if (d.includes('aliment') || d.includes('bebida') || d.includes('restaurante')) return 'Alimentos / Bebidas'
    return 'Outros'
  }

  function sugerirCriticidade(d) {
    if (!d) return 'medio'
    // Situação irregular = crítico
    if (d.descricao_situacao_cadastral && d.descricao_situacao_cadastral !== 'ATIVA') return 'critico'
    // Capital social baixo ou MEI = baixo
    if (d.opcao_pelo_mei) return 'baixo'
    if (d.porte === 'MICRO EMPRESA') return 'baixo'
    if (d.porte === 'EMPRESA DE PEQUENO PORTE') return 'medio'
    return 'medio'
  }

  async function gerarResumoIA() {
    if (!form.name) { toast.warning('Preencha ao menos o nome da empresa'); return }
    setLoadingAI(true)
    try {
      const prompt = `Você é um analista sênior da BX Finance, escritório de advisory financeiro especializado em diagnóstico, recuperação judicial e M&A mid-market.

Gere um PERFIL BX FINANCE conciso e objetivo para esta empresa, em português do Brasil:

DADOS DA EMPRESA:
- Razão Social: ${form.name}
- Nome Fantasia: ${form.trading_name || '—'}
- CNPJ: ${form.cnpj || '—'}
- CNAE Principal: ${form.cnae || '—'}
- Porte: ${form.porte || '—'}
- Situação: ${form.situacao || 'ATIVA'}
- Cidade/UF: ${form.city || '—'}/${form.state || '—'}
- Regime Tributário: ${form.regime_tributario || '—'}
- Sócios: ${form.socios || '—'}
- Data de Abertura: ${form.data_abertura || '—'}

Responda APENAS com o perfil estruturado, sem introdução:

**PERFIL OPERACIONAL**
[2-3 frases descrevendo o negócio e atividade principal]

**INDICADORES DE RISCO**
[Pontos de atenção: situação cadastral, porte, regime tributário, tempo de operação]

**SERVIÇOS BX APLICÁVEIS**
[Quais serviços da BX Finance fazem sentido: Diagnóstico Financeiro, Reestruturação de Passivo, Recuperação Judicial, M&A, Assessoria]

**PRÓXIMOS PASSOS SUGERIDOS**
[1-2 ações concretas para a equipe BX]`

      const text = await callClaude(prompt)
      setForm(p => ({ ...p, ai_summary: text }))
      toast.success('Perfil BX gerado com IA ✓')
    } catch (err) {
      toast.error('Erro na IA: ' + err.message)
    } finally {
      setLoadingAI(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.warning('Razão Social é obrigatória'); return }
    setSaving(true)
    try {
      const payload = {
        org_id:            profile.org_id,
        name:              form.name.trim(),
        trading_name:      form.trading_name.trim() || null,
        cnpj:              form.cnpj.replace(/\D/g,'') || null,
        segment:           form.segment || null,
        criticality:       form.criticality,
        status:            form.status,
        contact_name:      form.contact_name.trim() || null,
        contact_email:     form.contact_email.trim() || null,
        contact_phone:     form.contact_phone || null,
        notes:             form.ai_summary
                             ? `${form.notes || ''}\n\n---\n🤖 PERFIL BX (IA):\n${form.ai_summary}`.trim()
                             : (form.notes.trim() || null),
        powerbi_link:      null,
        city:              form.city || null,
        state:             form.state || null,
        cnae:              form.cnae || null,
        porte:             form.porte || null,
      }
      const { data, error } = await supabase.from('companies').insert(payload).select().single()
      if (error) throw error
      toast.success(`Empresa "${form.name}" cadastrada ✓`)
      onSave(data)
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const situacaoColor = form.situacao === 'ATIVA' ? 'text-emerald-600' : form.situacao ? 'text-red-600' : 'text-zinc-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,16,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 680, maxHeight: '92vh', borderTop: `3px solid ${VL}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: VL + '15' }}>
              <Building2 className="w-4 h-4" style={{ color: VL }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-800">Nova Empresa</h3>
              <p className="text-[10px] text-zinc-400">Busca automática pelo CNPJ + Perfil BX com IA</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* CNPJ com busca automática */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">CNPJ — busca automática na Receita Federal</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 font-mono tracking-wider"
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={e => setForm(p => ({ ...p, cnpj: fmtCNPJ(e.target.value) }))}
                onKeyDown={e => e.key === 'Enter' && buscarCNPJ()}
              />
              <button onClick={buscarCNPJ} disabled={loadingCNPJ}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
                style={{ background: CH }}>
                {loadingCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loadingCNPJ ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            {form.situacao && (
              <p className={`text-[10px] font-semibold mt-1.5 ${situacaoColor}`}>
                {form.situacao === 'ATIVA' ? '✓' : '⚠'} Situação: {form.situacao}
                {form.data_abertura && ` · Fundada em ${new Date(form.data_abertura).toLocaleDateString('pt-BR')}`}
              </p>
            )}
          </div>

          {/* Preview dados Receita (quando carregados) */}
          {cnpjData && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">✓ Dados da Receita Federal</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600">
                {cnpjData.porte && <span><span className="text-zinc-400">Porte:</span> {cnpjData.porte}</span>}
                {cnpjData.regime_tributario && <span><span className="text-zinc-400">Regime:</span> {cnpjData.regime_tributario}</span>}
                {cnpjData.cnae_fiscal_descricao && <span className="col-span-2"><span className="text-zinc-400">CNAE:</span> {cnpjData.cnae_fiscal_descricao}</span>}
                {form.socios && <span className="col-span-2"><span className="text-zinc-400">Sócios:</span> {form.socios}</span>}
              </div>
            </div>
          )}

          {/* Dados básicos */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Razão Social *</label>
              <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="Razão Social conforme CNPJ"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Nome Fantasia</label>
              <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="Como a empresa é conhecida no mercado"
                value={form.trading_name}
                onChange={e => setForm(p => ({ ...p, trading_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Segmento</label>
                <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={form.segment}
                  onChange={e => setForm(p => ({ ...p, segment: e.target.value }))}>
                  <option value="">— selecione —</option>
                  {['Financeiro','Indústria','Varejo / Distribuição','Serviços','Construção / Imobiliário','Saúde','Tecnologia','Educação','Alimentos / Bebidas','Agronegócio','Energia','Logística','Outros'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Criticidade</label>
                <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                  value={form.criticality}
                  onChange={e => setForm(p => ({ ...p, criticality: e.target.value }))}>
                  <option value="baixo">🟢 Baixo</option>
                  <option value="medio">🟡 Médio</option>
                  <option value="alto">🟠 Alto</option>
                  <option value="critico">🔴 Crítico</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contato */}
          <div>
            <button onClick={() => setShowAdvanced(s => !s)}
              className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-700 transition-colors mb-3">
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              CONTATO E LOCALIZAÇÃO
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Nome do contato</label>
                  <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    placeholder="Responsável / CFO / CEO"
                    value={form.contact_name}
                    onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Telefone</label>
                  <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    placeholder="(11) 9..."
                    value={form.contact_phone}
                    onChange={e => setForm(p => ({ ...p, contact_phone: fmtPhone(e.target.value) }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Email</label>
                  <input type="email" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={form.contact_email}
                    onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Cidade</label>
                  <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    value={form.city}
                    onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">UF</label>
                  <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                    placeholder="SP" maxLength={2}
                    value={form.state}
                    onChange={e => setForm(p => ({ ...p, state: e.target.value.toUpperCase() }))} />
                </div>
              </div>
            )}
          </div>

          {/* AI Summary */}
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Perfil BX — Gerado por IA</label>
              <button onClick={gerarResumoIA} disabled={loadingAI || !form.name}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border disabled:opacity-40 transition-all hover:opacity-90"
                style={{ background: VL + '12', color: VL, borderColor: VL + '40' }}>
                {loadingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {loadingAI ? 'Gerando…' : '✨ Gerar Perfil BX'}
              </button>
            </div>
            <textarea rows={6}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none text-zinc-700 leading-relaxed"
              placeholder="Clique em '✨ Gerar Perfil BX' para que a IA analise os dados da Receita Federal e crie um perfil estratégico da empresa para a equipe BX Finance."
              value={form.ai_summary}
              onChange={e => setForm(p => ({ ...p, ai_summary: e.target.value }))} />
          </div>

          {/* Observações */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Observações internas</label>
            <textarea rows={2}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none"
              placeholder="Notas para a equipe BX…"
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-100 px-6 py-4 flex gap-3 bg-white">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ background: VL }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : '+ Cadastrar Empresa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL NOVO COLABORADOR
// ══════════════════════════════════════════════════════════════════════════════
export function NovoColaboradorModal({ onClose, onSave }) {
  const { profile } = useData()
  const [form, setForm] = useState({
    full_name: '', email: '', role: 'analyst', cargo: '',
    phone: '', cpf: '', linkedin: '', department: '',
    specialties: [], entry_date: '', notes: '', ai_bio: '',
  })
  const [newSpec,    setNewSpec]    = useState('')
  const [loadingAI,  setLoadingAI]  = useState(false)
  const [saving,     setSaving]     = useState(false)

  async function gerarBioIA() {
    if (!form.full_name) { toast.warning('Preencha o nome'); return }
    setLoadingAI(true)
    try {
      const prompt = `Você é um especialista em RH da BX Finance.
Gere uma bio profissional concisa (3-4 frases) para este colaborador:

Nome: ${form.full_name}
Cargo: ${form.cargo || 'não informado'}
Role: ${ROLES.find(r => r.value === form.role)?.label || form.role}
Especialidades: ${form.specialties.join(', ') || 'não informadas'}
Departamento: ${form.department || 'não informado'}

Escreva em terceira pessoa, tom profissional e objetivo, adequado para apresentação a clientes e parceiros da BX Finance.`

      const text = await callClaude(prompt)
      setForm(p => ({ ...p, ai_bio: text }))
      toast.success('Bio profissional gerada ✓')
    } catch (err) {
      toast.error('Erro na IA: ' + err.message)
    } finally {
      setLoadingAI(false)
    }
  }

  async function handleSave() {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.warning('Nome e email são obrigatórios')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('profiles').insert({
        org_id:     profile.org_id,
        full_name:  form.full_name.trim(),
        email:      form.email.trim().toLowerCase(),
        role:       form.role,
        cargo:      form.cargo || null,
        phone:      form.phone || null,
        department: form.department || null,
        notes:      form.ai_bio
                      ? `${form.notes || ''}\n\n---\n🤖 BIO IA:\n${form.ai_bio}`.trim()
                      : (form.notes?.trim() || null),
        specialties: form.specialties.length ? form.specialties : null,
        avatar_color: ['#5452C1','#10B981','#F59E0B','#3B82F6','#8B5CF6','#EF4444'][Math.floor(Math.random()*6)],
      }).select().single()
      if (error) throw error
      toast.success(`Colaborador "${form.full_name}" cadastrado ✓`)
      onSave(data)
    } catch (err) {
      toast.error('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,16,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 600, maxHeight: '92vh', borderTop: `3px solid #10B981` }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50">
              <User className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-800">Novo Colaborador</h3>
              <p className="text-[10px] text-zinc-400">Perfil completo + Bio profissional com IA</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Nome Completo *</label>
              <input autoFocus className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Email *</label>
              <input type="email" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Role</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Cargo / Função</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.cargo} onChange={e => setForm(p => ({ ...p, cargo: e.target.value }))}>
                <option value="">— selecione —</option>
                {CARGO_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Telefone</label>
              <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="(11) 9..." value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: fmtPhone(e.target.value) }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Departamento</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                <option value="">— selecione —</option>
                {['BX Finance','BX Outsourcing','BX Certified','Comercial','Administrativo'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">LinkedIn</label>
              <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="https://linkedin.com/in/..."
                value={form.linkedin} onChange={e => setForm(p => ({ ...p, linkedin: e.target.value }))} />
            </div>
          </div>

          {/* Especialidades */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Especialidades</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.specialties.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full">
                  {s}
                  <button onClick={() => setForm(p => ({ ...p, specialties: p.specialties.filter((_,j) => j !== i) }))}
                    className="text-violet-400 hover:text-red-500 text-sm leading-none">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="ex: Fleuriet, Recuperação Judicial, M&A…"
                value={newSpec}
                onChange={e => setNewSpec(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newSpec.trim()) {
                    setForm(p => ({ ...p, specialties: [...p.specialties, newSpec.trim()] }))
                    setNewSpec('')
                  }
                }} />
              <button onClick={() => { if (newSpec.trim()) { setForm(p => ({ ...p, specialties: [...p.specialties, newSpec.trim()] })); setNewSpec('') } }}
                className="px-3 py-2 text-xs font-semibold text-zinc-500 border border-zinc-200 rounded-xl hover:border-violet-400 hover:text-violet-600 transition-colors">
                + Tag
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {['Diagnóstico Financeiro','Recuperação Judicial','M&A','Reestruturação','Fleuriet','DuPont','DSCR','Valuation','Due Diligence','Contabilidade','Fiscal','Trabalhista'].map(s => (
                !form.specialties.includes(s) && (
                  <button key={s} onClick={() => setForm(p => ({ ...p, specialties: [...p.specialties, s] }))}
                    className="text-[10px] text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded-full hover:border-violet-400 hover:text-violet-600 transition-colors">
                    + {s}
                  </button>
                )
              ))}
            </div>
          </div>

          {/* Bio IA */}
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Bio Profissional — IA</label>
              <button onClick={gerarBioIA} disabled={loadingAI || !form.full_name}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border disabled:opacity-40 transition-all"
                style={{ background: '#10B98112', color: '#10B981', borderColor: '#10B98140' }}>
                {loadingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {loadingAI ? 'Gerando…' : '✨ Gerar Bio'}
              </button>
            </div>
            <textarea rows={4} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
              placeholder="Clique em '✨ Gerar Bio' para criar uma apresentação profissional baseada no cargo e especialidades."
              value={form.ai_bio} onChange={e => setForm(p => ({ ...p, ai_bio: e.target.value }))} />
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-6 py-4 flex gap-3 bg-white">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.full_name.trim() || !form.email.trim()}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: '#10B981' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : '+ Cadastrar Colaborador'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL NOVO PROJETO
// ══════════════════════════════════════════════════════════════════════════════
export function NovoProjetoModal({ onClose, onSave, companies, profiles }) {
  const { profile } = useData()
  const [form, setForm] = useState({
    name: '', type: 'Diagnóstico', status: 'Planejamento',
    deadline: '', budget: '', company_id: '', analyst_id: '',
    associate_id: '', priority: 'medium', observacoes: '',
    ai_scope: '',
  })
  const [loadingAI, setLoadingAI] = useState(false)
  const [saving,    setSaving]    = useState(false)

  async function gerarEscopoIA() {
    if (!form.type) { toast.warning('Selecione o tipo de projeto'); return }
    setLoadingAI(true)
    try {
      const empresa = companies.find(c => c.id === form.company_id)
      const prompt = `Você é um sócio sênior da BX Finance, escritório de advisory especializado em diagnóstico financeiro, reestruturação e recuperação judicial.

Gere um ESCOPO EXECUTIVO para este projeto:

TIPO: ${form.type}
EMPRESA CLIENTE: ${empresa?.name || 'não selecionada'}${empresa?.segment ? ` (${empresa.segment})` : ''}${empresa?.notes ? `\nPerfil: ${empresa.notes.slice(0,300)}` : ''}

Responda APENAS com o escopo estruturado:

**OBJETIVO PRINCIPAL**
[1-2 frases diretas]

**ENTREGAS ESPERADAS**
[Lista de 4-6 entregáveis concretos]

**RISCOS PRINCIPAIS**
[3-4 riscos relevantes para este tipo de mandato]

**PRAZO ESTIMADO**
[Duração típica em semanas/meses para este tipo]

**PREMISSAS**
[2-3 premissas críticas para execução]`

      const text = await callClaude(prompt)
      setForm(p => ({ ...p, ai_scope: text }))
      // Sugerir nome se não preenchido
      if (!form.name && empresa) {
        setForm(p => ({ ...p, name: `${form.type} — ${empresa.name}`, ai_scope: text }))
      }
      toast.success('Escopo gerado com IA ✓')
    } catch (err) {
      toast.error('Erro na IA: ' + err.message)
    } finally {
      setLoadingAI(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.warning('Nome do projeto é obrigatório'); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('projects').insert({
        org_id:      profile.org_id,
        name:        form.name.trim(),
        type:        form.type,
        status:      form.status,
        deadline:    form.deadline || null,
        budget:      form.budget ? parseFloat(form.budget) : null,
        company_id:  form.company_id || null,
        analyst_id:  form.analyst_id || null,
        associate_id:form.associate_id || null,
        priority:    form.priority,
        observacoes: form.ai_scope
                       ? `${form.observacoes || ''}\n\n---\n🤖 ESCOPO IA:\n${form.ai_scope}`.trim()
                       : (form.observacoes?.trim() || null),
      }).select().single()
      if (error) throw error
      toast.success(`Projeto "${form.name}" criado ✓`)
      onSave(data)
    } catch (err) {
      toast.error('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const leaders = (profiles || []).filter(p => ['owner','gerente'].includes(p.role))
  const analysts = (profiles || []).filter(p => p.role === 'analyst')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,16,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 640, maxHeight: '92vh', borderTop: `3px solid #F59E0B` }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50">
              <FolderOpen className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-800">Novo Projeto</h3>
              <p className="text-[10px] text-zinc-400">Estruturação + Escopo BX gerado por IA</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Tipo *</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {['Diagnóstico','RJ','M&A','Reestruturação','Assessoria'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Status</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {['Planejamento','Em andamento','Pausado','Concluído','Cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Empresa Cliente</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))}>
                <option value="">— selecione a empresa —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.trading_name ? ` (${c.trading_name})` : ''}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Nome do Projeto</label>
              <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="ex: Diagnóstico Financeiro — Empresa X"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Sócio Responsável</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.associate_id} onChange={e => setForm(p => ({ ...p, associate_id: e.target.value }))}>
                <option value="">— selecione —</option>
                {leaders.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Analista Responsável</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.analyst_id} onChange={e => setForm(p => ({ ...p, analyst_id: e.target.value }))}>
                <option value="">— selecione —</option>
                {(profiles || []).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Prazo</label>
              <input type="date" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Orçamento (R$)</label>
              <input type="number" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="0,00"
                value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} />
            </div>
          </div>

          {/* Escopo IA */}
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Escopo BX — Gerado por IA</label>
              <button onClick={gerarEscopoIA} disabled={loadingAI}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border disabled:opacity-40"
                style={{ background: '#F59E0B12', color: '#B45309', borderColor: '#F59E0B40' }}>
                {loadingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {loadingAI ? 'Gerando…' : '✨ Gerar Escopo'}
              </button>
            </div>
            <textarea rows={7} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
              placeholder="Selecione o tipo e empresa, depois clique em '✨ Gerar Escopo' para que a IA sugira objetivos, entregas, riscos e prazo estimado para este mandato."
              value={form.ai_scope} onChange={e => setForm(p => ({ ...p, ai_scope: e.target.value }))} />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Observações adicionais</label>
            <textarea rows={2} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none"
              value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-6 py-4 flex gap-3 bg-white">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: '#F59E0B' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : '+ Criar Projeto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL NOVA INSTITUIÇÃO — com website scraping + IA + nível de relacionamento
// ══════════════════════════════════════════════════════════════════════════════
export function NovaInstituicaoModal({ onClose, onSave }) {
  const { profile } = useData()
  const [form, setForm] = useState({
    name: '', type: 'Banco Comercial', website: '',
    contact_name: '', contact_email: '', contact_phone: '',
    linhas_operadas: [], nivel_relacionamento: 3,
    notas_estrategicas: '', ai_profile: '', notes: '',
  })
  const [loadingAI,  setLoadingAI]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [newLinha,   setNewLinha]   = useState('')

  const LINHAS_SUGERIDAS = [
    'Capital de Giro', 'Desconto de Recebíveis', 'Fomento Mercantil',
    'Crédito Rural', 'BNDES', 'FGI', 'FINAME', 'Cartão BNDES',
    'Antecipação de Contratos', 'CRI / CRA', 'Debentures',
    'FIDCs', 'Crédito Imobiliário', 'Leasing', 'Hot Money',
    'Conta Garantida', 'Cheque Especial PJ', 'Forfait', 'ACC / ACE',
  ]

  const TIPOS = [
    'Banco Comercial', 'Banco de Investimento', 'Banco de Desenvolvimento',
    'FIDC', 'FII', 'Fundo de PE / VC', 'Securitizadora',
    'Factoring / FOMEC', 'Cooperativa de Crédito', 'Fintech de Crédito',
    'Gestora de Ativos', 'Fundo Soberano', 'Seguradora', 'Corretora', 'Outro',
  ]

  const NIVEIS = [
    { v: 1, label: 'Sem relacionamento',  color: '#9CA3AF', desc: 'Nunca houve contato' },
    { v: 2, label: 'Contato inicial',     color: '#F59E0B', desc: 'Apresentação feita, sem operação' },
    { v: 3, label: 'Relacionamento ativo',color: '#3B82F6', desc: 'Operações esporádicas ou em andamento' },
    { v: 4, label: 'Parceiro estratégico',color: '#5452C1', desc: 'Múltiplas operações, acesso facilitado' },
    { v: 5, label: 'Parceiro premium',    color: '#10B981', desc: 'Mesa dedicada, condições diferenciadas para a BX' },
  ]

  async function gerarPerfilIA() {
    if (!form.name) { toast.warning('Preencha o nome da instituição'); return }
    setLoadingAI(true)
    try {
      const prompt = `Você é um analista sênior da BX Finance, especialista em estruturação de dívida e relacionamento bancário.

Gere um PERFIL ESTRATÉGICO desta instituição financeira para uso interno da equipe BX Finance:

NOME: ${form.name}
TIPO: ${form.type}
WEBSITE: ${form.website || 'não informado'}
LINHAS OPERADAS: ${form.linhas_operadas.join(', ') || 'não informadas'}

Responda APENAS com o perfil estruturado, sem introdução:

**PERFIL DA INSTITUIÇÃO**
[2-3 frases sobre o posicionamento, foco de mercado e público-alvo]

**LINHAS E PRODUTOS RELEVANTES PARA BX**
[Lista das 4-6 linhas mais relevantes para clientes em distress ou reestruturação, com características: prazo típico, garantias exigidas, ticket mínimo]

**CRITÉRIOS DE APROVAÇÃO**
[O que esta instituição tipicamente exige: rating, EBITDA, garantias, tempo de operação]

**TÁTICAS DE RELACIONAMENTO**
[Como a BX deve se posicionar nesta instituição: quem acionar, quando acionar, como apresentar clientes]

**ALERTAS**
[Pontos de atenção: restrições, setores que evitam, condições desfavoráveis]`

      const text = await callClaude(prompt)
      setForm(p => ({ ...p, ai_profile: text }))
      toast.success('Perfil estratégico gerado ✓')
    } catch (err) {
      toast.error('Erro na IA: ' + err.message)
    } finally {
      setLoadingAI(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.warning('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const notesComposed = [
        form.notes,
        form.linhas_operadas.length ? `Linhas: ${form.linhas_operadas.join(', ')}` : '',
        form.nivel_relacionamento ? `Nível BX: ${NIVEIS.find(n => n.v === form.nivel_relacionamento)?.label}` : '',
        form.ai_profile ? `---\n🤖 PERFIL IA:\n${form.ai_profile}` : '',
      ].filter(Boolean).join('\n\n').trim()

      const { data, error } = await supabase.from('institutions').insert({
        org_id:         profile.org_id,
        name:           form.name.trim(),
        type:           form.type,
        contact_name:   form.contact_name.trim() || null,
        contact_email:  form.contact_email.trim() || null,
        contact_phone:  form.contact_phone || null,
        notes:          notesComposed || null,
        is_active:      true,
        // campos extras em notes pois schema não tem colunas extras
      }).select().single()
      if (error) throw error
      toast.success(`Instituição "${form.name}" cadastrada ✓`)
      onSave(data)
    } catch (err) {
      toast.error('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const nivelAtual = NIVEIS.find(n => n.v === form.nivel_relacionamento) || NIVEIS[2]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,16,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 680, maxHeight: '92vh', borderTop: `3px solid #3B82F6` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
              <span className="text-lg">🏦</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-800">Nova Instituição Financeira</h3>
              <p className="text-[10px] text-zinc-400">Perfil estratégico com IA + Nível de relacionamento BX</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Dados básicos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Nome da Instituição *</label>
              <input autoFocus className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="ex: Banco BTG Pactual, Itaú BBA, Kinea..."
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Tipo</label>
              <select className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Website</label>
              <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="https://..."
                value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
            </div>
          </div>

          {/* Nível de relacionamento BX */}
          <div className="border border-zinc-200 rounded-xl p-4">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-3">
              Nível de Relacionamento com a BX
            </label>
            <div className="flex gap-2 mb-2">
              {NIVEIS.map(n => (
                <button key={n.v}
                  onClick={() => setForm(p => ({ ...p, nivel_relacionamento: n.v }))}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2"
                  style={form.nivel_relacionamento === n.v
                    ? { background: n.color, color: 'white', borderColor: n.color }
                    : { background: 'transparent', color: '#9CA3AF', borderColor: '#E5E7EB' }}>
                  {n.v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: nivelAtual.color }} />
              <div>
                <span className="text-sm font-bold" style={{ color: nivelAtual.color }}>{nivelAtual.label}</span>
                <span className="text-xs text-zinc-400 ml-2">— {nivelAtual.desc}</span>
              </div>
            </div>
          </div>

          {/* Linhas operadas */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
              Linhas que Opera
              {form.linhas_operadas.length > 0 && <span className="text-zinc-400 font-normal ml-1">({form.linhas_operadas.length} selecionadas)</span>}
            </label>
            {/* Tags selecionadas */}
            {form.linhas_operadas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.linhas_operadas.map((l, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                    {l}
                    <button onClick={() => setForm(p => ({ ...p, linhas_operadas: p.linhas_operadas.filter((_,j) => j !== i) }))}
                      className="text-blue-400 hover:text-red-500 ml-0.5 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
            {/* Input customizado */}
            <div className="flex gap-2 mb-2">
              <input className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                placeholder="Adicionar linha personalizada…"
                value={newLinha}
                onChange={e => setNewLinha(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newLinha.trim()) {
                    setForm(p => ({ ...p, linhas_operadas: [...p.linhas_operadas, newLinha.trim()] }))
                    setNewLinha('')
                  }
                }} />
              <button onClick={() => { if (newLinha.trim()) { setForm(p => ({ ...p, linhas_operadas: [...p.linhas_operadas, newLinha.trim()] })); setNewLinha('') } }}
                className="px-3 py-2 text-xs font-semibold text-zinc-500 border border-zinc-200 rounded-xl hover:border-violet-400 hover:text-violet-600">
                + Add
              </button>
            </div>
            {/* Sugestões rápidas */}
            <div className="flex flex-wrap gap-1">
              {LINHAS_SUGERIDAS.filter(l => !form.linhas_operadas.includes(l)).map(l => (
                <button key={l}
                  onClick={() => setForm(p => ({ ...p, linhas_operadas: [...p.linhas_operadas, l] }))}
                  className="text-[10px] text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded-full hover:border-blue-400 hover:text-blue-600 transition-colors">
                  + {l}
                </button>
              ))}
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Contato BX</label>
              <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="Nome do gerente / executivo"
                value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Telefone direto</label>
              <input className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                placeholder="(11) 9..."
                value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: fmtPhone(e.target.value) }))} />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Email do contato</label>
              <input type="email" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
            </div>
          </div>

          {/* Perfil IA */}
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Perfil Estratégico — IA</label>
              <button onClick={gerarPerfilIA} disabled={loadingAI || !form.name}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border disabled:opacity-40 transition-all"
                style={{ background: '#3B82F612', color: '#1D4ED8', borderColor: '#3B82F640' }}>
                {loadingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {loadingAI ? 'Gerando…' : '✨ Gerar Perfil BX'}
              </button>
            </div>
            <textarea rows={6}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
              placeholder="Clique em '✨ Gerar Perfil BX' para que a IA analise esta instituição e gere: posicionamento no mercado, linhas relevantes para clientes em distress, critérios de aprovação e táticas de relacionamento para a equipe BX."
              value={form.ai_profile} onChange={e => setForm(p => ({ ...p, ai_profile: e.target.value }))} />
          </div>

          {/* Notas internas */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Notas internas</label>
            <textarea rows={2}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none"
              placeholder="Observações da equipe BX sobre esta instituição…"
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-100 px-6 py-4 flex gap-3 bg-white">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: '#3B82F6' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : '+ Cadastrar Instituição'}
          </button>
        </div>
      </div>
    </div>
  )
}
