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
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function callClaude(prompt, useWebSearch = false) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_KEY || ''
  if (!apiKey) throw new Error('Chave da API não configurada. Adicione VITE_ANTHROPIC_KEY nas variáveis de ambiente do Vercel.')

  const baseBody = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  }
  if (useWebSearch) {
    baseBody.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  }

  // Chamada única com retry automático em overload (backoff: 4s, 8s, 12s, 16s)
  async function fetchWithRetry(payload, maxRetries = 4) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await sleep(Math.min(4000 * attempt, 16000))
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(payload),
      })
      if (r.ok) return r.json()
      const err = await r.json().catch(() => ({}))
      const errType     = err?.error?.type || ''
      const isOverload  = errType === 'overloaded_error' || r.status === 529
      const isRateLimit = errType === 'rate_limit_error' || r.status === 429

      // Overload: retry com backoff normal
      if (isOverload && attempt < maxRetries) continue

      // Rate limit: fallback imediato sem web search (menos tokens/chamada)
      if (isRateLimit && useWebSearch) {
        await sleep(5000)
        const fallback = { ...payload }; delete fallback.tools
        const r2 = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify(fallback),
        })
        if (r2.ok) return r2.json()
      }
      if (isRateLimit && attempt < maxRetries) { await sleep(20000); continue }

      // Fallback sem web search se overload ou rate limit persistir
      if ((isOverload || isRateLimit) && useWebSearch) {
        const fallback = { ...payload }; delete fallback.tools
        const r2 = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify(fallback),
        })
        if (r2.ok) return r2.json()
      }
      throw new Error(err?.error?.message || `Erro ${r.status} na API`)
    }
  }

  // Loop agentic: continua enquanto houver tool_use (buscas web)
  let messages = baseBody.messages
  let finalText = ''
  const MAX_TURNS = 8

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const d = await fetchWithRetry({ ...baseBody, messages })
    const textBlocks = d.content?.filter(b => b.type === 'text') || []
    if (textBlocks.length) finalText = textBlocks.map(b => b.text).join('')
    if (d.stop_reason === 'end_turn' || !d.content?.some(b => b.type === 'tool_use')) break
    const toolUseBlocks = d.content.filter(b => b.type === 'tool_use')
    messages = [
      ...messages,
      { role: 'assistant', content: d.content },
      { role: 'user', content: toolUseBlocks.map(tu => ({
        type: 'tool_result', tool_use_id: tu.id,
        content: tu.input?.query ? `Buscando: "${tu.input.query}" — resultados incorporados.` : 'Busca processada.',
      }))},
    ]
  }
  return finalText
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL NOVA EMPRESA
// ══════════════════════════════════════════════════════════════════════════════
export function NovaEmpresaModal({ onClose, onSave, companies, initialData }) {
  const { profile } = useData()
  const isEdit = !!initialData

  const [form, setForm] = useState(() => {
    if (initialData) {
      // Extract ai_summary from observations if embedded
      const obs = initialData.observations || ''
      const aiIdx = obs.indexOf('🤖 PERFIL BX (IA):\n')
      const cleanObs = aiIdx > -1 ? obs.slice(obs.indexOf('\n\n', aiIdx) + 2).trim() : obs
      const aiSummary = aiIdx > -1 ? obs.slice(aiIdx + '🤖 PERFIL BX (IA):\n'.length, obs.indexOf('\n\n', aiIdx) > -1 ? obs.indexOf('\n\n', aiIdx) : undefined).trim() : ''
      return {
        name:               initialData.name            || '',
        trading_name:       initialData.trading_name    || '',
        cnpj:               initialData.cnpj            || '',
        status:             initialData.status          || 'ativo',
        segment:            initialData.segment         || '',
        criticality:        initialData.criticality     || 'medio',
        zip_code:           initialData.zip_code        || '',
        address:            initialData.address         || '',
        address_number:     '',
        address_complement: '',
        neighborhood:       '',
        city:               initialData.city            || '',
        state:              initialData.state           || '',
        contact_name:       initialData.contact_name    || '',
        contact_role:       '',
        contact_email:      initialData.contact_email   || '',
        contact_phone:      initialData.contact_phone   || '',
        contact_phone2:     '',
        website:            initialData.website         || '',
        powerbi_link:       initialData.powerbi_link    || '',
        cnae:               initialData.cnae               || '',
        porte:              initialData.porte              || '',
        socios:             initialData.socios             || '',
        data_abertura:      initialData.data_abertura      || '',
        situacao:           initialData.situacao           || '',
        regime_tributario:  initialData.regime_tributario  || '',
        natureza_juridica:  initialData.natureza_juridica  || '',
        capital_social:     initialData.capital_social     || '',
        ai_summary: aiSummary,
        notes:       initialData.notes        || '',
        observations: cleanObs,
      }
    }
    return {
      name: '', trading_name: '', cnpj: '', status: 'ativo',
      segment: '', criticality: 'medio',
      zip_code: '', address: '', address_number: '', address_complement: '',
      neighborhood: '', city: '', state: '',
      contact_name: '', contact_role: '', contact_email: '', contact_phone: '',
      contact_phone2: '', website: '', powerbi_link: '',
      cnae: '', porte: '', socios: '', data_abertura: '',
      situacao: '', regime_tributario: '', natureza_juridica: '',
      capital_social: '',
      ai_summary: '', notes: '', observations: '',
    }
  })
  const [loadingCNPJ, setLoadingCNPJ] = useState(false)
  const [loadingAI,   setLoadingAI]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [cnpjData,    setCnpjData]    = useState(null)
  const [activeTab,   setActiveTab]   = useState('identificacao')

  const TABS = [
    { id: 'identificacao', label: 'Identificação' },
    { id: 'localizacao',   label: 'Localização'   },
    { id: 'contato',       label: 'Contato'       },
    { id: 'receita',       label: 'Receita Federal'},
    { id: 'perfil',        label: '✨ Perfil BX'  },
  ]

  async function buscarCNPJ() {
    if (!form.cnpj || form.cnpj.replace(/\D/g,'').length !== 14) {
      toast.warning('Digite o CNPJ completo (14 dígitos)'); return
    }
    setLoadingCNPJ(true)
    try {
      const d = await fetchCNPJ(form.cnpj)
      const regimeTrib = Array.isArray(d.regime_tributario)
        ? d.regime_tributario.slice(-1)[0]?.forma_de_tributacao || ''
        : (d.regime_tributario || '')
      const socios = (d.qsa || []).map(s => s.nome_socio).filter(Boolean).join(', ')

      setCnpjData({
        porte:               d.porte || null,
        regime_tributario:   regimeTrib || null,
        cnae_descricao:      d.cnae_fiscal_descricao || null,
        socios_resumo:       socios || null,
        natureza_juridica:   d.natureza_juridica || null,
        capital_social:      d.capital_social ? `R$ ${(d.capital_social/100).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : null,
      })

      // Formatar logradouro completo
      const logradouro = [
        d.descricao_tipo_de_logradouro, d.logradouro
      ].filter(Boolean).join(' ')

      setForm(p => ({
        ...p,
        name:              d.razao_social         || p.name,
        trading_name:      d.nome_fantasia        || p.trading_name,
        cnae:              d.cnae_fiscal_descricao || '',
        porte:             d.porte                || '',
        city:              d.municipio            || '',
        state:             d.uf                   || '',
        zip_code:          d.cep ? d.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : p.zip_code,
        address:           logradouro             || p.address,
        address_number:    d.numero               || '',
        address_complement:d.complemento          || '',
        neighborhood:      d.bairro               || '',
        contact_phone:     d.ddd_telefone_1 ? `(${d.ddd_telefone_1.slice(0,2)}) ${d.ddd_telefone_1.slice(2)}` : p.contact_phone,
        contact_phone2:    d.ddd_telefone_2 ? `(${d.ddd_telefone_2.slice(0,2)}) ${d.ddd_telefone_2.slice(2)}` : p.contact_phone2,
        contact_email:     d.email                || p.contact_email,
        socios:            socios,
        data_abertura:     d.data_inicio_atividade || '',
        situacao:          d.descricao_situacao_cadastral || '',
        regime_tributario: regimeTrib,
        natureza_juridica: d.natureza_juridica    || '',
        capital_social:    d.capital_social ? String(d.capital_social) : '',
        segment:           sugerirSegmento(d.cnae_fiscal_descricao),
        criticality:       sugerirCriticidade(d),
      }))

      toast.success('Receita Federal: dados carregados ✓')
      setActiveTab('localizacao') // avança para conferir endereço
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoadingCNPJ(false)
    }
  }

  function sugerirSegmento(cnaeDesc) {
    if (!cnaeDesc) return ''
    const d = cnaeDesc.toLowerCase()
    if (d.includes('financ') || d.includes('banco') || d.includes('crédito') || d.includes('seguro')) return 'Financeiro'
    if (d.includes('indústria') || d.includes('fabricação') || d.includes('manufatura') || d.includes('químic') || d.includes('petroquím')) return 'Indústria'
    if (d.includes('comércio') || d.includes('varejista') || d.includes('atacadista')) return 'Varejo / Distribuição'
    if (d.includes('serviço') || d.includes('consultoria') || d.includes('assessoria')) return 'Serviços'
    if (d.includes('construção') || d.includes('incorporação') || d.includes('imobil')) return 'Construção / Imobiliário'
    if (d.includes('saúde') || d.includes('hospitalar') || d.includes('médico') || d.includes('clínica')) return 'Saúde'
    if (d.includes('tecnologia') || d.includes('software') || d.includes('informática')) return 'Tecnologia'
    if (d.includes('educação') || d.includes('ensino') || d.includes('escola')) return 'Educação'
    if (d.includes('aliment') || d.includes('bebida') || d.includes('restaurante')) return 'Alimentos / Bebidas'
    if (d.includes('energia') || d.includes('elétric') || d.includes('combustível') || d.includes('etanol')) return 'Energia'
    if (d.includes('logística') || d.includes('transporte') || d.includes('armazén')) return 'Logística'
    if (d.includes('agro') || d.includes('agrícola') || d.includes('pecuária') || d.includes('soja') || d.includes('cana')) return 'Agronegócio'
    return 'Outros'
  }

  function sugerirCriticidade(d) {
    if (!d) return 'medio'
    if (d.descricao_situacao_cadastral && d.descricao_situacao_cadastral !== 'ATIVA') return 'critico'
    if (d.opcao_pelo_mei) return 'baixo'
    if (d.porte === 'MICRO EMPRESA') return 'baixo'
    if (d.porte === 'EMPRESA DE PEQUENO PORTE') return 'medio'
    return 'medio'
  }

  async function gerarPerfilIA() {
    if (!form.name) { toast.warning('Preencha o nome da empresa'); return }
    setLoadingAI(true)
    try {
      const prompt = `Você é um sócio da BX Finance com profunda experiência em advisory financeiro mid-market: diagnóstico financeiro, reestruturação operacional, RJ/RX, M&A e estruturação de dívida. A BX é reconhecida por análises cirúrgicas, linguagem direta e entrega de valor real para empresas em situações complexas.

IMPORTANTE: Use a busca web para pesquisar esta empresa ANTES de escrever. Busque pelo nome, CNPJ e notícias recentes.\n\nGere um PERFIL BX PROPRIETÁRIO desta empresa. Seja analítico, direto e use emojis. Cada seção deve usar dados reais encontrados na web + dados cadastrais abaixo.

DADOS DA EMPRESA:
- Razão Social: ${form.name}
- Nome Fantasia: ${form.trading_name || '—'}
- CNPJ: ${form.cnpj || '—'}
- CNAE Principal: ${form.cnae || '—'}
- Porte: ${form.porte || '—'}
- Natureza Jurídica: ${form.natureza_juridica || '—'}
- Capital Social: ${form.capital_social ? 'R$ ' + Number(form.capital_social).toLocaleString('pt-BR') : '—'}
- Situação Receita: ${form.situacao || 'ATIVA'}
- Cidade/UF: ${form.city || '—'}/${form.state || '—'}
- Regime Tributário: ${form.regime_tributario || '—'}
- Sócios: ${form.socios || '—'}
- Fundação: ${form.data_abertura || '—'}
- Segmento BX: ${form.segment || '—'}
- Website: ${form.website || '—'}\n
Responda APENAS com o perfil. Use exatamente esta estrutura:

🔍 **INTELIGÊNCIA DE MERCADO** *(pesquisa web)*\n[O que você encontrou sobre a empresa online: notícias, menções em mídia, situação aparente, presença digital. Cite as fontes. Se nada relevante foi encontrado, informe.]\n\n🏢 **PERFIL OPERACIONAL**
[3-4 frases: o que faz de verdade, modelo de negócio, porte real, posicionamento no mercado e principais clientes/mercados atendidos]

📊 **LEITURA FINANCEIRA PRELIMINAR**
[Com base no porte, CNAE, regime tributário e capital social — ciclo financeiro esperado, pressões de caixa típicas do setor, nível de endividamento provável, principais alavancas financeiras deste tipo de negócio]

🚦 **SEMÁFORO BX**
🔴 Riscos críticos: [pontos que podem complicar qualquer operação com este cliente]
🟡 Pontos de atenção: [sinais que merecem investigação antes de avançar]
🟢 Oportunidades: [o que esta empresa provavelmente precisa e que a BX pode entregar bem]

💼 **MANDATOS BX APLICÁVEIS**
[Para cada serviço relevante — Diagnóstico, Reestruturação, RJ/RX, M&A, Captação — justifique com 1 frase de por quê e qual seria o gatilho de entrada]

🎯 **ESTRATÉGIA DE ABORDAGEM BX**
[Quem acionar primeiro na empresa (cargo/função), qual dor apresentar na abertura, qual ângulo de entrada usar, o que NÃO falar na primeira reunião]

📅 **PRÓXIMOS PASSOS**
[2-3 ações concretas e sequenciadas: o que fazer essa semana, o que preparar para o primeiro contato]`

      const text = await callClaude(prompt, true)
      setForm(p => ({ ...p, ai_summary: text }))
      toast.success('Perfil BX gerado ✓')
    } catch (err) {
      toast.error('Erro na IA: ' + err.message)
    } finally {
      setLoadingAI(false)
    }
  }

  async function buscarCEP(cep) {
    const clean = cep.replace(/\D/g,'')
    if (clean.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
      const d = await r.json()
      if (!d.erro) {
        setForm(p => ({
          ...p,
          address:      d.logradouro || p.address,
          neighborhood: d.bairro     || p.neighborhood,
          city:         d.localidade || p.city,
          state:        d.uf         || p.state,
        }))
        toast.success('CEP encontrado ✓')
      }
    } catch {}
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.warning('Razão Social é obrigatória'); return }
    setSaving(true)
    try {
      const techNotes = []
      if (form.cnae)              techNotes.push(`CNAE: ${form.cnae}`)
      if (form.porte)             techNotes.push(`Porte: ${form.porte}`)
      if (form.natureza_juridica) techNotes.push(`Natureza Jurídica: ${form.natureza_juridica}`)
      if (form.regime_tributario) techNotes.push(`Regime: ${form.regime_tributario}`)
      if (form.capital_social)    techNotes.push(`Capital Social: R$ ${Number(form.capital_social).toLocaleString('pt-BR')}`)
      if (form.socios)            techNotes.push(`Sócios: ${form.socios}`)
      if (form.data_abertura)     techNotes.push(`Fundada: ${new Date(form.data_abertura).toLocaleDateString('pt-BR')}`)

      const notesAll = [
        techNotes.length ? techNotes.join(' · ') : '',
        form.notes?.trim() || '',
      ].filter(Boolean).join('\n')

      const payload = {
        name:           form.name.trim(),
        trading_name:   form.trading_name.trim()   || null,
        cnpj:           form.cnpj.replace(/\D/g,'') || null,
        segment:        form.segment               || null,
        criticality:    form.criticality,
        status:         form.status,
        address:        [form.address, form.address_number, form.address_complement].filter(Boolean).join(', ') || null,
        city:           form.city                  || null,
        state:          form.state                 || null,
        zip_code:       form.zip_code.replace(/\D/g,'') || null,
        contact_name:   form.contact_name.trim()   || null,
        contact_email:  form.contact_email.trim()  || null,
        contact_phone:  form.contact_phone         || null,
        website:        form.website.trim()        || null,
        notes:          notesAll                   || null,
        observations:   form.ai_summary
                          ? `🤖 PERFIL BX (IA):\n${form.ai_summary}${form.observations?.trim() ? '\n\n' + form.observations.trim() : ''}`
                          : (form.observations?.trim() || null),
        powerbi_link:        form.powerbi_link?.trim()        || null,
        cnae:                form.cnae                         || null,
        porte:               form.porte                        || null,
        socios:              form.socios                       || null,
        data_abertura:       form.data_abertura                || null,
        situacao:            form.situacao                     || null,
        regime_tributario:   form.regime_tributario            || null,
        natureza_juridica:   form.natureza_juridica            || null,
        capital_social:      form.capital_social
                               ? Number(String(form.capital_social).replace(/[^\d.,]/g,'').replace(',','.'))
                               : null,
      }

      let data
      if (isEdit) {
        const { data: upd, error } = await supabase.from('companies').update(payload)
          .eq('id', initialData.id).eq('org_id', profile.org_id).select().single()
        if (error) throw error
        data = upd
        toast.success(`"${form.name}" atualizada ✓`)
      } else {
        const { data: ins, error } = await supabase.from('companies').insert({ org_id: profile.org_id, ...payload }).select().single()
        if (error) throw error
        data = ins
        toast.success(`"${form.name}" cadastrada ✓`)
      }
      onSave(data)
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const situacaoOk = form.situacao === 'ATIVA'
  const pctComplete = [form.name, form.cnpj, form.city, form.contact_name, form.segment]
    .filter(Boolean).length * 20

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const InputCls = "w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
  const LabelCls = "text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,16,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 720, maxHeight: '94vh', borderTop: `3px solid ${VL}` }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: VL + '15' }}>
              <Building2 className="w-4 h-4" style={{ color: VL }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-800">
                {isEdit ? (initialData.name || 'Editar Empresa') : (form.name ? form.name : 'Nova Empresa')}
              </h3>
              <p className="text-[10px] text-zinc-400">
                Busca automática Receita Federal · Perfil BX com IA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Barra de preenchimento */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pctComplete}%`, background: VL }} />
              </div>
              <span className="text-[10px] text-zinc-400 font-semibold">{pctComplete}%</span>
            </div>
            <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Tabs de seção ── */}
        <div className="flex border-b border-zinc-100 px-6 shrink-0 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ─── ABA: IDENTIFICAÇÃO ─── */}
          {activeTab === 'identificacao' && (
            <div className="space-y-4">
              {/* CNPJ com busca */}
              <div>
                <label className={LabelCls}>CNPJ — busca automática na Receita Federal</label>
                <div className="flex gap-2">
                  <input
                    className={InputCls + " flex-1 font-mono tracking-wider"}
                    placeholder="00.000.000/0000-00"
                    value={form.cnpj}
                    onChange={e => f('cnpj', fmtCNPJ(e.target.value))}
                    onKeyDown={e => e.key === 'Enter' && buscarCNPJ()}
                  />
                  <button onClick={buscarCNPJ} disabled={loadingCNPJ}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90 shrink-0"
                    style={{ background: CH }}>
                    {loadingCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {loadingCNPJ ? 'Buscando…' : 'Buscar'}
                  </button>
                </div>
                {form.situacao && (
                  <div className={`flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold ${situacaoOk ? 'text-emerald-600' : 'text-red-500'}`}>
                    <span>{situacaoOk ? '✓' : '⚠'}</span>
                    <span>Situação: {form.situacao}</span>
                    {form.data_abertura && <span className="text-zinc-400 font-normal ml-1">· Fundada: {new Date(form.data_abertura).toLocaleDateString('pt-BR')}</span>}
                  </div>
                )}
              </div>

              {/* Razão Social + Nome Fantasia */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={LabelCls}>Razão Social *</label>
                  <input className={InputCls} placeholder="Razão Social conforme CNPJ"
                    value={form.name} onChange={e => f('name', e.target.value)} autoFocus />
                </div>
                <div>
                  <label className={LabelCls}>Nome Fantasia</label>
                  <input className={InputCls} placeholder="Como a empresa é conhecida"
                    value={form.trading_name} onChange={e => f('trading_name', e.target.value)} />
                </div>
              </div>

              {/* Segmento + Criticidade + Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LabelCls}>Segmento</label>
                  <select className={InputCls} value={form.segment} onChange={e => f('segment', e.target.value)}>
                    <option value="">— selecione —</option>
                    {['Financeiro','Indústria','Varejo / Distribuição','Serviços',
                      'Construção / Imobiliário','Saúde','Tecnologia','Educação',
                      'Alimentos / Bebidas','Agronegócio','Energia','Logística','Outros'
                    ].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LabelCls}>Criticidade</label>
                  <select className={InputCls} value={form.criticality} onChange={e => f('criticality', e.target.value)}>
                    <option value="baixo">🟢 Baixo</option>
                    <option value="medio">🟡 Médio</option>
                    <option value="alto">🟠 Alto</option>
                    <option value="critico">🔴 Crítico</option>
                  </select>
                </div>
                <div>
                  <label className={LabelCls}>Status</label>
                  <select className={InputCls} value={form.status} onChange={e => f('status', e.target.value)}>
                    <option value="ativo">✅ Ativo</option>
                    <option value="prospect">🔍 Prospect</option>
                    <option value="inativo">⏸ Inativo</option>
                    <option value="arquivado">📦 Arquivado</option>
                  </select>
                </div>
              </div>

              {/* Website */}
              <div>
                <label className={LabelCls}>Website</label>
                <input className={InputCls} placeholder="https://www.empresa.com.br"
                  value={form.website} onChange={e => f('website', e.target.value)} />
              </div>

              {/* Power BI */}
              <div>
                <label className={LabelCls}>🔗 Link Power BI / Dashboard</label>
                <input className={InputCls} placeholder="https://app.powerbi.com/... ou qualquer URL de dashboard"
                  value={form.powerbi_link} onChange={e => f('powerbi_link', e.target.value)} />
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                  Cole o link de incorporação (embed) do Power BI. Ficará disponível no módulo BI.
                </p>
              </div>

              {/* Preview dados Receita */}
              {cnpjData && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    ✓ Dados carregados da Receita Federal
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-600">
                    {cnpjData.porte          && <span><b className="text-zinc-400">Porte:</b> {cnpjData.porte}</span>}
                    {cnpjData.regime_tributario && <span><b className="text-zinc-400">Regime:</b> {cnpjData.regime_tributario}</span>}
                    {cnpjData.natureza_juridica && <span><b className="text-zinc-400">Natureza:</b> {cnpjData.natureza_juridica}</span>}
                    {cnpjData.capital_social && <span><b className="text-zinc-400">Capital Social:</b> {cnpjData.capital_social}</span>}
                    {cnpjData.cnae_descricao && <span className="col-span-2"><b className="text-zinc-400">CNAE:</b> {cnpjData.cnae_descricao}</span>}
                    {cnpjData.socios_resumo  && <span className="col-span-2"><b className="text-zinc-400">Sócios:</b> {cnpjData.socios_resumo}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── ABA: LOCALIZAÇÃO ─── */}
          {activeTab === 'localizacao' && (
            <div className="space-y-4">
              {/* CEP com busca automática */}
              <div>
                <label className={LabelCls}>CEP — busca automática de endereço</label>
                <div className="flex gap-2">
                  <input className={InputCls + " flex-1 font-mono"}
                    placeholder="00000-000"
                    value={form.zip_code}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d)/, '$1-$2')
                      f('zip_code', v)
                      if (v.replace(/\D/g,'').length === 8) buscarCEP(v)
                    }}
                  />
                  <button onClick={() => buscarCEP(form.zip_code)} disabled={loadingCNPJ}
                    className="px-4 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 shrink-0"
                    style={{ background: CH }}>
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Logradouro */}
              <div>
                <label className={LabelCls}>Logradouro</label>
                <input className={InputCls} placeholder="Rua, Avenida, Alameda…"
                  value={form.address} onChange={e => f('address', e.target.value)} />
              </div>

              {/* Número + Complemento */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LabelCls}>Número</label>
                  <input className={InputCls} placeholder="123"
                    value={form.address_number} onChange={e => f('address_number', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={LabelCls}>Complemento</label>
                  <input className={InputCls} placeholder="Sala 42, Andar 5, Bloco B…"
                    value={form.address_complement} onChange={e => f('address_complement', e.target.value)} />
                </div>
              </div>

              {/* Bairro */}
              <div>
                <label className={LabelCls}>Bairro</label>
                <input className={InputCls} placeholder="Nome do bairro"
                  value={form.neighborhood} onChange={e => f('neighborhood', e.target.value)} />
              </div>

              {/* Cidade + UF */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <label className={LabelCls}>Cidade</label>
                  <input className={InputCls}
                    value={form.city} onChange={e => f('city', e.target.value)} />
                </div>
                <div>
                  <label className={LabelCls}>UF</label>
                  <input className={InputCls} placeholder="SP" maxLength={2}
                    value={form.state} onChange={e => f('state', e.target.value.toUpperCase())} />
                </div>
              </div>

              {/* Preview endereço completo */}
              {(form.address || form.city) && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1">Endereço completo</p>
                  <p className="text-sm text-zinc-700">
                    {[form.address, form.address_number, form.address_complement].filter(Boolean).join(', ')}
                    {form.neighborhood && ` — ${form.neighborhood}`}
                    {form.city && ` · ${form.city}`}
                    {form.state && `/${form.state}`}
                    {form.zip_code && ` · CEP ${form.zip_code}`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── ABA: CONTATO ─── */}
          {activeTab === 'contato' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">Contato principal da empresa para relacionamento com a BX Finance.</p>

              {/* Nome + Cargo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelCls}>Nome do Contato</label>
                  <input className={InputCls} placeholder="CEO, CFO, Dir. Financeiro…"
                    value={form.contact_name} onChange={e => f('contact_name', e.target.value)} />
                </div>
                <div>
                  <label className={LabelCls}>Cargo / Função</label>
                  <input className={InputCls} placeholder="CFO, Controller…"
                    value={form.contact_role} onChange={e => f('contact_role', e.target.value)} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={LabelCls}>Email</label>
                <input type="email" className={InputCls} placeholder="contato@empresa.com.br"
                  value={form.contact_email} onChange={e => f('contact_email', e.target.value)} />
              </div>

              {/* Telefone 1 + Telefone 2 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelCls}>Telefone principal</label>
                  <input className={InputCls} placeholder="(11) 9 9999-9999"
                    value={form.contact_phone}
                    onChange={e => f('contact_phone', fmtPhone(e.target.value))} />
                </div>
                <div>
                  <label className={LabelCls}>Telefone alternativo</label>
                  <input className={InputCls} placeholder="(11) 3000-0000"
                    value={form.contact_phone2}
                    onChange={e => f('contact_phone2', fmtPhone(e.target.value))} />
                </div>
              </div>

              {/* Website (repete para facilitar) */}
              <div>
                <label className={LabelCls}>Website</label>
                <input className={InputCls} placeholder="https://www.empresa.com.br"
                  value={form.website} onChange={e => f('website', e.target.value)} />
              </div>

              {/* Observações internas */}
              <div>
                <label className={LabelCls}>Observações internas do contato</label>
                <textarea rows={3} className={InputCls + " resize-none"}
                  placeholder="Preferências de contato, horários, histórico de relacionamento…"
                  value={form.notes} onChange={e => f('notes', e.target.value)} />
              </div>
            </div>
          )}

          {/* ─── ABA: RECEITA FEDERAL ─── */}
          {activeTab === 'receita' && (
            <div className="space-y-4">
              {!cnpjData && !form.porte && (
                <div className="text-center py-8 text-zinc-400">
                  <Search className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
                  <p className="text-sm">Busque o CNPJ na aba <b>Identificação</b> para carregar os dados da Receita Federal automaticamente.</p>
                </div>
              )}

              {(cnpjData || form.porte) && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LabelCls}>Porte</label>
                      <input className={InputCls} readOnly value={form.porte || '—'} style={{ background: '#F9FAFB' }} />
                    </div>
                    <div>
                      <label className={LabelCls}>Natureza Jurídica</label>
                      <input className={InputCls} readOnly value={form.natureza_juridica || '—'} style={{ background: '#F9FAFB' }} />
                    </div>
                    <div>
                      <label className={LabelCls}>Regime Tributário</label>
                      <input className={InputCls} readOnly value={form.regime_tributario || '—'} style={{ background: '#F9FAFB' }} />
                    </div>
                    <div>
                      <label className={LabelCls}>Data de Abertura</label>
                      <input className={InputCls} readOnly
                        value={form.data_abertura ? new Date(form.data_abertura).toLocaleDateString('pt-BR') : '—'}
                        style={{ background: '#F9FAFB' }} />
                    </div>
                    <div>
                      <label className={LabelCls}>Capital Social</label>
                      <input className={InputCls} readOnly
                        value={form.capital_social ? `R$ ${Number(form.capital_social).toLocaleString('pt-BR')}` : '—'}
                        style={{ background: '#F9FAFB' }} />
                    </div>
                    <div>
                      <label className={LabelCls}>Situação Cadastral</label>
                      <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 text-sm ${situacaoOk ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : form.situacao ? 'border-red-200 bg-red-50 text-red-700' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}>
                        <span>{situacaoOk ? '✓' : form.situacao ? '⚠' : '—'}</span>
                        <span className="font-semibold">{form.situacao || 'Não consultado'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={LabelCls}>CNAE Principal</label>
                    <input className={InputCls} readOnly value={form.cnae || '—'} style={{ background: '#F9FAFB' }} />
                  </div>

                  <div>
                    <label className={LabelCls}>Quadro Societário (QSA)</label>
                    <textarea rows={3} className={InputCls + " resize-none"} readOnly
                      value={form.socios || 'Nenhum sócio identificado'}
                      style={{ background: '#F9FAFB' }} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── ABA: PERFIL BX ─── */}
          {activeTab === 'perfil' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-zinc-700">Perfil estratégico gerado por IA</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Baseado nos dados da Receita Federal + segmento BX</p>
                </div>
                <button onClick={gerarPerfilIA} disabled={loadingAI || !form.name}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border disabled:opacity-40 hover:opacity-90"
                  style={{ background: VL + '10', color: VL, borderColor: VL + '40' }}>
                  {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loadingAI ? 'Gerando…' : '✨ Gerar Perfil BX'}
                </button>
              </div>

              <textarea rows={10}
                className={InputCls + " resize-none leading-relaxed text-zinc-700"}
                placeholder="Clique em '✨ Gerar Perfil BX' para que a IA analise os dados da Receita Federal e crie um perfil estratégico com: Perfil Operacional, Indicadores de Risco, Serviços BX Aplicáveis e Próximos Passos."
                value={form.ai_summary}
                onChange={e => f('ai_summary', e.target.value)} />

              <div>
                <label className={LabelCls}>Observações adicionais da equipe BX</label>
                <textarea rows={3} className={InputCls + " resize-none"}
                  placeholder="Contexto do mandato, histórico de relacionamento, informações estratégicas…"
                  value={form.observations}
                  onChange={e => f('observations', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-zinc-100 px-6 py-4 bg-white">
          {/* Navegação entre abas */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {activeTab !== 'identificacao' && (
                <button onClick={() => {
                  const idx = TABS.findIndex(t => t.id === activeTab)
                  if (idx > 0) setActiveTab(TABS[idx-1].id)
                }}
                  className="px-3 py-2 text-sm text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50">
                  ← Voltar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2.5 text-sm text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50">
                Cancelar
              </button>
              {activeTab !== 'perfil' ? (
                <button onClick={() => {
                  const idx = TABS.findIndex(t => t.id === activeTab)
                  if (idx < TABS.length - 1) setActiveTab(TABS[idx+1].id)
                }}
                  className="px-4 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90"
                  style={{ background: VL }}>
                  Próximo →
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90"
                  style={{ background: VL }}>
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : isEdit ? '💾 Salvar Alterações' : '+ Cadastrar Empresa'}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}


export function NovoColaboradorModal({ onClose, onSave, initialData }) {
  const { profile } = useData()
  const isEdit = !!initialData

  const [form, setForm] = useState(() => {
    if (initialData) {
      return {
        full_name:   initialData.full_name   || '',
        email:       initialData.email       || '',
        role:        initialData.role        || 'analyst',
        cargo:       initialData.cargo       || '',
        phone:       initialData.phone       || '',
        cpf:         '',
        linkedin:    initialData.linkedin    || '',
        department:  initialData.department  || '',
        specialties: Array.isArray(initialData.specialties) ? initialData.specialties : [],
        entry_date:  initialData.entry_date  || '',
        notes:       initialData.notes || '',
        ai_bio:      initialData.about_me || '',
      }
    }
    return {
      full_name: '', email: '', role: 'analyst', cargo: '',
      phone: '', cpf: '', linkedin: '', department: '',
      specialties: [], entry_date: '', notes: '', ai_bio: '',
    }
  })
  const [newSpec,    setNewSpec]    = useState('')
  const [loadingAI,  setLoadingAI]  = useState(false)
  const [saving,     setSaving]     = useState(false)

  async function gerarBioIA() {
    if (!form.full_name) { toast.warning('Preencha o nome'); return }
    setLoadingAI(true)
    try {
      const prompt = `Você é o head de pessoas da BX Finance, responsável por posicionar a equipe com excelência perante clientes, parceiros e o mercado financeiro. Sua missão é criar bios que transmitam credibilidade, expertise e o DNA da BX — direto, técnico e orientado a resultado.

Gere uma BIO PROFISSIONAL COMPLETA para este colaborador da BX Finance. Use emojis para estruturar e dê personalidade ao texto — evite linguagem genérica de RH.

DADOS DO COLABORADOR:
- Nome: ${form.full_name}
- Cargo/Função: ${form.cargo || 'não informado'}
- Nível: ${ROLES.find(r => r.value === form.role)?.label || form.role}
- Departamento: ${form.department || 'não informado'}
- Especialidades: ${form.specialties.join(', ') || 'não informadas'}
- LinkedIn: ${form.linkedin || 'não informado'}
${form.notes ? '- Contexto adicional: ' + form.notes : ''}

Responda APENAS com a bio estruturada. Use exatamente esta estrutura:

👤 **APRESENTAÇÃO**
[2-3 frases em terceira pessoa descrevendo quem é, formação/background e o que faz de melhor na BX. Tom: confiante, técnico, sem clichês.]

🎯 **ESPECIALIZAÇÃO BX**
[Liste 3-5 áreas de atuação com profundidade. Ex: "Diagnóstico financeiro em empresas mid-market com faturamento entre R$ 50M-500M", "Modelagem financeira integrada (DRE/BP/FC)", "Relacionamento com credores em processos de RJ"]

💡 **DIFERENCIAL**
[1-2 frases sobre o que este profissional faz diferente — o que o torna valioso para o cliente da BX]

📊 **CASES E RESULTADOS**
[Se as especialidades permitirem inferir: exemplos de resultados típicos que este perfil entrega. Seja específico em números e impacto quando possível.]

🤝 **PARA CLIENTES**
[1 frase sobre como este profissional agrega valor na relação com o cliente — linguagem de pitch executivo]`

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
    if (!form.full_name.trim()) {
      toast.warning('Nome é obrigatório')
      return
    }
    // email required only on create, not edit (email is auth identifier, not updated)
    if (!isEdit && !form.email.trim()) {
      toast.warning('Email é obrigatório para novo colaborador')
      return
    }
    setSaving(true)
    try {
      // Payload com colunas dedicadas da tabela profiles
      const payload = {
        full_name:   form.full_name.trim(),
        role:        form.role,
        cargo:       form.cargo        || null,
        phone:       form.phone        || null,
        cpf:         form.cpf?.replace(/\D/g,'') || null,
        linkedin:    form.linkedin     || null,
        department:  form.department   || null,
        specialties: form.specialties?.length ? form.specialties : null,
        entry_date:  form.entry_date   || null,
        notes:       form.notes?.trim() || null,
        about_me:    form.ai_bio       || null,
      }
      let data
      if (isEdit) {
        // No .select().single() — RLS can block the read back even when UPDATE succeeds
        const { error } = await supabase.from('profiles').update(payload)
          .eq('id', initialData.id).eq('org_id', profile.org_id)
        if (error) throw error
        // Return merged object since we can't read it back
        data = { ...initialData, ...payload }
        toast.success(`"${form.full_name}" atualizado ✓`)
      } else {
        const { data: ins, error } = await supabase.from('profiles').insert({
          org_id: profile.org_id,
          email:  form.email.trim().toLowerCase(),
          avatar_color: ['#5452C1','#10B981','#F59E0B','#3B82F6','#8B5CF6','#EF4444'][Math.floor(Math.random()*6)],
          ...payload,
        }).select().single()
        if (error) throw error
        data = ins
        toast.success(`Colaborador "${form.full_name}" cadastrado ✓`)
      }
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
              <h3 className="text-base font-bold text-zinc-800">{isEdit ? `Editar — ${initialData.full_name}` : 'Novo Colaborador'}</h3>
              <p className="text-[10px] text-zinc-400">{isEdit ? 'Edite o perfil completo com todos os campos' : 'Perfil completo + Bio profissional com IA'}</p>
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
          <button onClick={handleSave} disabled={saving || !form.full_name.trim() || (!isEdit && !form.email.trim())}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: '#10B981' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : isEdit ? '💾 Salvar Alterações' : '+ Cadastrar Colaborador'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL NOVO PROJETO
// ══════════════════════════════════════════════════════════════════════════════
export function NovoProjetoModal({ onClose, onSave, companies, profiles, initialData }) {
  const { profile } = useData()
  const isEdit = !!initialData

  // Pre-fill form when editing an existing project
  const [form, setForm] = useState(() => {
    if (initialData) {
      // Extract ai_scope from observacoes if it was embedded there
      const obs = initialData.observacoes || ''
      const scopeIdx = obs.indexOf('\n\n---\n🤖 ESCOPO IA:\n')
      const cleanObs = scopeIdx > -1 ? obs.slice(0, scopeIdx).trim() : obs
      const aiScope  = scopeIdx > -1 ? obs.slice(scopeIdx + '\n\n---\n🤖 ESCOPO IA:\n'.length).trim() : ''
      return {
        name:        initialData.name        || '',
        type:        initialData.type        || 'Diagnóstico',
        status:      initialData.status      || 'Planejamento',
        deadline:    initialData.deadline    ? initialData.deadline.slice(0, 10) : '',
        budget:      initialData.budget      ? String(initialData.budget) : '',
        company_id:  initialData.company_id  || '',
        analyst_id:  initialData.analyst_id  || '',
        associate_id:initialData.associate_id|| '',
        priority:    initialData.priority    || 'medium',
        observacoes: cleanObs,
        ai_scope:    aiScope,
      }
    }
    return {
      name: '', type: 'Diagnóstico', status: 'Planejamento',
      deadline: '', budget: '', company_id: '', analyst_id: '',
      associate_id: '', priority: 'medium', observacoes: '',
      ai_scope: '',
    }
  })
  const [loadingAI, setLoadingAI] = useState(false)
  const [saving,    setSaving]    = useState(false)

  async function gerarEscopoIA() {
    if (!form.type) { toast.warning('Selecione o tipo de projeto'); return }
    setLoadingAI(true)
    try {
      const empresa = companies.find(c => c.id === form.company_id)
      const prompt = `Você é um sócio-fundador da BX Finance com mais de 15 anos estruturando mandatos de advisory financeiro mid-market. Você já liderou diagnósticos que revelaram situações críticas, reestruturações que salvaram empresas, processos de RJ que criaram valor real e M&As que transformaram trajetórias empresariais.

IMPORTANTE: Use a busca web para pesquisar a empresa cliente e o contexto de mercado ANTES de escrever o escopo.\n\nGere um ESCOPO BX PROPRIETÁRIO para este mandato. Seja técnico, direto e use emojis. Cada seção deve refletir o que uma equipe sênior realmente faria — nada de escopo genérico de consultoria.

TIPO DE MANDATO: ${form.type}
EMPRESA CLIENTE: ${empresa?.name || 'a definir'}${empresa?.segment ? ` | ${empresa.segment}` : ''}${empresa?.city ? ` | ${empresa.city}/${empresa.state}` : ''}${empresa?.notes ? '\n📋 Perfil: ' + empresa.notes.slice(0,500) : ''}
${form.observacoes ? '\n💬 Contexto: ' + form.observacoes : ''}

Responda APENAS com o escopo. Use exatamente esta estrutura:

🎯 **OBJETIVO DO MANDATO**
[1-2 frases cirúrgicas: o que a BX vai entregar de concreto? Qual transformação o cliente vai experimentar?]

🔍 **HIPÓTESES INICIAIS**
[O que provavelmente vamos encontrar neste tipo de mandato? Quais são as dores mais comuns que este tipo de empresa/mandato revela? Seja específico.]

🏗️ **ESCOPO TÉCNICO BX**
[6-8 atividades com nomenclatura técnica correta: "Análise Fleuriet (NCG/CDG/ST)", "Modelagem de DRE gerencial por unidade de negócio", "Análise de covenants e inadimplência técnica", "Mapeamento de endividamento e perfil da dívida", etc.]

📦 **ENTREGAS BX**
[5-7 produtos concretos com nome específico: "Relatório Executivo de Diagnóstico Financeiro", "Modelo financeiro integrado — 3 cenários (base/otimista/pessimista)", "Roadmap de reestruturação com cronograma de execução", etc.]

⚠️ **RISCOS E MITIGAÇÕES**
[4-5 riscos reais deste mandato + ação de mitigação que a BX adota para cada um]

⏱️ **CRONOGRAMA BX**
[Fases com duração: Fase 1 — Onboarding e coleta de dados (X dias), Fase 2 — Análise e modelagem (X semanas), Fase 3 — Relatório e apresentação (X dias)]

💰 **MÉTRICAS DE SUCESSO**
[Como a BX e o cliente vão medir o êxito: KPIs específicos, marcos de entrega, indicadores de impacto]

🤝 **EQUIPE BX SUGERIDA**
[Papéis e responsabilidades: sócio (qual papel), analista sênior (o que faz), analista júnior (o que faz), estimativa de horas por fase]`

      const text = await callClaude(prompt, true)
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
      const payload = {
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
      }
      let data
      if (isEdit) {
        const { data: upd, error } = await supabase.from('projects').update(payload)
          .eq('id', initialData.id).eq('org_id', profile.org_id).select().single()
        if (error) throw error
        data = upd
        toast.success(`Projeto "${form.name}" atualizado ✓`)
      } else {
        const { data: ins, error } = await supabase.from('projects').insert({ org_id: profile.org_id, ...payload }).select().single()
        if (error) throw error
        data = ins
        toast.success(`Projeto "${form.name}" criado ✓`)
      }
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
              <h3 className="text-base font-bold text-zinc-800">{isEdit ? 'Editar Projeto' : 'Novo Projeto'}</h3>
              <p className="text-[10px] text-zinc-400">{isEdit ? 'Edite todos os campos do projeto' : 'Estruturação + Escopo BX gerado por IA'}</p>
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
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : isEdit ? '💾 Salvar Alterações' : '+ Criar Projeto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL NOVA INSTITUIÇÃO — com website scraping + IA + nível de relacionamento
// ══════════════════════════════════════════════════════════════════════════════
export function NovaInstituicaoModal({ onClose, onSave, initialData }) {
  const { profile } = useData()
  const isEdit = !!initialData

  const [form, setForm] = useState(() => {
    if (initialData) {
      // Parse stored notes back into structured fields
      const raw = initialData.notes || ''
      const linhasMatch = raw.match(/Linhas: ([^\n]+)/)
      const nivelMatch  = raw.match(/Nível BX: ([^\n]+)/)
      const aiIdx       = raw.indexOf('---\n🤖 PERFIL IA:\n')
      const linhas = linhasMatch ? linhasMatch[1].split(', ').filter(Boolean) : []
      const nivelLabel = nivelMatch ? nivelMatch[1] : ''
      const NIVEIS_MAP = {
        'Sem relacionamento': 1, 'Contato inicial': 2,
        'Relacionamento ativo': 3, 'Parceiro estratégico': 4, 'Parceiro premium': 5
      }
      const nivel = NIVEIS_MAP[nivelLabel] || 3
      const aiProfile = aiIdx > -1 ? raw.slice(aiIdx + '---\n🤖 PERFIL IA:\n'.length).trim() : ''
      // Clean notes: remove parsed sections
      const cleanNotes = raw
        .replace(/\nLinhas: [^\n]+/, '').replace(/\nNível BX: [^\n]+/, '')
        .replace(/\n\n---\n🤖 PERFIL IA:[\s\S]*/, '').trim()
      return {
        name:               initialData.name          || '',
        type:               initialData.type          || 'Banco Comercial',
        website:            '',
        contact_name:       initialData.contact_name  || '',
        contact_email:      initialData.contact_email || '',
        contact_phone:      initialData.contact_phone || '',
        linhas_operadas:    linhas,
        nivel_relacionamento: nivel,
        notas_estrategicas: cleanNotes,
        ai_profile:         aiProfile,
        notes:              '',
      }
    }
    return {
      name: '', type: 'Banco Comercial', website: '',
      contact_name: '', contact_email: '', contact_phone: '',
      linhas_operadas: [], nivel_relacionamento: 3,
      notas_estrategicas: '', ai_profile: '', notes: '',
    }
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
      const prompt = `Você é o head de relacionamento bancário da BX Finance e um dos maiores especialistas do Brasil em crédito corporativo mid-market. Você já estruturou centenas de operações com bancos comerciais, FIDCs, fundos de crédito e gestoras, e conhece profundamente o apetite, os critérios reais e as pessoas de cada instituição.

Gere um PERFIL ESTRATÉGICO COMPLETO desta instituição financeira para uso interno da BX. Este é um documento de inteligência — deve ser prático, específico e orientado a ação. Nada genérico.

INSTITUIÇÃO: ${form.name}
TIPO: ${form.type}
WEBSITE: ${form.website || 'não informado'}
LINHAS MAPEADAS: ${form.linhas_operadas.join(', ') || 'não informadas ainda'}
NÍVEL DE RELACIONAMENTO ATUAL: ${NIVEIS.find(n => n.v === form.nivel_relacionamento)?.label || '—'}
${form.notas_estrategicas ? 'NOTAS DA EQUIPE BX: ' + form.notas_estrategicas : ''}

Responda APENAS com o perfil. Use exatamente esta estrutura com emojis BX:

🏦 **POSICIONAMENTO DA INSTITUIÇÃO**
[3-4 frases: quem são realmente, nicho de mercado específico, apetite de crédito atual, diferencial competitivo e onde se posicionam vis-à-vis concorrentes diretos no mid-market]

💳 **LINHAS E PRODUTOS — ANÁLISE BX**
[Para cada linha relevante para clientes BX: nome da linha, ticket mínimo/máximo, prazo típico, garantias exigidas, taxa de referência (CDI+, IPCA+, etc.), público ideal desta linha, quão acessível é para empresas em reestruturação]

📋 **CRITÉRIOS DE CRÉDITO REAIS**
[O que esta instituição realmente exige — não o que está no site, mas o que aprovam na prática: rating mínimo, cobertura de garantia, EBITDA mínimo, receita bruta, tempo de operação, histórico bancário, setores preferenciais, setores absolutamente evitados]

🤝 **TÁTICAS DE RELACIONAMENTO BX**
[Quem acionar (área específica, cargo típico do interlocutor), como se apresentar, qual ângulo usar para introduzir clientes BX, o que NUNCA falar na primeira reunião, como construir e acelerar o relacionamento, frequência ideal de contato]

⚡ **VELOCIDADE E PROCESSO**
[Quanto tempo leva do primeiro contato até a aprovação? Quais são os gargalos reais do processo interno? Quais documentos pedem cedo? Como a BX pode acelerar?]

💡 **CASES IDEAIS PARA ESTA INSTITUIÇÃO**
[Que tipo de empresa e situação esta instituição mais gosta de receber? Descreva o cliente perfeito para apresentar aqui — segmento, porte, garantias, momento da empresa]

⚠️ **ALERTAS INTERNOS BX**
[Restrições setoriais confirmadas, situações que já geraram problemas, condições que encarecem muito a operação, quando definitivamente NÃO apresentar um cliente aqui]

🌡️ **APETITE DE MERCADO ATUAL**
[Como esta instituição está se comportando no ciclo atual de crédito: expandindo ou restringindo, setores em foco, postura geral, temperatura para empresas em distress ou reestruturação]`

      const text = await callClaude(prompt, true)
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
        form.notas_estrategicas?.trim() || form.notes?.trim() || '',
        form.linhas_operadas.length ? `Linhas: ${form.linhas_operadas.join(', ')}` : '',
        form.nivel_relacionamento ? `Nível BX: ${NIVEIS.find(n => n.v === form.nivel_relacionamento)?.label}` : '',
        form.ai_profile ? `---\n🤖 PERFIL IA:\n${form.ai_profile}` : '',
      ].filter(Boolean).join('\n\n').trim()

      const payload = {
        name:          form.name.trim(),
        type:          form.type,
        contact_name:  form.contact_name.trim()  || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone        || null,
        notes:         notesComposed             || null,
      }

      let data
      if (isEdit) {
        const { data: upd, error } = await supabase.from('institutions').update(payload)
          .eq('id', initialData.id).eq('org_id', profile.org_id).select().single()
        if (error) throw error
        data = upd
        toast.success(`Instituição "${form.name}" atualizada ✓`)
      } else {
        const { data: ins, error } = await supabase.from('institutions').insert({
          org_id: profile.org_id, is_active: true, ...payload,
        }).select().single()
        if (error) throw error
        data = ins
        toast.success(`Instituição "${form.name}" cadastrada ✓`)
      }
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
              <h3 className="text-base font-bold text-zinc-800">{isEdit ? `Editar — ${initialData.name}` : 'Nova Instituição Financeira'}</h3>
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
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : isEdit ? '💾 Salvar Alterações' : '+ Cadastrar Instituição'}
          </button>
        </div>
      </div>
    </div>
  )
}
