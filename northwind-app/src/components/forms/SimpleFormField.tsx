import React from 'react'
import { Label } from '../ui/label'
import { AlertCircle } from 'lucide-react'

interface SimpleFormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
  className?: string
}

export function SimpleFormField({ 
  label, 
  required = false, 
  error, 
  children,
  className = ''
}: SimpleFormFieldProps) {
  const hasError = !!error

  return (
    <div className={`space-y-2 ${className}`}>
      <Label 
        className={`text-sm font-medium ${hasError ? 'text-red-900' : ''}`}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {hasError && (
        <div className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}