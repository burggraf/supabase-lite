import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { FormField, FormSection, FormErrors, RequiredIndicator } from './FormField'
import { Loader2 } from 'lucide-react'
import { useCategories, useSuppliers } from '../../hooks/useReferenceData'
import type { Product } from '../../lib/database/repositories'

const productSchema = z.object({
  product_name: z.string()
    .min(1, 'Product name is required')
    .max(40, 'Product name must be 40 characters or less'),
  
  supplier_id: z.number()
    .min(1, 'Please select a supplier')
    .optional(),
  
  category_id: z.number()
    .min(1, 'Please select a category')
    .optional(),
  
  quantity_per_unit: z.string()
    .max(20, 'Quantity per unit must be 20 characters or less')
    .optional()
    .or(z.literal('')),
  
  unit_price: z.number()
    .min(0, 'Unit price cannot be negative')
    .max(999999.99, 'Unit price too large')
    .optional(),
  
  units_in_stock: z.number()
    .int('Units in stock must be a whole number')
    .min(0, 'Units in stock cannot be negative')
    .max(32767, 'Units in stock too large')
    .optional(),
  
  units_on_order: z.number()
    .int('Units on order must be a whole number')
    .min(0, 'Units on order cannot be negative')
    .max(32767, 'Units on order too large')
    .optional(),
  
  reorder_level: z.number()
    .int('Reorder level must be a whole number')
    .min(0, 'Reorder level cannot be negative')
    .max(32767, 'Reorder level too large')
    .optional(),
  
  discontinued: z.boolean()
    .default(false)
})

type ProductFormData = z.infer<typeof productSchema>

interface ProductFormProps {
  product?: Product
  onSubmit: (data: ProductFormData) => Promise<void>
  isLoading?: boolean
  onCancel?: () => void
  submitLabel?: string
}

export function ProductForm({ 
  product, 
  onSubmit, 
  isLoading = false, 
  onCancel,
  submitLabel = 'Save Product'
}: ProductFormProps) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      product_name: '',
      supplier_id: undefined,
      category_id: undefined,
      quantity_per_unit: '',
      unit_price: undefined,
      units_in_stock: undefined,
      units_on_order: undefined,
      reorder_level: undefined,
      discontinued: false,
    },
  })

  // Fetch reference data
  const { data: categoriesData } = useCategories()
  const { data: suppliersData } = useSuppliers()

  const categories = categoriesData?.data || []
  const suppliers = suppliersData?.data || []

  // Populate form when product data changes
  useEffect(() => {
    if (product) {
      form.reset({
        product_name: product.product_name || '',
        supplier_id: product.supplier_id,
        category_id: product.category_id,
        quantity_per_unit: product.quantity_per_unit || '',
        unit_price: product.unit_price,
        units_in_stock: product.units_in_stock,
        units_on_order: product.units_on_order,
        reorder_level: product.reorder_level,
        discontinued: product.discontinued || false,
      })
    }
  }, [product, form])

  const handleSubmit = async (data: ProductFormData) => {
    try {
      // Convert empty strings to undefined for optional fields
      const processedData = {
        ...data,
        quantity_per_unit: data.quantity_per_unit === '' ? undefined : data.quantity_per_unit,
      }

      await onSubmit(processedData)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  const formErrors = Object.values(form.formState.errors)
    .map(error => error.message)
    .filter(Boolean) as string[]

  const categoryOptions = categories.map(cat => ({
    value: cat.category_id,
    label: cat.category_name
  }))

  const supplierOptions = suppliers.map(sup => ({
    value: sup.supplier_id,
    label: sup.company_name
  }))

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {product ? 'Edit Product' : 'New Product'}
          </CardTitle>
          <RequiredIndicator />
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {formErrors.length > 0 && <FormErrors errors={formErrors} />}
          
          <FormSection 
            title="Basic Information" 
            description="Essential product details"
          >
            <FormField
              name="product_name"
              label="Product Name"
              type="text"
              form={form}
              required
              disabled={isLoading}
              placeholder="e.g., Chai"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="category_id"
                label="Category"
                type="select"
                form={form}
                disabled={isLoading || categories.length === 0}
                options={categoryOptions}
                emptyOption="Select a category"
                description={categories.length === 0 ? 'Loading categories...' : undefined}
              />
              <FormField
                name="supplier_id"
                label="Supplier"
                type="select"
                form={form}
                disabled={isLoading || suppliers.length === 0}
                options={supplierOptions}
                emptyOption="Select a supplier"
                description={suppliers.length === 0 ? 'Loading suppliers...' : undefined}
              />
            </div>

            <FormField
              name="quantity_per_unit"
              label="Quantity Per Unit"
              type="text"
              form={form}
              disabled={isLoading}
              placeholder="e.g., 10 boxes x 20 bags"
              description="Package description (e.g., '10 boxes x 20 bags')"
            />
          </FormSection>

          <FormSection 
            title="Pricing & Inventory" 
            description="Financial and stock information"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="unit_price"
                label="Unit Price"
                type="number"
                form={form}
                disabled={isLoading}
                min={0}
                step={0.01}
                placeholder="0.00"
              />
              <FormField
                name="units_in_stock"
                label="Units in Stock"
                type="number"
                form={form}
                disabled={isLoading}
                min={0}
                step={1}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="units_on_order"
                label="Units on Order"
                type="number"
                form={form}
                disabled={isLoading}
                min={0}
                step={1}
                placeholder="0"
                description="Units currently on order from supplier"
              />
              <FormField
                name="reorder_level"
                label="Reorder Level"
                type="number"
                form={form}
                disabled={isLoading}
                min={0}
                step={1}
                placeholder="0"
                description="Stock level that triggers reorder"
              />
            </div>
          </FormSection>

          <FormSection 
            title="Status" 
            description="Product availability"
          >
            <FormField
              name="discontinued"
              label="Product is discontinued"
              type="checkbox"
              form={form}
              disabled={isLoading}
              description="Check if this product is no longer available"
            />
          </FormSection>

          <div className="flex justify-end space-x-3 pt-4">
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isLoading || !form.formState.isValid}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}