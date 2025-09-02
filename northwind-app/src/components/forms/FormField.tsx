import React from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Checkbox } from '../ui/checkbox'
import { Badge } from '../ui/badge'
import { AlertCircle } from 'lucide-react'

interface BaseFieldProps {
  name: string
  label: string
  form: UseFormReturn<any>
  disabled?: boolean
  placeholder?: string
  description?: string
  required?: boolean
}

interface TextFieldProps extends BaseFieldProps {
  type: 'text' | 'email' | 'tel' | 'url' | 'password'
}

interface TextareaFieldProps extends BaseFieldProps {
  type: 'textarea'
  rows?: number
}

interface NumberFieldProps extends BaseFieldProps {
  type: 'number'
  min?: number
  max?: number
  step?: number
}

interface SelectFieldProps extends BaseFieldProps {
  type: 'select'
  options: Array<{ value: string | number; label: string }>
  emptyOption?: string
}

interface CheckboxFieldProps extends BaseFieldProps {
  type: 'checkbox'
}

interface DateFieldProps extends BaseFieldProps {
  type: 'date' | 'datetime-local'
}

type FormFieldProps = 
  | TextFieldProps 
  | TextareaFieldProps 
  | NumberFieldProps 
  | SelectFieldProps 
  | CheckboxFieldProps
  | DateFieldProps

export function FormField(props: FormFieldProps) {
  const { name, label, form, disabled, placeholder, description, required, type } = props
  const fieldState = form.formState.errors[name]
  const hasError = !!fieldState

  const renderField = () => {
    switch (type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
      case 'password':
        return (
          <Input
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            {...form.register(name)}
            className={hasError ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
        )

      case 'textarea':
        const textareaProps = props as TextareaFieldProps
        return (
          <Textarea
            placeholder={placeholder}
            disabled={disabled}
            rows={textareaProps.rows || 3}
            {...form.register(name)}
            className={hasError ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
        )

      case 'number':
        const numberProps = props as NumberFieldProps
        return (
          <Input
            type="number"
            placeholder={placeholder}
            disabled={disabled}
            min={numberProps.min}
            max={numberProps.max}
            step={numberProps.step}
            {...form.register(name, { 
              setValueAs: (value: string) => value === '' ? undefined : parseFloat(value) 
            })}
            className={hasError ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
        )

      case 'select':
        const selectProps = props as SelectFieldProps
        return (
          <Select
            disabled={disabled}
            value={form.watch(name)?.toString() || ''}
            onValueChange={(value) => {
              const numericValue = !isNaN(Number(value)) ? Number(value) : value
              form.setValue(name, numericValue, { shouldValidate: true })
            }}
          >
            <SelectTrigger className={hasError ? 'border-red-500 focus:ring-red-500' : ''}>
              <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {selectProps.emptyOption && (
                <SelectItem value="">{selectProps.emptyOption}</SelectItem>
              )}
              {selectProps.options.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={name}
              disabled={disabled}
              checked={form.watch(name) || false}
              onCheckedChange={(checked) => 
                form.setValue(name, checked, { shouldValidate: true })
              }
              className={hasError ? 'border-red-500' : ''}
            />
            <Label 
              htmlFor={name} 
              className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${hasError ? 'text-red-900' : ''}`}
            >
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
        )

      case 'date':
      case 'datetime-local':
        return (
          <Input
            type={type}
            disabled={disabled}
            {...form.register(name, {
              setValueAs: (value: string) => value ? new Date(value) : undefined
            })}
            defaultValue={
              form.watch(name) instanceof Date 
                ? form.watch(name).toISOString().slice(0, type === 'date' ? 10 : 16)
                : ''
            }
            className={hasError ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
        )

      default:
        return <div>Unsupported field type</div>
    }
  }

  // Checkbox has different layout
  if (type === 'checkbox') {
    return (
      <div className="space-y-2">
        {renderField()}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {hasError && (
          <div className="flex items-center gap-1 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {fieldState.message}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label 
        htmlFor={name} 
        className={`text-sm font-medium ${hasError ? 'text-red-900' : ''}`}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {renderField()}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {hasError && (
        <div className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {fieldState.message}
        </div>
      )}
    </div>
  )
}

// Utility component for displaying form-level errors
export function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null

  return (
    <div className="rounded-md bg-red-50 border border-red-200 p-4">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Please fix the following errors:
          </h3>
          <div className="mt-2">
            <ul className="list-disc space-y-1 pl-5">
              {errors.map((error, index) => (
                <li key={index} className="text-sm text-red-700">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// Utility component for form sections
export function FormSection({ 
  title, 
  description, 
  children 
}: { 
  title: string
  description?: string
  children: React.ReactNode 
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

// Utility component for required field indicator
export function RequiredIndicator() {
  return (
    <Badge variant="secondary" className="text-xs">
      * Required
    </Badge>
  )
}