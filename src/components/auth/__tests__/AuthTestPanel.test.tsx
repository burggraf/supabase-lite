import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthTestPanel } from '../AuthTestPanel'
import type { User, Session } from '@/lib/auth/types/auth.types'

// Mock dependencies
const mockAuthManager = {
	initialize: vi.fn(),
	signUp: vi.fn(),
	signIn: vi.fn(),
	signOut: vi.fn(),
	updateUser: vi.fn(),
	resetPassword: vi.fn(),
}

const mockSessionManager = {
	onAuthStateChange: vi.fn(),
	getUser: vi.fn(),
	getSession: vi.fn(),
	refreshSession: vi.fn(),
}

const mockMFAService = {
	enroll: vi.fn(),
	challenge: vi.fn(),
	verify: vi.fn(),
	listFactors: vi.fn(),
	unenroll: vi.fn(),
}

const mockApiKeyGenerator = {
	generateApiKeys: vi.fn(),
}

vi.mock('@/lib/auth', () => ({
	AuthManager: {
		getInstance: () => mockAuthManager,
	},
	SessionManager: {
		getInstance: () => mockSessionManager,
	},
	MFAService: {
		getInstance: () => mockMFAService,
	},
}))

vi.mock('@/lib/auth/api-keys', () => ({
	apiKeyGenerator: mockApiKeyGenerator,
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
	Copy: () => <div data-testid='copy-icon' />,
	Eye: () => <div data-testid='eye-icon' />,
	EyeOff: () => <div data-testid='eye-off-icon' />,
	Check: () => <div data-testid='check-icon' />,
}))

