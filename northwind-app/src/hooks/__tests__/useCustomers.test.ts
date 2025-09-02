import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCustomers, useCustomer, useCustomerStats, useCustomerManagement } from '../useCustomers'
import { CustomerRepository } from '../../lib/database/repositories'

// Mock the CustomerRepository
vi.mock('../../lib/database/repositories', () => ({
  CustomerRepository: vi.fn(() => ({
    searchCustomers: vi.fn(),
    findById: vi.fn(),
    getCustomerOrderStats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }))
}))

describe('useCustomers hooks', () => {
  let queryClient: QueryClient
  let mockRepository: any

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  )

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    mockRepository = {
      searchCustomers: vi.fn(),
      findById: vi.fn(),
      getCustomerOrderStats: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }

    vi.mocked(CustomerRepository).mockImplementation(() => mockRepository)
  })

  describe('useCustomers', () => {
    it('should fetch customers with default options', async () => {
      const mockCustomers = {
        data: [
          { customer_id: 'ALFKI', company_name: 'Alfreds Futterkiste' },
          { customer_id: 'ANATR', company_name: 'Ana Trujillo Emparedados' }
        ],
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1
      }

      mockRepository.searchCustomers.mockResolvedValue(mockCustomers)

      const { result } = renderHook(() => useCustomers(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockRepository.searchCustomers).toHaveBeenCalledWith({})
      expect(result.current.data).toEqual(mockCustomers)
    })

    it('should fetch customers with filters and pagination', async () => {
      const options = {
        filters: { country: 'Germany' },
        pagination: { page: 2, limit: 10 }
      }

      mockRepository.searchCustomers.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0
      })

      const { result } = renderHook(() => useCustomers(options), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockRepository.searchCustomers).toHaveBeenCalledWith(options)
    })

    it('should handle search query', async () => {
      const options = {
        search: {
          fields: ['company_name', 'contact_name'],
          query: 'test'
        }
      }

      mockRepository.searchCustomers.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      })

      const { result } = renderHook(() => useCustomers(options), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockRepository.searchCustomers).toHaveBeenCalledWith(options)
    })
  })

  describe('useCustomer', () => {
    it('should fetch single customer by ID', async () => {
      const mockCustomer = {
        customer_id: 'ALFKI',
        company_name: 'Alfreds Futterkiste',
        contact_name: 'Maria Anders'
      }

      mockRepository.findById.mockResolvedValue(mockCustomer)

      const { result } = renderHook(() => useCustomer('ALFKI'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockRepository.findById).toHaveBeenCalledWith('ALFKI')
      expect(result.current.data).toEqual(mockCustomer)
    })

    it('should not fetch when customer ID is empty', () => {
      const { result } = renderHook(() => useCustomer(''), { wrapper })

      expect(result.current.isLoading).toBe(false)
      expect(mockRepository.findById).not.toHaveBeenCalled()
    })

    it('should handle customer not found', async () => {
      mockRepository.findById.mockResolvedValue(null)

      const { result } = renderHook(() => useCustomer('NOTFOUND'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toBeNull()
    })
  })

  describe('useCustomerStats', () => {
    it('should fetch customer order statistics', async () => {
      const mockStats = {
        totalOrders: 5,
        totalAmount: 1250.50,
        averageOrderValue: 250.10,
        lastOrderDate: new Date('2024-01-15')
      }

      mockRepository.getCustomerOrderStats.mockResolvedValue(mockStats)

      const { result } = renderHook(() => useCustomerStats('ALFKI'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockRepository.getCustomerOrderStats).toHaveBeenCalledWith('ALFKI')
      expect(result.current.data).toEqual(mockStats)
    })

    it('should not fetch when customer ID is empty', () => {
      const { result } = renderHook(() => useCustomerStats(''), { wrapper })

      expect(result.current.isLoading).toBe(false)
      expect(mockRepository.getCustomerOrderStats).not.toHaveBeenCalled()
    })
  })

  describe('useCustomerManagement', () => {
    it('should create customer successfully', async () => {
      const newCustomer = {
        customer_id: 'NEWCO',
        company_name: 'New Company'
      }

      const createdCustomer = {
        ...newCustomer,
        contact_name: null,
        contact_title: null
      }

      mockRepository.create.mockResolvedValue(createdCustomer)

      const { result } = renderHook(() => useCustomerManagement(), { wrapper })

      const customerResult = await result.current.create(newCustomer)

      expect(mockRepository.create).toHaveBeenCalledWith(newCustomer)
      expect(customerResult).toEqual(createdCustomer)
    })

    it('should update customer successfully', async () => {
      const updateData = {
        company_name: 'Updated Company Name',
        contact_name: 'New Contact'
      }

      const updatedCustomer = {
        customer_id: 'ALFKI',
        ...updateData
      }

      mockRepository.update.mockResolvedValue(updatedCustomer)

      const { result } = renderHook(() => useCustomerManagement(), { wrapper })

      const customerResult = await result.current.update({
        customerId: 'ALFKI',
        data: updateData
      })

      expect(mockRepository.update).toHaveBeenCalledWith('ALFKI', updateData)
      expect(customerResult).toEqual(updatedCustomer)
    })

    it('should delete customer successfully', async () => {
      mockRepository.delete.mockResolvedValue(true)

      const { result } = renderHook(() => useCustomerManagement(), { wrapper })

      const deleteResult = await result.current.delete('ALFKI')

      expect(mockRepository.delete).toHaveBeenCalledWith('ALFKI')
      expect(deleteResult).toBe(true)
    })

    it('should handle create error', async () => {
      const error = new Error('Customer ID already exists')
      mockRepository.create.mockRejectedValue(error)

      const { result } = renderHook(() => useCustomerManagement(), { wrapper })

      await expect(result.current.create({
        customer_id: 'ALFKI',
        company_name: 'Duplicate Company'
      })).rejects.toThrow('Customer ID already exists')
    })

    it('should handle update error', async () => {
      const error = new Error('Customer not found')
      mockRepository.update.mockRejectedValue(error)

      const { result } = renderHook(() => useCustomerManagement(), { wrapper })

      await expect(result.current.update({
        customerId: 'NOTFOUND',
        data: { company_name: 'Updated Name' }
      })).rejects.toThrow('Customer not found')
    })

    it('should handle delete error', async () => {
      const error = new Error('Cannot delete customer with existing orders')
      mockRepository.delete.mockRejectedValue(error)

      const { result } = renderHook(() => useCustomerManagement(), { wrapper })

      await expect(result.current.delete('ALFKI')).rejects.toThrow(
        'Cannot delete customer with existing orders'
      )
    })

    it('should track loading states correctly', async () => {
      mockRepository.create.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({}), 100))
      )

      const { result } = renderHook(() => useCustomerManagement(), { wrapper })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isCreating).toBe(false)

      const createPromise = result.current.create({
        customer_id: 'TEST',
        company_name: 'Test Company'
      })

      // Check loading state during operation
      await waitFor(() => {
        expect(result.current.isCreating).toBe(true)
        expect(result.current.isLoading).toBe(true)
      })

      await createPromise

      // Check loading state after completion
      await waitFor(() => {
        expect(result.current.isCreating).toBe(false)
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})