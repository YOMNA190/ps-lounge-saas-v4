export function elapsedSeconds(startedAt: string | undefined, now: number): number {
  if (!startedAt) return 0
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
}

export function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
}
