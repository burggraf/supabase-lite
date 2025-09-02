import { useQuery, useMutation } from '@tanstack/react-query'
import { BaseRepository, type QueryOptions } from '../lib/database/repositories'
import type { Category, Supplier, Employee } from '../lib/database/repositories'
import { queryKeys, invalidateQueries } from '../lib/query/queryClient'

// Repository instances
const categoryRepository = new BaseRepository<Category>('categories', 'category_id')
const supplierRepository = new BaseRepository<Supplier>('suppliers', 'supplier_id')
const employeeRepository = new BaseRepository<Employee>('employees', 'employee_id')

// Category hooks
export function useCategories(options: QueryOptions = {}) {
  return useQuery({
    queryKey: [...queryKeys.categories.list(), options],
    queryFn: () => categoryRepository.findAll(options),
    staleTime: 30 * 60 * 1000, // 30 minutes - categories rarely change
  })
}

export function useCategory(categoryId: number) {
  return useQuery({
    queryKey: queryKeys.categories.detail(categoryId),
    queryFn: () => categoryRepository.findById(categoryId),
    enabled: !!categoryId && categoryId > 0,
    staleTime: 30 * 60 * 1000,
  })
}

export function useCreateCategory() {
  return useMutation({
    mutationFn: (categoryData: Partial<Category>) => categoryRepository.create(categoryData),
    onSuccess: () => {
      invalidateQueries.categories.all()
    },
    onError: (error) => {
      console.error('Failed to create category:', error)
      throw error
    },
  })
}

export function useUpdateCategory() {
  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: number; data: Partial<Category> }) =>
      categoryRepository.update(categoryId, data),
    onSuccess: () => {
      invalidateQueries.categories.all()
    },
    onError: (error) => {
      console.error('Failed to update category:', error)
      throw error
    },
  })
}

export function useDeleteCategory() {
  return useMutation({
    mutationFn: (categoryId: number) => categoryRepository.delete(categoryId),
    onSuccess: () => {
      invalidateQueries.categories.all()
    },
    onError: (error) => {
      console.error('Failed to delete category:', error)
      throw error
    },
  })
}

// Supplier hooks
export function useSuppliers(options: QueryOptions = {}) {
  return useQuery({
    queryKey: [...queryKeys.suppliers.list(), options],
    queryFn: () => supplierRepository.findAll(options),
    staleTime: 15 * 60 * 1000, // 15 minutes
  })
}

export function useSupplier(supplierId: number) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(supplierId),
    queryFn: () => supplierRepository.findById(supplierId),
    enabled: !!supplierId && supplierId > 0,
    staleTime: 15 * 60 * 1000,
  })
}

export function useCreateSupplier() {
  return useMutation({
    mutationFn: (supplierData: Partial<Supplier>) => supplierRepository.create(supplierData),
    onSuccess: () => {
      invalidateQueries.suppliers.all()
    },
    onError: (error) => {
      console.error('Failed to create supplier:', error)
      throw error
    },
  })
}

export function useUpdateSupplier() {
  return useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: number; data: Partial<Supplier> }) =>
      supplierRepository.update(supplierId, data),
    onSuccess: () => {
      invalidateQueries.suppliers.all()
    },
    onError: (error) => {
      console.error('Failed to update supplier:', error)
      throw error
    },
  })
}

export function useDeleteSupplier() {
  return useMutation({
    mutationFn: (supplierId: number) => supplierRepository.delete(supplierId),
    onSuccess: () => {
      invalidateQueries.suppliers.all()
    },
    onError: (error) => {
      console.error('Failed to delete supplier:', error)
      throw error
    },
  })
}

// Employee hooks
export function useEmployees(options: QueryOptions = {}) {
  return useQuery({
    queryKey: [...queryKeys.employees.list(), options],
    queryFn: () => employeeRepository.findAll({
      ...options,
      sort: options.sort || [{ field: 'last_name', direction: 'ASC' }]
    }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useEmployee(employeeId: number) {
  return useQuery({
    queryKey: queryKeys.employees.detail(employeeId),
    queryFn: async () => {
      const employee = await employeeRepository.findById(employeeId)
      if (employee) {
        return {
          ...employee,
          birth_date: employee.birth_date ? new Date(employee.birth_date) : undefined,
          hire_date: employee.hire_date ? new Date(employee.hire_date) : undefined,
        }
      }
      return employee
    },
    enabled: !!employeeId && employeeId > 0,
    staleTime: 10 * 60 * 1000,
  })
}

export function useCreateEmployee() {
  return useMutation({
    mutationFn: (employeeData: Partial<Employee>) => employeeRepository.create(employeeData),
    onSuccess: () => {
      invalidateQueries.employees.all()
    },
    onError: (error) => {
      console.error('Failed to create employee:', error)
      throw error
    },
  })
}

export function useUpdateEmployee() {
  return useMutation({
    mutationFn: ({ employeeId, data }: { employeeId: number; data: Partial<Employee> }) =>
      employeeRepository.update(employeeId, data),
    onSuccess: () => {
      invalidateQueries.employees.all()
    },
    onError: (error) => {
      console.error('Failed to update employee:', error)
      throw error
    },
  })
}

export function useDeleteEmployee() {
  return useMutation({
    mutationFn: (employeeId: number) => employeeRepository.delete(employeeId),
    onSuccess: () => {
      invalidateQueries.employees.all()
    },
    onError: (error) => {
      console.error('Failed to delete employee:', error)
      throw error
    },
  })
}

// Combined management hooks
export function useCategoryManagement() {
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    error: createMutation.error || updateMutation.error || deleteMutation.error,
  }
}

export function useSupplierManagement() {
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const deleteMutation = useDeleteSupplier()

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    error: createMutation.error || updateMutation.error || deleteMutation.error,
  }
}

export function useEmployeeManagement() {
  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployee()
  const deleteMutation = useDeleteEmployee()

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    error: createMutation.error || updateMutation.error || deleteMutation.error,
  }
}