import { describe, expect, it } from 'vitest'
import { elapsedSeconds, formatElapsedTime } from './clock'

describe('clock helpers', () => {
  it('formats elapsed time from a shared clock tick', () => {
    expect(formatElapsedTime(3661)).toBe('01:01:01')
  })

  it('does not allow clock skew to produce a negative session duration', () => {
    expect(elapsedSeconds('2026-08-23T12:00:10.000Z', Date.parse('2026-08-23T12:00:00.000Z'))).toBe(0)
  })
})
