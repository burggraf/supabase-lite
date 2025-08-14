import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

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