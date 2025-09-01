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
import type { SignInData } from '../../../types/auth'

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

interface LoginFormProps {
  onSwitchToSignup: () => void
  onSwitchToForgotPassword: () => void
}

export default function LoginForm({ onSwitchToSignup, onSwitchToForgotPassword }: LoginFormProps) {
  const { signIn, isLoading, error, clearError } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: SignInData) => {
    setIsSubmitting(true)
    clearError()
    
    const result = await signIn(data.email, data.password)
    
    if (!result.success) {
      // Error is handled by the AuthContext
    }
    
    setIsSubmitting(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <Card className="w-full max-w-md mx-4 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
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
                        placeholder="Enter your email"
                        disabled={isSubmitting || isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        disabled={isSubmitting || isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onSwitchToForgotPassword}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  disabled={isSubmitting || isLoading}
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || isLoading}
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </Form>

          <div className="text-center">
            <span className="text-sm text-gray-600">Don't have an account? </span>
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              disabled={isSubmitting || isLoading}
            >
              Sign up
            </button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}