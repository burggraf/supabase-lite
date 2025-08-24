import { useState } from 'react'
import { AuthProvider } from '../../contexts/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import LoginForm from './auth/LoginForm'
import SignupForm from './auth/SignupForm'
import ForgotPasswordForm from './auth/ForgotPasswordForm'
import DashboardLayout from './dashboard/DashboardLayout'
import { Toaster } from '../ui/sonner'

type AuthMode = 'login' | 'signup' | 'forgot-password'

function AuthFlowContent() {
  const [authMode, setAuthMode] = useState<AuthMode>('login')

  const renderAuthForm = () => {
    switch (authMode) {
      case 'signup':
        return (
          <SignupForm
            onSwitchToLogin={() => setAuthMode('login')}
            onSignupSuccess={() => setAuthMode('login')}
          />
        )
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            onBackToLogin={() => setAuthMode('login')}
          />
        )
      default:
        return (
          <LoginForm
            onSwitchToSignup={() => setAuthMode('signup')}
            onSwitchToForgotPassword={() => setAuthMode('forgot-password')}
          />
        )
    }
  }

  return (
    <ProtectedRoute
      fallback={renderAuthForm()}
    >
      <DashboardLayout />
    </ProtectedRoute>
  )
}

export default function SampleApp() {
  return (
    <div className="h-full">
      <AuthProvider>
        <AuthFlowContent />
        <Toaster />
      </AuthProvider>
    </div>
  )
}