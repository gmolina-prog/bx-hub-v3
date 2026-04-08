import React from 'react'
import { FileText } from 'lucide-react'

// ============================================================================
// Notas.jsx — Placeholder
// ----------------------------------------------------------------------------
// Módulo aguardando implementação (Round 6 - polimento).
// Estrutura preservada para não quebrar navegação e roteamento.
// ============================================================================

export default function Notas() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 mb-6 text-white">
        <div className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-2">
          <FileText className="w-3 h-3" />
          Em desenvolvimento
        </div>
        <h1 className="text-2xl font-bold mb-1">📒 Notas e Reuniões</h1>
        <p className="text-sm text-zinc-300">Módulo será enriquecido no Round 6 do projeto.</p>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
        <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
        <div className="text-sm font-bold text-zinc-700">Notas e Reuniões — Em breve</div>
        <div className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
          Este módulo está reservado no roteamento e será implementado na próxima rodada.
          A navegação e a estrutura já estão funcionando.
        </div>
      </div>
    </div>
  )
}
