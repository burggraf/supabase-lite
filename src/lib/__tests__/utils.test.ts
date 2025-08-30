import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn, getBaseUrl, formatBytes } from '../utils'

describe('getBaseUrl', () => {
  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:5173'
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return window.location.origin when window is available', () => {
    expect(getBaseUrl()).toBe('http://localhost:5173')
  })

  it('should return empty string when window is undefined', () => {
    const originalWindow = global.window
    // @ts-expect-error - Intentionally setting window to undefined for testing
    global.window = undefined

    expect(getBaseUrl()).toBe('')

    global.window = originalWindow
  })

  it('should work with different origins', () => {
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://supabase-lite.pages.dev'
      },
      writable: true
    })

    expect(getBaseUrl()).toBe('https://supabase-lite.pages.dev')
  })

  it('should work with localhost on different ports', () => {
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000'
      },
      writable: true
    })

    expect(getBaseUrl()).toBe('http://localhost:3000')
  })
})

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(1073741824)).toBe('1 GB')
  })
})

describe('cn utility function', () => {
  it('should combine class names correctly', () => {
    const result = cn('class1', 'class2', 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  it('should handle conditional classes', () => {
    const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
    expect(result).toBe('base-class conditional-class')
  })

  it('should handle undefined and null values', () => {
    const result = cn('base-class', undefined, null, 'valid-class')
    expect(result).toBe('base-class valid-class')
  })

  it('should handle empty strings', () => {
    const result = cn('base-class', '', 'valid-class')
    expect(result).toBe('base-class valid-class')
  })

  it('should handle arrays of classes', () => {
    const result = cn(['class1', 'class2'], 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  it('should handle objects with boolean values', () => {
    const result = cn({
      'base-class': true,
      'active': true,
      'disabled': false,
      'hidden': false,
    })
    expect(result).toBe('base-class active')
  })

  it('should handle mixed input types', () => {
    const result = cn(
      'base-class',
      ['array-class1', 'array-class2'],
      {
        'object-class': true,
        'disabled': false,
      },
      true && 'conditional-class',
      false && 'hidden-class'
    )
    expect(result).toBe('base-class array-class1 array-class2 object-class conditional-class')
  })

  it('should handle no arguments', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle single class name', () => {
    const result = cn('single-class')
    expect(result).toBe('single-class')
  })

  it('should handle duplicate classes (clsx behavior)', () => {
    const result = cn('class1', 'class2', 'class1', 'class3', 'class2')
    // clsx doesn't deduplicate by default, it just concatenates
    expect(result).toBe('class1 class2 class1 class3 class2')
  })

  it('should handle whitespace in class names (clsx behavior)', () => {
    const result = cn('  class1  ', '  class2  ')
    // clsx preserves whitespace within individual strings
    expect(result).toBe('  class1     class2  ')
  })
})