import { useQuery, useMutation } from '@tanstack/react-query'
import { CustomerRepository, type Customer, type CustomerSearchFilters, type QueryOptions } from '../lib/database/repositories'
import { queryKeys, invalidateQueries } from '../lib/query/queryClient'

const customerRepository = new CustomerRepository()

// Query hooks
export function useCustomers(options: QueryOptions & { filters?: CustomerSearchFilters } = {}) {
  return useQuery({
    queryKey: queryKeys.customers.list(options),
    queryFn: () => customerRepository.searchCustomers(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCustomer(customerId: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(customerId),
    queryFn: () => customerRepository.findById(customerId),
    enabled: !!customerId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useCustomerStats(customerId: string) {
  return useQuery({
    queryKey: queryKeys.customers.stats(customerId),
    queryFn: () => customerRepository.getCustomerOrderStats(customerId),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTopCustomers(limit: number = 10) {
  return useQuery({
    queryKey: queryKeys.customers.topCustomers(limit),
    queryFn: () => customerRepository.getTopCustomers(limit),
    staleTime: 15 * 60 * 1000, // 15 minutes - less frequent updates for analytics
  })
}

export function useCustomersByCountry(country: string, options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.customers.list({ ...options, filters: { country } }),
    queryFn: () => customerRepository.findByCountry(country, options),
    enabled: !!country,
  })
}

export function useCustomersByCity(city: string, options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.customers.list({ ...options, filters: { city } }),
    queryFn: () => customerRepository.findByCity(city, options),
    enabled: !!city,
  })
}

// Mutation hooks
export function useCreateCustomer() {
  return useMutation({
    mutationFn: (customerData: Partial<Customer>) => customerRepository.create(customerData),
    onSuccess: () => {
      invalidateQueries.customers.all()
    },
    onError: (error) => {
      console.error('Failed to create customer:', error)
      throw error
    },
  })
}

export function useUpdateCustomer() {
  return useMutation({
    mutationFn: ({ customerId, data }: { customerId: string; data: Partial<Customer> }) =>
      customerRepository.update(customerId, data),
    onSuccess: (updatedCustomer, { customerId }) => {
      invalidateQueries.customers.all()
      if (updatedCustomer) {
        invalidateQueries.customers.detail(customerId)
      }
    },
    onError: (error) => {
      console.error('Failed to update customer:', error)
      throw error
    },
  })
}

export function useDeleteCustomer() {
  return useMutation({
    mutationFn: (customerId: string) => customerRepository.delete(customerId),
    onSuccess: (success, customerId) => {
      if (success) {
        invalidateQueries.customers.all()
        invalidateQueries.customers.detail(customerId)
      }
    },
    onError: (error) => {
      console.error('Failed to delete customer:', error)
      throw error
    },
  })
}

// Combined hook for customer management
export function useCustomerManagement() {
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const deleteMutation = useDeleteCustomer()

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    error: createMutation.error || updateMutation.error || deleteMutation.error,
  }
}