import { describe, it, expect } from 'vitest'
import { parseOperatorValue } from '../operators'

describe('PostgREST Operators', () => {
  describe('IN operator parsing', () => {
    it('should handle PostgreSQL-style quoted syntax', () => {
      const { parsedValue } = parseOperatorValue('in', '("Han","Yoda")')
      expect(parsedValue).toEqual(['Han', 'Yoda'])
    })

    it('should handle quoted values without outer parentheses', () => {
      const { parsedValue } = parseOperatorValue('in', '"Han","Yoda"')
      expect(parsedValue).toEqual(['Han', 'Yoda'])
    })

    it('should handle simple comma-separated values', () => {
      const { parsedValue } = parseOperatorValue('in', 'Han,Yoda')
      expect(parsedValue).toEqual(['Han', 'Yoda'])
    })

    it('should handle values with parentheses but no quotes', () => {
      const { parsedValue } = parseOperatorValue('in', '(Han,Yoda)')
      expect(parsedValue).toEqual(['Han', 'Yoda'])
    })

    it('should handle numeric values with quotes', () => {
      const { parsedValue } = parseOperatorValue('in', '("1","3")')
      expect(parsedValue).toEqual([1, 3])
    })

    it('should handle numeric values without quotes', () => {
      const { parsedValue } = parseOperatorValue('in', '(1,3)')
      expect(parsedValue).toEqual([1, 3])
    })

    it('should handle mixed quoted/unquoted numeric values', () => {
      const { parsedValue } = parseOperatorValue('in', '("1",3)')
      expect(parsedValue).toEqual([1, 3])
    })

    it('should handle single quoted values', () => {
      const { parsedValue } = parseOperatorValue('in', "('Han','Yoda')")
      expect(parsedValue).toEqual(['Han', 'Yoda'])
    })

    it('should handle values with spaces', () => {
      const { parsedValue } = parseOperatorValue('in', '(" Luke ")')
      expect(parsedValue).toEqual([' Luke '])
    })

    it('should handle empty string values', () => {
      const { parsedValue } = parseOperatorValue('in', '("")')
      expect(parsedValue).toEqual([''])
    })

    it('should handle single value', () => {
      const { parsedValue } = parseOperatorValue('in', '("Han")')
      expect(parsedValue).toEqual(['Han'])
    })

    it('should handle values with special characters', () => {
      const { parsedValue } = parseOperatorValue('in', '("O\'Reilly","D\'Angelo")')
      expect(parsedValue).toEqual(["O'Reilly", "D'Angelo"])
    })
  })
})