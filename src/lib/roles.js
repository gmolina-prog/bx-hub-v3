// ─── Roles e Cargos BX Group ────────────────────────────────────────────────
// Centralizado aqui para consistência em Admin, Cadastro, Configuracoes

export const ROLES = [
  { value: 'owner',   label: 'Owner / Sócio',  color: 'bg-violet-100 text-violet-700',  desc: 'Acesso total. Recebe alertas de emergência.' },
  { value: 'gerente', label: 'Gerente',         color: 'bg-amber-100 text-amber-700',   desc: 'Acesso gerencial. Recebe alertas de emergência.' },
  { value: 'analyst', label: 'Analista',        color: 'bg-sky-100 text-sky-700',       desc: 'Acesso operacional padrão.' },
]

export const CARGO_OPTIONS = [
  'Managing Partner', 'Sócio', 'Diretor',
  'Gerente', 'Gerente Sênior',
  'Consultor Sênior', 'Consultor', 'Consultor Tributário',
  'Analista Sênior', 'Analista Financeiro', 'Analista Contábil', 'Analista',
  'Assistente Financeira', 'Assistente Administrativa', 'Assistente',
  'Estagiário', 'Outro',
]

// Backward compat: normalizar roles legados
export function normalizeRole(role) {
  if (!role) return 'analyst'
  if (role === 'Gerente') return 'gerente'
  if (role === 'admin')   return 'owner'
  return role
}

// Retorna true se o role tem permissão de liderança (recebe alertas de emergência)
export function isLeaderRole(role) {
  return ['owner', 'gerente', 'Gerente', 'admin'].includes(role)
}
