import { CustomerRank, RANK_CONFIG } from '@/types'

interface Props { rank: CustomerRank; size?: 'sm' | 'md' | 'lg' }

export default function CustomerRankBadge({ rank, size = 'md' }: Props) {
  const config = RANK_CONFIG[rank]
  const sizeClasses = { sm: 'text-[10px] px-1.5 py-0.5', md: 'text-xs px-2 py-0.5', lg: 'text-sm px-3 py-1' }

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg font-semibold ${sizeClasses[size]}`} style={{ background: config.bg, border: `1px solid ${config.color}30`, color: config.color }}>
      <span>{config.icon}</span><span>{config.label}</span>
    </span>
  )
}
