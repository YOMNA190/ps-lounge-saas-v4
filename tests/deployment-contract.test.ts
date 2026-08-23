import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
  outputDirectory?: string
  rewrites?: Array<{ source: string; destination: string }>
}
const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8')

describe('Vercel deployment contract', () => {
  it('serves the compiled Vite output and keeps SPA deep links on index.html', () => {
    expect(vercelConfig.outputDirectory).toBe('dist')
    expect(vercelConfig.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' })
    expect(viteConfig).toContain("base: '/'")
  })
})
