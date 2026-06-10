import { CustomerAchievement } from '@/types'
import { Trophy } from 'lucide-react'

interface Props { achievements: CustomerAchievement[] }

export default function CustomerAchievements({ achievements }: Props) {
  if (achievements.length === 0) return null

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
      <div className="flex items-center gap-2 mb-3"><Trophy size={16} style={{ color: 'var(--ps-gold)' }} /><h2 className="font-semibold text-sm">الإنجازات</h2></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {achievements.map(a => (
          <div key={a.id} className="rounded-xl p-3 text-center" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
            <span className="text-2xl">{a.achievement?.icon}</span>
            <p className="text-xs font-medium mt-1">{a.achievement?.name}</p>
            <p className="text-[10px] text-ps-muted">+{a.achievement?.reward_points} نقطة</p>
          </div>
        ))}
      </div>
    </div>
  )
}
