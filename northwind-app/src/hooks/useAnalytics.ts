import { useQuery } from '@tanstack/react-query'
import { AnalyticsRepository, CustomerRepository, ProductRepository, OrderRepository } from '@/lib/database/repositories'
import { queryKeys } from '@/lib/query/queryClient'

// Repository instances
const analyticsRepository = new AnalyticsRepository()
const customerRepository = new CustomerRepository()
const productRepository = new ProductRepository()
const orderRepository = new OrderRepository()

/**
 * Get comprehensive business metrics
 */
export function useBusinessMetrics(from?: Date, to?: Date) {
  return useQuery({
    queryKey: [...queryKeys.analytics.businessMetrics, from?.toISOString(), to?.toISOString()],
    queryFn: () => analyticsRepository.getBusinessMetrics(from, to),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Get sales trend data for charts
 */
export function useSalesTrend(from: Date, to: Date, groupBy: 'day' | 'week' | 'month' = 'month') {
  return useQuery({
    queryKey: [...queryKeys.analytics.salesTrend, from.toISOString(), to.toISOString(), groupBy],
    queryFn: () => analyticsRepository.getSalesTrend(from, to, groupBy),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Get top customers by revenue
 */
export function useTopCustomers(limit: number = 10, from?: Date, to?: Date) {
  return useQuery({
    queryKey: [...queryKeys.analytics.topCustomers, limit, from?.toISOString(), to?.toISOString()],
    queryFn: () => analyticsRepository.getTopCustomers(limit, from, to),
    staleTime: 15 * 60 * 1000, // 15 minutes
  })
}

/**
 * Get customer segmentation analysis
 */
export function useCustomerSegmentation() {
  return useQuery({
    queryKey: queryKeys.analytics.customerSegmentation,
    queryFn: () => customerRepository.getCustomerSegmentation(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Get customer lifetime value analysis
 */
export function useCustomerLifetimeValue(limit: number = 20) {
  return useQuery({
    queryKey: [...queryKeys.analytics.customerLifetimeValue, limit],
    queryFn: () => customerRepository.getCustomerLifetimeValue(limit),
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Get customer retention metrics
 */
export function useCustomerRetention() {
  return useQuery({
    queryKey: queryKeys.analytics.customerRetention,
    queryFn: () => customerRepository.getCustomerRetention(),
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

/**
 * Get inventory valuation
 */
export function useInventoryValuation() {
  return useQuery({
    queryKey: queryKeys.analytics.inventoryValuation,
    queryFn: () => productRepository.getInventoryValuation(),
    staleTime: 15 * 60 * 1000, // 15 minutes
  })
}

/**
 * Get reorder alerts
 */
export function useReorderAlerts() {
  return useQuery({
    queryKey: queryKeys.analytics.reorderAlerts,
    queryFn: () => productRepository.getReorderAlerts(),
    staleTime: 5 * 60 * 1000, // 5 minutes - critical data
  })
}

/**
 * Get product performance metrics
 */
export function useProductPerformance(limit: number = 20) {
  return useQuery({
    queryKey: [...queryKeys.analytics.productPerformance, limit],
    queryFn: () => productRepository.getProductPerformance(limit),
    staleTime: 20 * 60 * 1000, // 20 minutes
  })
}

/**
 * Get inventory alerts for low stock products
 */
export function useInventoryAlerts() {
  return useQuery({
    queryKey: queryKeys.analytics.inventoryAlerts,
    queryFn: () => analyticsRepository.getInventoryAlerts(),
    staleTime: 5 * 60 * 1000, // 5 minutes - critical data
  })
}

/**
 * Get revenue breakdown by category
 */
export function useRevenueByCategory(from?: Date, to?: Date) {
  return useQuery({
    queryKey: [...queryKeys.analytics.revenueByCategory, from?.toISOString(), to?.toISOString()],
    queryFn: () => analyticsRepository.getRevenueByCategory(from, to),
    staleTime: 20 * 60 * 1000, // 20 minutes
  })
}

/**
 * Get order statistics
 */
export function useOrderStats(from?: Date, to?: Date) {
  return useQuery({
    queryKey: [...queryKeys.analytics.orderStats, from?.toISOString(), to?.toISOString()],
    queryFn: () => orderRepository.getOrderStats(from, to),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Get top selling products
 */
export function useTopSellingProducts(limit: number = 10, from?: Date, to?: Date) {
  return useQuery({
    queryKey: [...queryKeys.analytics.topProducts, limit, from?.toISOString(), to?.toISOString()],
    queryFn: () => orderRepository.getTopSellingProducts(limit, from, to),
    staleTime: 15 * 60 * 1000, // 15 minutes
  })
}

/**
 * Comprehensive analytics dashboard hook
 */
export function useDashboardAnalytics(dateRange?: { from: Date; to: Date }) {
  const businessMetrics = useBusinessMetrics(dateRange?.from, dateRange?.to)
  const salesTrend = useSalesTrend(
    dateRange?.from || new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
    dateRange?.to || new Date(),
    'month'
  )
  const topCustomers = useTopCustomers(5, dateRange?.from, dateRange?.to)
  const topProducts = useTopSellingProducts(5, dateRange?.from, dateRange?.to)
  const reorderAlerts = useReorderAlerts()
  const revenueByCategory = useRevenueByCategory(dateRange?.from, dateRange?.to)

  return {
    businessMetrics,
    salesTrend,
    topCustomers,
    topProducts,
    reorderAlerts,
    revenueByCategory,
    isLoading: businessMetrics.isLoading || salesTrend.isLoading || topCustomers.isLoading || topProducts.isLoading,
    isError: businessMetrics.isError || salesTrend.isError || topCustomers.isError || topProducts.isError,
    error: businessMetrics.error || salesTrend.error || topCustomers.error || topProducts.error
  }
}