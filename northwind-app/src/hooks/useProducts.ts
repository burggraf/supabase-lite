import { useQuery, useMutation } from '@tanstack/react-query'
import { ProductRepository, type Product, type ProductSearchFilters, type QueryOptions } from '../lib/database/repositories'
import { queryKeys, invalidateQueries } from '../lib/query/queryClient'

const productRepository = new ProductRepository()

// Query hooks
export function useProducts(options: QueryOptions & { filters?: ProductSearchFilters } = {}) {
  return useQuery({
    queryKey: queryKeys.products.list(options),
    queryFn: () => productRepository.searchProducts(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useProductsWithDetails(options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.products.withDetails(options),
    queryFn: () => productRepository.findWithDetails(options),
    staleTime: 5 * 60 * 1000,
  })
}

export function useProduct(productId: number) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => productRepository.findById(productId),
    enabled: !!productId && productId > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useProductStats(productId: number) {
  return useQuery({
    queryKey: queryKeys.products.stats(productId),
    queryFn: () => productRepository.getProductSalesStats(productId),
    enabled: !!productId && productId > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export function useProductsByCategory(categoryId: number, options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.products.list({ ...options, filters: { category_id: categoryId } }),
    queryFn: () => productRepository.findByCategory(categoryId, options),
    enabled: !!categoryId && categoryId > 0,
  })
}

export function useProductsBySupplier(supplierId: number, options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.products.list({ ...options, filters: { supplier_id: supplierId } }),
    queryFn: () => productRepository.findBySupplier(supplierId, options),
    enabled: !!supplierId && supplierId > 0,
  })
}

export function useLowStockProducts(options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.products.lowStock(),
    queryFn: () => productRepository.findLowStock(options),
    staleTime: 2 * 60 * 1000, // 2 minutes - more frequent for inventory monitoring
  })
}

export function useDiscontinuedProducts(options: QueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.products.discontinued(),
    queryFn: () => productRepository.findDiscontinued(options),
    staleTime: 30 * 60 * 1000, // 30 minutes - rarely changes
  })
}

// Mutation hooks
export function useCreateProduct() {
  return useMutation({
    mutationFn: (productData: Partial<Product>) => productRepository.create(productData),
    onSuccess: () => {
      invalidateQueries.products.all()
    },
    onError: (error) => {
      console.error('Failed to create product:', error)
      throw error
    },
  })
}

export function useUpdateProduct() {
  return useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: Partial<Product> }) =>
      productRepository.update(productId, data),
    onSuccess: (updatedProduct, { productId }) => {
      invalidateQueries.products.all()
      if (updatedProduct) {
        invalidateQueries.products.detail(productId)
      }
    },
    onError: (error) => {
      console.error('Failed to update product:', error)
      throw error
    },
  })
}

export function useDeleteProduct() {
  return useMutation({
    mutationFn: (productId: number) => productRepository.delete(productId),
    onSuccess: (success, productId) => {
      if (success) {
        invalidateQueries.products.all()
        invalidateQueries.products.detail(productId)
      }
    },
    onError: (error) => {
      console.error('Failed to delete product:', error)
      throw error
    },
  })
}

export function useUpdateProductStock() {
  return useMutation({
    mutationFn: ({ productId, unitsInStock, reorderLevel }: { 
      productId: number
      unitsInStock?: number
      reorderLevel?: number 
    }) => {
      const updateData: Partial<Product> = {}
      if (unitsInStock !== undefined) updateData.units_in_stock = unitsInStock
      if (reorderLevel !== undefined) updateData.reorder_level = reorderLevel
      
      return productRepository.update(productId, updateData)
    },
    onSuccess: (updatedProduct, { productId }) => {
      invalidateQueries.products.all()
      if (updatedProduct) {
        invalidateQueries.products.detail(productId)
      }
    },
    onError: (error) => {
      console.error('Failed to update product stock:', error)
      throw error
    },
  })
}

export function useDiscontinueProduct() {
  return useMutation({
    mutationFn: ({ productId, discontinued = true }: { productId: number; discontinued?: boolean }) =>
      productRepository.update(productId, { discontinued }),
    onSuccess: (updatedProduct, { productId }) => {
      invalidateQueries.products.all()
      if (updatedProduct) {
        invalidateQueries.products.detail(productId)
      }
    },
    onError: (error) => {
      console.error('Failed to update product status:', error)
      throw error
    },
  })
}

// Combined hook for product management
export function useProductManagement() {
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const deleteMutation = useDeleteProduct()
  const updateStockMutation = useUpdateProductStock()
  const discontinueMutation = useDiscontinueProduct()

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    updateStock: updateStockMutation.mutateAsync,
    discontinue: discontinueMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isUpdatingStock: updateStockMutation.isPending,
    isDiscontinuing: discontinueMutation.isPending,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || 
               updateStockMutation.isPending || discontinueMutation.isPending,
    error: createMutation.error || updateMutation.error || deleteMutation.error || 
           updateStockMutation.error || discontinueMutation.error,
  }
}