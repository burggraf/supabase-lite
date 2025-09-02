import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = error.status as number
          if (status >= 400 && status < 500) {
            return false
          }
        }
        return failureCount < 3
      },
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
      onError: (error) => {
        console.error('Mutation error:', error)
      },
    },
  },
})

// Query keys for consistent cache management
export const queryKeys = {
  // Customer queries
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.customers.lists(), { filters }] as const,
    details: () => [...queryKeys.customers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
    stats: (id: string) => [...queryKeys.customers.detail(id), 'stats'] as const,
    topCustomers: (limit?: number) => [...queryKeys.customers.all, 'top', { limit }] as const,
  },
  
  // Product queries
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.products.lists(), { filters }] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.products.details(), id] as const,
    withDetails: (filters?: any) => [...queryKeys.products.all, 'withDetails', { filters }] as const,
    stats: (id: number) => [...queryKeys.products.detail(id), 'stats'] as const,
    lowStock: () => [...queryKeys.products.all, 'lowStock'] as const,
    discontinued: () => [...queryKeys.products.all, 'discontinued'] as const,
  },

  // Order queries
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.orders.lists(), { filters }] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.orders.details(), id] as const,
    withDetails: (id: number) => [...queryKeys.orders.detail(id), 'withDetails'] as const,
    pending: () => [...queryKeys.orders.all, 'pending'] as const,
    stats: (from?: Date, to?: Date) => [...queryKeys.orders.all, 'stats', { from, to }] as const,
    topProducts: (limit?: number, from?: Date, to?: Date) => [
      ...queryKeys.orders.all, 
      'topProducts', 
      { limit, from, to }
    ] as const,
  },

  // Reference data queries (categories, suppliers, employees)
  categories: {
    all: ['categories'] as const,
    list: () => [...queryKeys.categories.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.categories.all, id] as const,
  },

  suppliers: {
    all: ['suppliers'] as const,
    list: () => [...queryKeys.suppliers.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.suppliers.all, id] as const,
  },

  employees: {
    all: ['employees'] as const,
    list: () => [...queryKeys.employees.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.employees.all, id] as const,
  },
} as const

// Helper function to invalidate related queries after mutations
export const invalidateQueries = {
  customers: {
    all: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
    detail: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(id) }),
  },
  products: {
    all: () => queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
    detail: (id: number) => queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(id) }),
  },
  orders: {
    all: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
    detail: (id: number) => queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) }),
  },
  categories: {
    all: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
  },
  suppliers: {
    all: () => queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all }),
  },
  employees: {
    all: () => queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
  },
}