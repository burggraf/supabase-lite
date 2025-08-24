import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Alert, AlertDescription } from '../../ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form'
import { useAuth } from '../../../contexts/AuthContext'
import type { ResetPasswordData } from '../../../types/auth'
import { ArrowLeft } from 'lucide-react'

const resetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

interface ForgotPasswordFormProps {
  onBackToLogin: () => void
}

export default function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const { resetPassword } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const onSubmit = async (data: ResetPasswordData) => {
    setIsSubmitting(true)
    setSuccessMessage(null)
    setErrorMessage(null)
    
    const result = await resetPassword(data.email)
    
    if (result.success) {
      setSuccessMessage(
        'Password reset instructions have been sent to your email address. Please check your inbox and follow the instructions to reset your password.'
      )
      form.reset()
    } else {
      setErrorMessage(result.error || 'Failed to send password reset email')
    }
    
    setIsSubmitting(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <Card className="w-full max-w-md mx-4 shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToLogin}
              disabled={isSubmitting}
              className="p-0 h-6 w-6"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-2xl font-bold">Reset password</CardTitle>
          </div>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email address"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending reset link...' : 'Send reset link'}
              </Button>
            </form>
          </Form>

          {successMessage && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={onBackToLogin}
                disabled={isSubmitting}
              >
                Back to sign in
              </Button>
            </div>
          )}

          {!successMessage && (
            <div className="text-center">
              <span className="text-sm text-gray-600">Remember your password? </span>
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                disabled={isSubmitting}
              >
                Sign in
              </button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              Note: Password reset is a demo feature in this sample application
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}