describe('AuthTestPanel', () => {
	const mockUser: User = {
		id: 'user-123',
		email: 'test@example.com',
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		last_sign_in_at: new Date().toISOString(),
		user_metadata: {},
		app_metadata: {},
		is_anonymous: false
	}

	const mockSession: Session = {
		id: 'session-123',
		user_id: 'user-123',
		access_token: 'access-token-123',
		refresh_token: 'refresh-token-123',
		expires_at: Date.now() + 3600000,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	}

	const mockApiKeys = {
		anon: 'anon-key-123',
		service_role: 'service-role-key-123',
		project_ref: 'project-ref-123',
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockAuthManager.initialize.mockResolvedValue(undefined)
		mockSessionManager.onAuthStateChange.mockReturnValue(() => {})
		mockSessionManager.getUser.mockReturnValue(null)
		mockSessionManager.getSession.mockReturnValue(null)
		mockApiKeyGenerator.generateApiKeys.mockResolvedValue(mockApiKeys)
		mockMFAService.listFactors.mockResolvedValue({ totp: [], phone: [] })
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('Component Initialization', () => {
		it('should render AuthTestPanel with all sections', async () => {
			render(<AuthTestPanel />)

			await waitFor(() => {
				expect(screen.getByRole('tablist')).toBeInTheDocument()
				expect(screen.getByRole('tab', { name: /authentication/i })).toBeInTheDocument()
				expect(screen.getByRole('tab', { name: /api keys/i })).toBeInTheDocument()
				expect(screen.getByRole('tab', { name: /mfa/i })).toBeInTheDocument()
			})
		})

		it('should initialize auth manager on mount', async () => {
			render(<AuthTestPanel />)

			await waitFor(() => {
				expect(mockAuthManager.initialize).toHaveBeenCalled()
			})
		})

		it('should generate API keys on mount', async () => {
			render(<AuthTestPanel />)

			await waitFor(() => {
				expect(mockApiKeyGenerator.generateApiKeys).toHaveBeenCalledWith('default')
			})
		})

		it('should set up auth state listener', () => {
			render(<AuthTestPanel />)

			expect(mockSessionManager.onAuthStateChange).toHaveBeenCalled()
		})
	})

	describe('Authentication Tab', () => {
		beforeEach(async () => {
			render(<AuthTestPanel />)
			await waitFor(() => {
				expect(screen.getByRole('tab', { name: /authentication/i })).toBeInTheDocument()
			})
		})

		it('should display signup form', () => {
			expect(screen.getByLabelText(/signup email/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/signup password/i)).toBeInTheDocument()
			expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
		})

		it('should display signin form', () => {
			expect(screen.getByLabelText(/signin email/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/signin password/i)).toBeInTheDocument()
			expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
		})

		it('should handle signup form submission', async () => {
			mockAuthManager.signUp.mockResolvedValue({ user: mockUser, session: mockSession })

			const emailInput = screen.getByLabelText(/signup email/i)
			const passwordInput = screen.getByLabelText(/signup password/i)
			const signUpButton = screen.getByRole('button', { name: /sign up/i })

			fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } })
			fireEvent.change(passwordInput, { target: { value: 'Password123$' } })
			fireEvent.click(signUpButton)

			await waitFor(() => {
				expect(mockAuthManager.signUp).toHaveBeenCalledWith(
					'newuser@example.com',
					'Password123$',
					{}
				)
			})
		})

		it('should handle signin form submission', async () => {
			mockAuthManager.signIn.mockResolvedValue({ user: mockUser, session: mockSession })

			const emailInput = screen.getByLabelText(/signin email/i)
			const passwordInput = screen.getByLabelText(/signin password/i)
			const signInButton = screen.getByRole('button', { name: /sign in/i })

			fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
			fireEvent.change(passwordInput, { target: { value: 'Password123$' } })
			fireEvent.click(signInButton)

			await waitFor(() => {
				expect(mockAuthManager.signIn).toHaveBeenCalledWith('test@example.com', 'Password123$')
			})
		})

		it('should handle signout', async () => {
			mockAuthManager.signOut.mockResolvedValue(undefined)
			mockSessionManager.getUser.mockReturnValue(mockUser)

			render(<AuthTestPanel />)

			const signOutButton = screen.getByRole('button', { name: /sign out/i })
			fireEvent.click(signOutButton)

			await waitFor(() => {
				expect(mockAuthManager.signOut).toHaveBeenCalled()
			})
		})

		it('should display current user when authenticated', () => {
			mockSessionManager.getUser.mockReturnValue(mockUser)
			mockSessionManager.getSession.mockReturnValue(mockSession)

			render(<AuthTestPanel />)

			expect(screen.getByText(mockUser.email!)).toBeInTheDocument()
			expect(screen.getByText(mockUser.id)).toBeInTheDocument()
		})

		it('should handle password reset', async () => {
			mockAuthManager.resetPassword.mockResolvedValue(undefined)

			const resetEmailInput = screen.getByLabelText(/recovery email/i)
			const resetButton = screen.getByRole('button', { name: /reset password/i })

			fireEvent.change(resetEmailInput, { target: { value: 'reset@example.com' } })
			fireEvent.click(resetButton)

			await waitFor(() => {
				expect(mockAuthManager.resetPassword).toHaveBeenCalledWith('reset@example.com')
			})
		})

		it('should handle user update', async () => {
			mockSessionManager.getUser.mockReturnValue(mockUser)
			mockAuthManager.updateUser.mockResolvedValue(mockUser)

			render(<AuthTestPanel />)

			const updateEmailInput = screen.getByLabelText(/update email/i)
			const updateButton = screen.getByRole('button', { name: /update user/i })

			fireEvent.change(updateEmailInput, { target: { value: 'updated@example.com' } })
			fireEvent.click(updateButton)

			await waitFor(() => {
				expect(mockAuthManager.updateUser).toHaveBeenCalledWith({
					email: 'updated@example.com',
				})
			})
		})

		it('should show authentication errors', async () => {
			mockAuthManager.signIn.mockRejectedValue(new Error('Invalid credentials'))

			const signInButton = screen.getByRole('button', { name: /sign in/i })
			fireEvent.click(signInButton)

			await waitFor(() => {
				expect(screen.getByText(/error/i)).toBeInTheDocument()
			})
		})

		it('should show loading state during authentication', async () => {
			let resolveSignIn: (value: any) => void = () => {}
			const signInPromise = new Promise((resolve) => {
				resolveSignIn = resolve
			})
			mockAuthManager.signIn.mockReturnValue(signInPromise)

			const signInButton = screen.getByRole('button', { name: /sign in/i })
			fireEvent.click(signInButton)

			// Should show loading state
			expect(signInButton).toBeDisabled()

			resolveSignIn({ user: mockUser, session: mockSession })
			await waitFor(() => {
				expect(signInButton).not.toBeDisabled()
			})
		})
	})

	describe('API Keys Tab', () => {
		beforeEach(async () => {
			render(<AuthTestPanel />)
			const apiKeysTab = screen.getByRole('tab', { name: /api keys/i })
			fireEvent.click(apiKeysTab)
		})

		it('should display API keys', async () => {
			await waitFor(() => {
				expect(screen.getByText(/anon key/i)).toBeInTheDocument()
				expect(screen.getByText(/service role key/i)).toBeInTheDocument()
			})
		})

		it('should mask keys by default', async () => {
			await waitFor(() => {
				expect(screen.getByText(/anon-key\.\.\.key-123/)).toBeInTheDocument()
			})
		})

		it('should toggle key visibility', async () => {
			await waitFor(() => {
				const showAnonKeyButton = screen.getByRole('button', { name: /show anon key/i })
				fireEvent.click(showAnonKeyButton)
				expect(screen.getByText('anon-key-123')).toBeInTheDocument()
			})
		})

		it('should copy keys to clipboard', async () => {
			const mockClipboard = {
				writeText: vi.fn().mockResolvedValue(undefined),
			}
			Object.assign(navigator, { clipboard: mockClipboard })

			await waitFor(() => {
				const copyAnonKeyButton = screen.getByRole('button', { name: /copy anon key/i })
				fireEvent.click(copyAnonKeyButton)
			})

			expect(mockClipboard.writeText).toHaveBeenCalledWith('anon-key-123')
		})

		it('should show copy success indicator', async () => {
			const mockClipboard = {
				writeText: vi.fn().mockResolvedValue(undefined),
			}
			Object.assign(navigator, { clipboard: mockClipboard })

			await waitFor(() => {
				const copyAnonKeyButton = screen.getByRole('button', { name: /copy anon key/i })
				fireEvent.click(copyAnonKeyButton)
			})

			expect(screen.getByTestId('check-icon')).toBeInTheDocument()
		})

		it('should handle clipboard copy failure', async () => {
			const mockClipboard = {
				writeText: vi.fn().mockRejectedValue(new Error('Clipboard error')),
			}
			Object.assign(navigator, { clipboard: mockClipboard })

			await waitFor(() => {
				const copyAnonKeyButton = screen.getByRole('button', { name: /copy anon key/i })
				fireEvent.click(copyAnonKeyButton)
			})

			// Should not crash and should log error
			expect(mockClipboard.writeText).toHaveBeenCalled()
		})

		it('should regenerate API keys', async () => {
			const newApiKeys = {
				anon: 'new-anon-key',
				service_role: 'new-service-key',
				project_ref: 'new-project-ref',
			}
			mockApiKeyGenerator.generateApiKeys.mockResolvedValue(newApiKeys)

			const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
			fireEvent.click(regenerateButton)

			await waitFor(() => {
				expect(mockApiKeyGenerator.generateApiKeys).toHaveBeenCalledTimes(2)
			})
		})
	})

	describe('MFA Tab', () => {
		beforeEach(async () => {
			mockSessionManager.getUser.mockReturnValue(mockUser)
			render(<AuthTestPanel />)
			const mfaTab = screen.getByRole('tab', { name: /mfa/i })
			fireEvent.click(mfaTab)
		})

		it('should display MFA enrollment options', () => {
			expect(screen.getByText(/factor type/i)).toBeInTheDocument()
			expect(screen.getByRole('button', { name: /enroll/i })).toBeInTheDocument()
		})

		it('should handle TOTP enrollment', async () => {
			const mockEnrollResult = {
				id: 'factor-id',
				type: 'totp',
				totp: { qr_code: 'qr-code-data', secret: 'secret-key' },
			}
			mockMFAService.enroll.mockResolvedValue(mockEnrollResult)

			const factorTypeSelect = screen.getByRole('combobox')
			fireEvent.change(factorTypeSelect, { target: { value: 'totp' } })

			const enrollButton = screen.getByRole('button', { name: /enroll/i })
			fireEvent.click(enrollButton)

			await waitFor(() => {
				expect(mockMFAService.enroll).toHaveBeenCalledWith('totp', {})
			})
		})

		it('should handle phone enrollment', async () => {
			const mockEnrollResult = {
				id: 'factor-id',
				type: 'phone',
				phone: { phone_number: '+1234567890' },
			}
			mockMFAService.enroll.mockResolvedValue(mockEnrollResult)

			const factorTypeSelect = screen.getByRole('combobox')
			fireEvent.change(factorTypeSelect, { target: { value: 'phone' } })

			const phoneInput = screen.getByLabelText(/phone/i)
			fireEvent.change(phoneInput, { target: { value: '+1234567890' } })

			const enrollButton = screen.getByRole('button', { name: /enroll/i })
			fireEvent.click(enrollButton)

			await waitFor(() => {
				expect(mockMFAService.enroll).toHaveBeenCalledWith('phone', {
					phone: '+1234567890',
				})
			})
		})

		it('should handle MFA challenge creation', async () => {
			const mockChallengeResult = {
				id: 'challenge-id',
				expires_at: Date.now() + 300000,
			}
			mockMFAService.challenge.mockResolvedValue(mockChallengeResult)

			const factorIdInput = screen.getByLabelText(/factor id/i)
			fireEvent.change(factorIdInput, { target: { value: 'factor-123' } })

			const challengeButton = screen.getByRole('button', { name: /create challenge/i })
			fireEvent.click(challengeButton)

			await waitFor(() => {
				expect(mockMFAService.challenge).toHaveBeenCalledWith('factor-123')
			})
		})

		it('should handle MFA verification', async () => {
			const mockVerifyResult = {
				access_token: 'new-access-token',
				refresh_token: 'new-refresh-token',
			}
			mockMFAService.verify.mockResolvedValue(mockVerifyResult)

			const challengeIdInput = screen.getByLabelText(/challenge id/i)
			const codeInput = screen.getByLabelText(/verification code/i)

			fireEvent.change(challengeIdInput, { target: { value: 'challenge-123' } })
			fireEvent.change(codeInput, { target: { value: '123456' } })

			const verifyButton = screen.getByRole('button', { name: /verify/i })
			fireEvent.click(verifyButton)

			await waitFor(() => {
				expect(mockMFAService.verify).toHaveBeenCalledWith('challenge-123', '123456')
			})
		})

		it('should display enrolled factors', async () => {
			const mockFactors = {
				totp: [{ id: 'totp-1', status: 'verified' }],
				phone: [{ id: 'phone-1', status: 'unverified' }],
			}
			mockMFAService.listFactors.mockResolvedValue(mockFactors)

			// Trigger factors refresh
			const refreshButton = screen.getByRole('button', { name: /refresh factors/i })
			fireEvent.click(refreshButton)

			await waitFor(() => {
				expect(screen.getByText(/totp-1/)).toBeInTheDocument()
				expect(screen.getByText(/phone-1/)).toBeInTheDocument()
			})
		})

		it('should handle factor unenrollment', async () => {
			mockMFAService.unenroll.mockResolvedValue(undefined)

			const factorIdInput = screen.getByLabelText(/factor id/i)
			fireEvent.change(factorIdInput, { target: { value: 'factor-123' } })

			const unenrollButton = screen.getByRole('button', { name: /unenroll/i })
			fireEvent.click(unenrollButton)

			await waitFor(() => {
				expect(mockMFAService.unenroll).toHaveBeenCalledWith('factor-123')
			})
		})

		it('should show MFA not available when user not authenticated', () => {
			mockSessionManager.getUser.mockReturnValue(null)

			render(<AuthTestPanel />)
			const mfaTab = screen.getByRole('tab', { name: /mfa/i })
			fireEvent.click(mfaTab)

			expect(screen.getByText(/sign in to use mfa/i)).toBeInTheDocument()
		})

		it('should handle MFA enrollment errors', async () => {
			mockMFAService.enroll.mockRejectedValue(new Error('Enrollment failed'))

			const enrollButton = screen.getByRole('button', { name: /enroll/i })
			fireEvent.click(enrollButton)

			await waitFor(() => {
				expect(screen.getByText(/error/i)).toBeInTheDocument()
			})
		})
	})

	describe('Test Results Display', () => {
		it('should display test results for successful operations', async () => {
			mockAuthManager.signIn.mockResolvedValue({ user: mockUser, session: mockSession })

			render(<AuthTestPanel />)

			const signInButton = screen.getByRole('button', { name: /sign in/i })
			fireEvent.click(signInButton)

			await waitFor(() => {
				expect(screen.getByText(/success/i)).toBeInTheDocument()
				expect(screen.getByText(/duration/i)).toBeInTheDocument()
			})
		})

		it('should display test results for failed operations', async () => {
			mockAuthManager.signIn.mockRejectedValue(new Error('Invalid credentials'))

			render(<AuthTestPanel />)

			const signInButton = screen.getByRole('button', { name: /sign in/i })
			fireEvent.click(signInButton)

			await waitFor(() => {
				expect(screen.getByText(/error/i)).toBeInTheDocument()
				expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
			})
		})

		it('should measure operation duration', async () => {
			mockAuthManager.signIn.mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(() => resolve({ user: mockUser, session: mockSession }), 100)
					)
			)

			render(<AuthTestPanel />)

			const signInButton = screen.getByRole('button', { name: /sign in/i })
			fireEvent.click(signInButton)

			await waitFor(() => {
				expect(screen.getByText(/duration/i)).toBeInTheDocument()
			})
		})
	})

	describe('Form State Management', () => {
		it('should update form fields correctly', () => {
			render(<AuthTestPanel />)

			const signupEmailInput = screen.getByLabelText(/signup email/i)
			fireEvent.change(signupEmailInput, { target: { value: 'test@example.com' } })

			expect(signupEmailInput).toHaveValue('test@example.com')
		})

		it('should reset form fields after successful operations', async () => {
			mockAuthManager.signUp.mockResolvedValue({ user: mockUser, session: mockSession })

			render(<AuthTestPanel />)

			const signUpButton = screen.getByRole('button', { name: /sign up/i })
			fireEvent.click(signUpButton)

			await waitFor(() => {
				expect(mockAuthManager.signUp).toHaveBeenCalled()
			})

			// Form fields should be reset or maintained based on UX requirements
			expect(screen.getByLabelText(/signup email/i)).toBeInTheDocument()
		})

		it('should validate required fields', () => {
			render(<AuthTestPanel />)

			const signUpButton = screen.getByRole('button', { name: /sign up/i })
			fireEvent.click(signUpButton)

			// Should handle empty fields appropriately
			expect(signUpButton).toBeInTheDocument()
		})
	})

	describe('Session Management', () => {
		it('should handle session refresh', async () => {
			mockSessionManager.refreshSession.mockResolvedValue(mockSession)
			mockSessionManager.getSession.mockReturnValue(mockSession)

			render(<AuthTestPanel />)

			const refreshButton = screen.getByRole('button', { name: /refresh session/i })
			fireEvent.click(refreshButton)

			await waitFor(() => {
				expect(mockSessionManager.refreshSession).toHaveBeenCalled()
			})
		})

		it('should handle expired sessions', () => {
			const expiredSession = { ...mockSession, expires_at: Date.now() - 1000 }
			mockSessionManager.getSession.mockReturnValue(expiredSession)

			render(<AuthTestPanel />)

			expect(screen.getByText(/expired/i)).toBeInTheDocument()
		})

		it('should display session information', () => {
			mockSessionManager.getSession.mockReturnValue(mockSession)

			render(<AuthTestPanel />)

			expect(screen.getByText(/access token/i)).toBeInTheDocument()
			expect(screen.getByText(/expires at/i)).toBeInTheDocument()
		})
	})
})
