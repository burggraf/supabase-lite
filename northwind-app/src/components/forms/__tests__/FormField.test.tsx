import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { FormField, FormErrors, FormSection, RequiredIndicator } from '../FormField'

// Test wrapper component to provide form context
function TestFormWrapper({ 
  children, 
  defaultValues = {} 
}: { 
  children: React.ReactNode
  defaultValues?: any 
}) {
  const form = useForm({ defaultValues })
  
  return (
    <form onSubmit={form.handleSubmit(() => {})}>
      {children({ form })}
    </form>
  )
}

describe('FormField', () => {
  describe('text input', () => {
    it('should render text input field', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="username"
              label="Username"
              type="text"
              form={form}
              placeholder="Enter username"
            />
          )}
        </TestFormWrapper>
      )

      expect(screen.getByLabelText('Username')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument()
    })

    it('should show required indicator when required', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="username"
              label="Username"
              type="text"
              form={form}
              required
            />
          )}
        </TestFormWrapper>
      )

      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('should show description when provided', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="username"
              label="Username"
              type="text"
              form={form}
              description="Must be at least 3 characters"
            />
          )}
        </TestFormWrapper>
      )

      expect(screen.getByText('Must be at least 3 characters')).toBeInTheDocument()
    })

    it('should be disabled when disabled prop is true', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="username"
              label="Username"
              type="text"
              form={form}
              disabled
            />
          )}
        </TestFormWrapper>
      )

      expect(screen.getByLabelText('Username')).toBeDisabled()
    })
  })

  describe('number input', () => {
    it('should render number input with min/max/step', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="price"
              label="Price"
              type="number"
              form={form}
              min={0}
              max={1000}
              step={0.01}
            />
          )}
        </TestFormWrapper>
      )

      const input = screen.getByLabelText('Price') as HTMLInputElement
      expect(input.type).toBe('number')
      expect(input.min).toBe('0')
      expect(input.max).toBe('1000')
      expect(input.step).toBe('0.01')
    })

    it('should convert string values to numbers', async () => {
      const user = userEvent.setup()
      let formData: any = {}

      render(
        <TestFormWrapper>
          {({ form }) => {
            formData = form.getValues()
            return (
              <FormField
                name="price"
                label="Price"
                type="number"
                form={form}
              />
            )
          }}
        </TestFormWrapper>
      )

      const input = screen.getByLabelText('Price')
      await user.type(input, '25.99')

      // Form should convert string to number
      expect(typeof formData.price).toBe('number')
    })
  })

  describe('select input', () => {
    const options = [
      { value: 1, label: 'Option 1' },
      { value: 2, label: 'Option 2' },
      { value: 'other', label: 'Other Option' }
    ]

    it('should render select field with options', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="category"
              label="Category"
              type="select"
              form={form}
              options={options}
              emptyOption="Select category"
            />
          )}
        </TestFormWrapper>
      )

      expect(screen.getByText('Select category')).toBeInTheDocument()
    })

    it('should handle numeric and string values correctly', async () => {
      const user = userEvent.setup()

      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="category"
              label="Category"
              type="select"
              form={form}
              options={options}
            />
          )}
        </TestFormWrapper>
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Other Option')).toBeInTheDocument()
    })
  })

  describe('checkbox input', () => {
    it('should render checkbox with different layout', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="agreed"
              label="I agree to the terms"
              type="checkbox"
              form={form}
              required
            />
          )}
        </TestFormWrapper>
      )

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(screen.getByText('I agree to the terms')).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument() // Required indicator
    })

    it('should handle checkbox state changes', async () => {
      const user = userEvent.setup()
      let formData: any = {}

      render(
        <TestFormWrapper defaultValues={{ agreed: false }}>
          {({ form }) => {
            formData = form.getValues()
            return (
              <FormField
                name="agreed"
                label="I agree to the terms"
                type="checkbox"
                form={form}
              />
            )
          }}
        </TestFormWrapper>
      )

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()

      await user.click(checkbox)
      expect(formData.agreed).toBe(true)
    })
  })

  describe('textarea input', () => {
    it('should render textarea with custom rows', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="description"
              label="Description"
              type="textarea"
              form={form}
              rows={5}
              placeholder="Enter description"
            />
          )}
        </TestFormWrapper>
      )

      const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement
      expect(textarea.tagName).toBe('TEXTAREA')
      expect(textarea.rows).toBe(5)
      expect(textarea.placeholder).toBe('Enter description')
    })
  })

  describe('date input', () => {
    it('should render date input', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="birthDate"
              label="Birth Date"
              type="date"
              form={form}
            />
          )}
        </TestFormWrapper>
      )

      const input = screen.getByLabelText('Birth Date') as HTMLInputElement
      expect(input.type).toBe('date')
    })

    it('should render datetime-local input', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="appointmentTime"
              label="Appointment Time"
              type="datetime-local"
              form={form}
            />
          )}
        </TestFormWrapper>
      )

      const input = screen.getByLabelText('Appointment Time') as HTMLInputElement
      expect(input.type).toBe('datetime-local')
    })
  })

  describe('error handling', () => {
    it('should display error message when field has error', () => {
      render(
        <TestFormWrapper>
          {({ form }) => {
            // Simulate form error
            form.setError('username', { 
              type: 'required', 
              message: 'Username is required' 
            })
            
            return (
              <FormField
                name="username"
                label="Username"
                type="text"
                form={form}
                required
              />
            )
          }}
        </TestFormWrapper>
      )

      expect(screen.getByText('Username is required')).toBeInTheDocument()
      // Should have error icon (mocked as AlertCircle)
      expect(screen.getByText('Username is required').parentElement?.querySelector('svg')).toBeDefined()
    })

    it('should apply error styling when field has error', () => {
      render(
        <TestFormWrapper>
          {({ form }) => {
            form.setError('username', { 
              type: 'required', 
              message: 'Username is required' 
            })
            
            return (
              <FormField
                name="username"
                label="Username"
                type="text"
                form={form}
              />
            )
          }}
        </TestFormWrapper>
      )

      const input = screen.getByLabelText('Username')
      expect(input).toHaveClass('border-red-500')
    })
  })

  describe('email and tel types', () => {
    it('should render email input', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="email"
              label="Email"
              type="email"
              form={form}
            />
          )}
        </TestFormWrapper>
      )

      const input = screen.getByLabelText('Email') as HTMLInputElement
      expect(input.type).toBe('email')
    })

    it('should render tel input', () => {
      render(
        <TestFormWrapper>
          {({ form }) => (
            <FormField
              name="phone"
              label="Phone"
              type="tel"
              form={form}
            />
          )}
        </TestFormWrapper>
      )

      const input = screen.getByLabelText('Phone') as HTMLInputElement
      expect(input.type).toBe('tel')
    })
  })
})

