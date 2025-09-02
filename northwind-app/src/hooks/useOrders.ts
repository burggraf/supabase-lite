import { useQuery, useMutation } from '@tanstack/react-query'
import { OrderRepository, type Order, type OrderSearchFilters, type QueryOptions } from '../lib/database/repositories'
import { queryKeys, invalidateQueries } from '../lib/query/queryClient'

const orderRepository = new OrderRepository()

// Query hooks
export function useOrders(options: QueryOptions & { filters?: OrderSearchFilters } = {}) {
  return useQuery({
    queryKey: queryKeys.orders.list(options),
    queryFn: () => orderRepository.searchOrders(options),
    staleTime: 2 * 60 * 1000, // 2 minutes - orders change frequently
  })
}

export function useOrder(orderId: number) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => orderRepository.findById(orderId),
    enabled: !!orderId && orderId > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export function useOrderWithDetails(orderId: number) {
  return useQuery({
    queryKey: queryKeys.orders.withDetails(orderId),
    queryFn: () => orderRepository.findWithDetails(orderId),
    enabled: !!orderId && orderId > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export function useOrdersByCustomer(customerId: string, options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.orders.list({ ...options, filters: { customer_id: customerId } }),
    queryFn: () => orderRepository.findByCustomer(customerId, options),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useOrdersByEmployee(employeeId: number, options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.orders.list({ ...options, filters: { employee_id: employeeId } }),
    queryFn: () => orderRepository.findByEmployee(employeeId, options),
    enabled: !!employeeId && employeeId > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePendingOrders(options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.orders.pending(),
    queryFn: () => orderRepository.findPending(options),
    staleTime: 1 * 60 * 1000, // 1 minute - pending orders need frequent updates
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  })
}

export function useOrdersByDateRange(from: Date, to: Date, options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.orders.list({ ...options, filters: { date_from: from, date_to: to } }),
    queryFn: () => orderRepository.findByDateRange(from, to, options),
    enabled: !!from && !!to,
    staleTime: 10 * 60 * 1000,
  })
}

export function useOrderStats(from?: Date, to?: Date) {
  return useQuery({
    queryKey: queryKeys.orders.stats(from, to),
    queryFn: () => orderRepository.getOrderStats(from, to),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTopSellingProducts(limit: number = 10, from?: Date, to?: Date) {
  return useQuery({
    queryKey: queryKeys.orders.topProducts(limit, from, to),
    queryFn: () => orderRepository.getTopSellingProducts(limit, from, to),
    staleTime: 15 * 60 * 1000, // 15 minutes for analytics data
  })
}

// Mutation hooks
export function useCreateOrder() {
  return useMutation({
    mutationFn: (orderData: Partial<Order>) => orderRepository.create(orderData),
    onSuccess: () => {
      invalidateQueries.orders.all()
      // Also invalidate customer and employee data since they're related
      invalidateQueries.customers.all()
    },
    onError: (error) => {
      console.error('Failed to create order:', error)
      throw error
    },
  })
}

export function useUpdateOrder() {
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: Partial<Order> }) =>
      orderRepository.update(orderId, data),
    onSuccess: (updatedOrder, { orderId }) => {
      invalidateQueries.orders.all()
      if (updatedOrder) {
        invalidateQueries.orders.detail(orderId)
      }
    },
    onError: (error) => {
      console.error('Failed to update order:', error)
      throw error
    },
  })
}

export function useDeleteOrder() {
  return useMutation({
    mutationFn: (orderId: number) => orderRepository.delete(orderId),
    onSuccess: (success, orderId) => {
      if (success) {
        invalidateQueries.orders.all()
        invalidateQueries.orders.detail(orderId)
      }
    },
    onError: (error) => {
      console.error('Failed to delete order:', error)
      throw error
    },
  })
}

export function useShipOrder() {
  return useMutation({
    mutationFn: ({ orderId, shippedDate = new Date() }: { orderId: number; shippedDate?: Date }) =>
      orderRepository.update(orderId, { shipped_date: shippedDate }),
    onSuccess: (updatedOrder, { orderId }) => {
      invalidateQueries.orders.all()
      if (updatedOrder) {
        invalidateQueries.orders.detail(orderId)
      }
    },
    onError: (error) => {
      console.error('Failed to ship order:', error)
      throw error
    },
  })
}

export function useUpdateOrderStatus() {
  return useMutation({
    mutationFn: ({ 
      orderId, 
      shippedDate, 
      requiredDate, 
      shipVia, 
      freight 
    }: { 
      orderId: number
      shippedDate?: Date | null
      requiredDate?: Date
      shipVia?: number
      freight?: number
    }) => {
      const updateData: Partial<Order> = {}
      if (shippedDate !== undefined) updateData.shipped_date = shippedDate
      if (requiredDate !== undefined) updateData.required_date = requiredDate
      if (shipVia !== undefined) updateData.ship_via = shipVia
      if (freight !== undefined) updateData.freight = freight
      
      return orderRepository.update(orderId, updateData)
    },
    onSuccess: (updatedOrder, { orderId }) => {
      invalidateQueries.orders.all()
      if (updatedOrder) {
        invalidateQueries.orders.detail(orderId)
      }
    },
    onError: (error) => {
      console.error('Failed to update order status:', error)
      throw error
    },
  })
}

// Combined hook for order management
export function useOrderManagement() {
  const createMutation = useCreateOrder()
  const updateMutation = useUpdateOrder()
  const deleteMutation = useDeleteOrder()
  const shipMutation = useShipOrder()
  const updateStatusMutation = useUpdateOrderStatus()

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    ship: shipMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isShipping: shipMutation.isPending,
    isUpdatingStatus: updateStatusMutation.isPending,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending ||
               shipMutation.isPending || updateStatusMutation.isPending,
    error: createMutation.error || updateMutation.error || deleteMutation.error ||
           shipMutation.error || updateStatusMutation.error,
  }
}