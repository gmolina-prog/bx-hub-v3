/**
 * GaugeChart — componente reutilizável de semicírculo
 * Usado em: Dashboard (Saúde Operacional) e Riscos (Exposição)
 *
 * Props:
 *   value      — número exibido no centro (0–100 para pct, ou score absoluto)
 *   pct        — porcentagem 0–100 que controla o preenchimento do arco
 *   label      — texto abaixo do valor
 *   color      — cor do arco preenchido (hex)
 *   trackColor — cor do arco de fundo (default: '#E8E8EE')
 *   size       — 'sm' (120×70) | 'md' (180×105) | 'lg' (220×130)  default: 'md'
 *   gradient   — se true, usa gradiente vermelho→âmbar→verde
 *   suffix     — string após o valor (ex: '%')
 *   dark       — se true, usa trackColor escuro (#FFFFFF22) — para fundos escuros
 */

const RED   = '#EF4444'
const AMBER = '#F59E0B'
const GREEN = '#10B981'
const VL    = '#5452C1'

const SIZES = {
  sm: { w: 120, h: 70,  r: 46,  sw: 8,  fs: 18, fl: 9  },
  md: { w: 180, h: 105, r: 70,  sw: 10, fs: 28, fl: 11 },
  lg: { w: 220, h: 130, r: 86,  sw: 12, fs: 42, fl: 12 },
}

export default function GaugeChart({
  value,
  pct,
  label    = '',
  color,
  trackColor,
  size     = 'md',
  gradient = false,
  suffix   = '',
  dark     = false,
}) {
  const s   = SIZES[size] || SIZES.md
  const cx  = s.w / 2
  // Baseline: deixar o arco com margem em cima (raio + 4px) e pequena margem embaixo (4px)
  const cy  = s.r + 4
  const svgH = cy + 4   // altura total necessária: cy + margem inferior
  const pctClamped = Math.max(0, Math.min(100, pct ?? 0)) / 100

  // Ponto final do arco
  const angle = Math.PI * pctClamped
  const ex = cx + s.r * Math.cos(Math.PI - angle)
  const ey = cy - s.r * Math.sin(Math.PI - angle)
  const large = pctClamped > 0.5 ? 1 : 0

  // Arco de fundo: de esquerda (180°) até direita (0°)
  const x0 = cx - s.r
  const x1 = cx + s.r

  const track = trackColor || (dark ? '#FFFFFF22' : '#E8E8EE')
  const fill  = color || (gradient ? `url(#gaugeGrad_${size})` : VL)

  // Posição do texto: centralizado no centro do semicírculo
  // value: um pouco acima do cy, label: abaixo do value
  const valueY = cy - s.r * 0.22
  const labelY = cy - s.r * 0.22 + s.fs * 0.9 + 4

  return (
    <svg
      width={s.w}
      height={svgH}
      viewBox={`0 0 ${s.w} ${svgH}`}
      style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}
    >
      {gradient && (
        <defs>
          <linearGradient id={`gaugeGrad_${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={RED}   />
            <stop offset="50%"  stopColor={AMBER} />
            <stop offset="100%" stopColor={GREEN} />
          </linearGradient>
        </defs>
      )}

      {/* Track (fundo cinza/transparente) */}
      <path
        d={`M ${x0} ${cy} A ${s.r} ${s.r} 0 0 1 ${x1} ${cy}`}
        stroke={track}
        strokeWidth={s.sw}
        fill="none"
        strokeLinecap="round"
      />

      {/* Arco preenchido */}
      {pctClamped > 0 && (
        <path
          d={`M ${x0} ${cy} A ${s.r} ${s.r} 0 ${large} 1 ${ex} ${ey}`}
          stroke={fill}
          strokeWidth={s.sw}
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Valor */}
      <text
        x={cx}
        y={valueY}
        fontSize={s.fs}
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color || VL}
        fontFamily="Montserrat, sans-serif"
      >
        {value}{suffix}
      </text>

      {/* Label */}
      {label && (
        <text
          x={cx}
          y={labelY}
          fontSize={s.fl}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={dark ? '#AAAAAA' : '#999999'}
          fontFamily="Montserrat, sans-serif"
        >
          {label}
        </text>
      )}
    </svg>
  )
}
