import { describe, it, expect } from 'vitest'
import { optimizeImageUrl } from '../imageOptimizer'

describe('imageOptimizer utility', () => {
  it('optimizes Pexels URLs with sizing and compression parameters', () => {
    const raw = 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress'
    const optimized = optimizeImageUrl(raw, 500)

    const url = new URL(optimized)
    expect(url.hostname).toBe('images.pexels.com')
    expect(url.searchParams.get('w')).toBe('500')
    expect(url.searchParams.get('auto')).toBe('format,compress')
    expect(url.searchParams.get('q')).toBe('80')
  })

  it('optimizes Unsplash URLs with sizing and format parameters', () => {
    const raw = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-1.2.1'
    const optimized = optimizeImageUrl(raw, 600)

    const url = new URL(optimized)
    expect(url.hostname).toBe('images.unsplash.com')
    expect(url.searchParams.get('w')).toBe('600')
    expect(url.searchParams.get('auto')).toBe('format')
    expect(url.searchParams.get('q')).toBe('80')
    expect(url.searchParams.get('ixlib')).toBe('rb-1.2.1') // preserves existing params
  })

  it('leaves Supabase Storage URLs completely unchanged', () => {
    const supabaseUrl = 'https://xyzproject.supabase.co/storage/v1/object/public/cafe-images/menu-items/abc123.jpg'
    expect(optimizeImageUrl(supabaseUrl)).toBe(supabaseUrl)
  })

  it('leaves arbitrary unknown external URLs completely unchanged', () => {
    const externalUrl = 'https://cdn.mycafe.com/dishes/latte.png?v=2'
    expect(optimizeImageUrl(externalUrl)).toBe(externalUrl)
  })

  it('leaves relative paths unchanged', () => {
    expect(optimizeImageUrl('/assets/coffee.png')).toBe('/assets/coffee.png')
    expect(optimizeImageUrl('assets/coffee.png')).toBe('assets/coffee.png')
  })

  it('safely handles empty, null, or undefined values', () => {
    expect(optimizeImageUrl('')).toBe('')
    expect(optimizeImageUrl(null)).toBe('')
    expect(optimizeImageUrl(undefined)).toBe('')
    expect(optimizeImageUrl('   ')).toBe('')
  })

  it('safely returns malformed URLs without throwing exceptions', () => {
    expect(optimizeImageUrl('http://:invalid-url')).toBe('http://:invalid-url')
  })
})
