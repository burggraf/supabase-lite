// import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SimpleFormField as FormField } from './SimpleFormField'
import { Loader2, ArrowLeft } from 'lucide-react'
import type { Category } from '@/lib/database/repositories'

// Form validation schema
const categorySchema = z.object({
  category_name: z.string().min(1, 'Category name is required').max(50, 'Category name must be 50 characters or less'),
  description: z.string().optional(),
})

type CategoryFormData = z.infer<typeof categorySchema>

interface CategoryFormProps {
  category?: Category
  onSubmit: (data: CategoryFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  submitLabel?: string
}

export function CategoryForm({
  category,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Save Category'
}: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      category_name: category?.category_name || '',
      description: category?.description || '',
    }
  })

  const onSubmitForm = async (data: CategoryFormData) => {
    try {
      await onSubmit(data)
      if (!category) {
        reset() // Reset form for new categories
      }
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  const isDisabled = isLoading || isSubmitting

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isDisabled}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <CardTitle>
            {category ? 'Edit Category' : 'Create New Category'}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Category Information</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <FormField
                label="Category Name"
                required
                error={errors.category_name?.message}
              >
                <input
                  type="text"
                  {...register('category_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Beverages, Dairy Products"
                  disabled={isDisabled}
                />
              </FormField>

              <FormField
                label="Description"
                error={errors.description?.message}
              >
                <textarea
                  {...register('description')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of the category (optional)"
                  disabled={isDisabled}
                />
              </FormField>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isDisabled}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isDisabled}
            >
              {isDisabled && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}