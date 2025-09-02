import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SimpleFormField as FormField } from './SimpleFormField'
import { Loader2, ArrowLeft } from 'lucide-react'
import type { Supplier } from '@/lib/database/repositories'

// Form validation schema
const supplierSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(100, 'Company name must be 100 characters or less'),
  contact_name: z.string().max(50, 'Contact name must be 50 characters or less').optional(),
  contact_title: z.string().max(50, 'Contact title must be 50 characters or less').optional(),
  address: z.string().max(255, 'Address must be 255 characters or less').optional(),
  city: z.string().max(50, 'City must be 50 characters or less').optional(),
  region: z.string().max(50, 'Region must be 50 characters or less').optional(),
  postal_code: z.string().max(20, 'Postal code must be 20 characters or less').optional(),
  country: z.string().max(50, 'Country must be 50 characters or less').optional(),
  phone: z.string().max(30, 'Phone must be 30 characters or less').optional(),
  fax: z.string().max(30, 'Fax must be 30 characters or less').optional(),
  home_page: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

type SupplierFormData = z.infer<typeof supplierSchema>

interface SupplierFormProps {
  supplier?: Supplier
  onSubmit: (data: SupplierFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  submitLabel?: string
}

export function SupplierForm({
  supplier,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Save Supplier'
}: SupplierFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      company_name: supplier?.company_name || '',
      contact_name: supplier?.contact_name || '',
      contact_title: supplier?.contact_title || '',
      address: supplier?.address || '',
      city: supplier?.city || '',
      region: supplier?.region || '',
      postal_code: supplier?.postal_code || '',
      country: supplier?.country || '',
      phone: supplier?.phone || '',
      fax: supplier?.fax || '',
      home_page: supplier?.home_page || '',
    }
  })

  const onSubmitForm = async (data: SupplierFormData) => {
    try {
      // Clean up empty strings to undefined
      const cleanData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          value === '' ? undefined : value
        ])
      )
      
      await onSubmit(cleanData)
      if (!supplier) {
        reset() // Reset form for new suppliers
      }
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  const isDisabled = isLoading || isSubmitting

  return (
    <Card className="max-w-4xl mx-auto">
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
            {supplier ? 'Edit Supplier' : 'Create New Supplier'}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-8">
          {/* Company Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Company Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Company Name"
                required
                error={errors.company_name?.message}
              >
                <input
                  type="text"
                  {...register('company_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Acme Corporation"
                  disabled={isDisabled}
                />
              </FormField>

              <FormField
                label="Website"
                error={errors.home_page?.message}
              >
                <input
                  type="url"
                  {...register('home_page')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://www.company.com"
                  disabled={isDisabled}
                />
              </FormField>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Contact Name"
                error={errors.contact_name?.message}
              >
                <input
                  type="text"
                  {...register('contact_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Smith"
                  disabled={isDisabled}
                />
              </FormField>

              <FormField
                label="Contact Title"
                error={errors.contact_title?.message}
              >
                <input
                  type="text"
                  {...register('contact_title')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Sales Manager"
                  disabled={isDisabled}
                />
              </FormField>

              <FormField
                label="Phone"
                error={errors.phone?.message}
              >
                <input
                  type="tel"
                  {...register('phone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1 (555) 123-4567"
                  disabled={isDisabled}
                />
              </FormField>

              <FormField
                label="Fax"
                error={errors.fax?.message}
              >
                <input
                  type="tel"
                  {...register('fax')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1 (555) 123-4568"
                  disabled={isDisabled}
                />
              </FormField>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Address Information</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <FormField
                label="Street Address"
                error={errors.address?.message}
              >
                <input
                  type="text"
                  {...register('address')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123 Business Street"
                  disabled={isDisabled}
                />
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  label="City"
                  error={errors.city?.message}
                >
                  <input
                    type="text"
                    {...register('city')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="New York"
                    disabled={isDisabled}
                  />
                </FormField>

                <FormField
                  label="State/Region"
                  error={errors.region?.message}
                >
                  <input
                    type="text"
                    {...register('region')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="NY"
                    disabled={isDisabled}
                  />
                </FormField>

                <FormField
                  label="Postal Code"
                  error={errors.postal_code?.message}
                >
                  <input
                    type="text"
                    {...register('postal_code')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="10001"
                    disabled={isDisabled}
                  />
                </FormField>

                <FormField
                  label="Country"
                  error={errors.country?.message}
                >
                  <input
                    type="text"
                    {...register('country')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="USA"
                    disabled={isDisabled}
                  />
                </FormField>
              </div>
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