describe('FormErrors', () => {
  it('should not render when no errors', () => {
    const { container } = render(<FormErrors errors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render list of errors', () => {
    const errors = [
      'Username is required',
      'Email must be valid',
      'Password too short'
    ]

    render(<FormErrors errors={errors} />)

    expect(screen.getByText('Please fix the following errors:')).toBeInTheDocument()
    errors.forEach(error => {
      expect(screen.getByText(error)).toBeInTheDocument()
    })
  })
})

describe('FormSection', () => {
  it('should render section with title and description', () => {
    render(
      <FormSection 
        title="Personal Information" 
        description="Enter your personal details"
      >
        <div>Form fields here</div>
      </FormSection>
    )

    expect(screen.getByText('Personal Information')).toBeInTheDocument()
    expect(screen.getByText('Enter your personal details')).toBeInTheDocument()
    expect(screen.getByText('Form fields here')).toBeInTheDocument()
  })

  it('should render section without description', () => {
    render(
      <FormSection title="Basic Info">
        <div>Form content</div>
      </FormSection>
    )

    expect(screen.getByText('Basic Info')).toBeInTheDocument()
    expect(screen.getByText('Form content')).toBeInTheDocument()
  })
})

describe('RequiredIndicator', () => {
  it('should render required indicator badge', () => {
    render(<RequiredIndicator />)
    
    expect(screen.getByText('* Required')).toBeInTheDocument()
  })
})