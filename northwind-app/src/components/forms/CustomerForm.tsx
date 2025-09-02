import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { FormField, FormSection, FormErrors, RequiredIndicator } from './FormField'
import { Loader2 } from 'lucide-react'
import type { Customer } from '../../lib/database/repositories'

const customerSchema = z.object({
  customer_id: z.string()
    .min(1, 'Customer ID is required')
    .max(5, 'Customer ID must be 5 characters or less')
    .regex(/^[A-Z0-9]+$/, 'Customer ID must contain only uppercase letters and numbers'),
  
  company_name: z.string()
    .min(1, 'Company name is required')
    .max(40, 'Company name must be 40 characters or less'),
  
  contact_name: z.string()
    .max(30, 'Contact name must be 30 characters or less')
    .optional()
    .or(z.literal('')),
  
  contact_title: z.string()
    .max(30, 'Contact title must be 30 characters or less')
    .optional()
    .or(z.literal('')),
  
  address: z.string()
    .max(60, 'Address must be 60 characters or less')
    .optional()
    .or(z.literal('')),
  
  city: z.string()
    .max(15, 'City must be 15 characters or less')
    .optional()
    .or(z.literal('')),
  
  region: z.string()
    .max(15, 'Region must be 15 characters or less')
    .optional()
    .or(z.literal('')),
  
  postal_code: z.string()
    .max(10, 'Postal code must be 10 characters or less')
    .optional()
    .or(z.literal('')),
  
  country: z.string()
    .max(15, 'Country must be 15 characters or less')
    .optional()
    .or(z.literal('')),
  
  phone: z.string()
    .max(24, 'Phone must be 24 characters or less')
    .optional()
    .or(z.literal('')),
  
  fax: z.string()
    .max(24, 'Fax must be 24 characters or less')
    .optional()
    .or(z.literal(''))
})

type CustomerFormData = z.infer<typeof customerSchema>

interface CustomerFormProps {
  customer?: Customer
  onSubmit: (data: CustomerFormData) => Promise<void>
  isLoading?: boolean
  onCancel?: () => void
  submitLabel?: string
}

export function CustomerForm({ 
  customer, 
  onSubmit, 
  isLoading = false, 
  onCancel,
  submitLabel = 'Save Customer'
}: CustomerFormProps) {
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customer_id: '',
      company_name: '',
      contact_name: '',
      contact_title: '',
      address: '',
      city: '',
      region: '',
      postal_code: '',
      country: '',
      phone: '',
      fax: '',
    },
  })

  // Populate form when customer data changes
  useEffect(() => {
    if (customer) {
      form.reset({
        customer_id: customer.customer_id || '',
        company_name: customer.company_name || '',
        contact_name: customer.contact_name || '',
        contact_title: customer.contact_title || '',
        address: customer.address || '',
        city: customer.city || '',
        region: customer.region || '',
        postal_code: customer.postal_code || '',
        country: customer.country || '',
        phone: customer.phone || '',
        fax: customer.fax || '',
      })
    }
  }, [customer, form])

  const handleSubmit = async (data: CustomerFormData) => {
    try {
      // Convert empty strings to undefined for optional fields
      const processedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (key === 'customer_id' || key === 'company_name') {
          // Required fields
          acc[key as keyof CustomerFormData] = value
        } else {
          // Optional fields - convert empty strings to undefined
          acc[key as keyof CustomerFormData] = value === '' ? undefined : value
        }
        return acc
      }, {} as CustomerFormData)

      await onSubmit(processedData)
    } catch (error) {
      console.error('Form submission error:', error)
      // Error handling is managed by the parent component
    }
  }

  const formErrors = Object.values(form.formState.errors)
    .map(error => error.message)
    .filter(Boolean) as string[]

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {customer ? 'Edit Customer' : 'New Customer'}
          </CardTitle>
          <RequiredIndicator />
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {formErrors.length > 0 && <FormErrors errors={formErrors} />}
          
          <FormSection 
            title="Basic Information" 
            description="Required customer details"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="customer_id"
                label="Customer ID"
                type="text"
                form={form}
                required
                disabled={isLoading || !!customer} // Don't allow editing ID for existing customers
                placeholder="e.g., ALFKI"
                description="5-character unique identifier (letters and numbers)"
              />
              <FormField
                name="company_name"
                label="Company Name"
                type="text"
                form={form}
                required
                disabled={isLoading}
                placeholder="e.g., Alfreds Futterkiste"
              />
            </div>
          </FormSection>

          <FormSection 
            title="Contact Information" 
            description="Optional contact details"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="contact_name"
                label="Contact Name"
                type="text"
                form={form}
                disabled={isLoading}
                placeholder="e.g., Maria Anders"
              />
              <FormField
                name="contact_title"
                label="Contact Title"
                type="text"
                form={form}
                disabled={isLoading}
                placeholder="e.g., Sales Representative"
              />
            </div>
          </FormSection>

          <FormSection 
            title="Address Information" 
            description="Customer address details"
          >
            <div className="space-y-4">
              <FormField
                name="address"
                label="Address"
                type="text"
                form={form}
                disabled={isLoading}
                placeholder="e.g., Obere Str. 57"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  name="city"
                  label="City"
                  type="text"
                  form={form}
                  disabled={isLoading}
                  placeholder="e.g., Berlin"
                />
                <FormField
                  name="region"
                  label="Region/State"
                  type="text"
                  form={form}
                  disabled={isLoading}
                  placeholder="e.g., Berlin"
                />
                <FormField
                  name="postal_code"
                  label="Postal Code"
                  type="text"
                  form={form}
                  disabled={isLoading}
                  placeholder="e.g., 12209"
                />
              </div>
              <FormField
                name="country"
                label="Country"
                type="text"
                form={form}
                disabled={isLoading}
                placeholder="e.g., Germany"
              />
            </div>
          </FormSection>

          <FormSection 
            title="Communication" 
            description="Phone and fax numbers"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="phone"
                label="Phone"
                type="tel"
                form={form}
                disabled={isLoading}
                placeholder="e.g., 030-0074321"
              />
              <FormField
                name="fax"
                label="Fax"
                type="tel"
                form={form}
                disabled={isLoading}
                placeholder="e.g., 030-0076545"
              />
            </div>
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