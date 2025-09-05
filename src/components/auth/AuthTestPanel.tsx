import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AuthManager, SessionManager, MFAService } from '@/lib/auth'
import { apiKeyGenerator } from '@/lib/auth/api-keys'
import type { User, Session } from '@/lib/auth/types/auth.types'
import type { ApiKeys } from '@/lib/auth/api-keys'
import { Copy, Eye, EyeOff, Check } from 'lucide-react'
import { getBaseUrl } from '@/lib/utils'

interface AuthTestResult {
  success: boolean
  data?: any
  error?: string
  duration?: number
}

export function AuthTestPanel() {
  const [authManager] = useState(() => AuthManager.getInstance())
  const [sessionManager] = useState(() => SessionManager.getInstance())
  const [mfaService] = useState(() => MFAService.getInstance())
  
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [testResults, setTestResults] = useState<Record<string, AuthTestResult>>({})
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null)
  const [showAnonKey, setShowAnonKey] = useState(false)
  const [showServiceKey, setShowServiceKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  
  // Form states
  const [signupEmail, setSignupEmail] = useState('test@example.com')
  const [signupPassword, setSignupPassword] = useState('SecurePass123!')
  const [signinEmail, setSigninEmail] = useState('test@example.com')
  const [signinPassword, setSigninPassword] = useState('SecurePass123!')
  const [updateEmail, setUpdateEmail] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('test@example.com')
  const [mfaFactorType, setMfaFactorType] = useState<'totp' | 'phone'>('totp')
  const [mfaPhone, setMfaPhone] = useState('+1234567890')
  const [mfaCode, setMfaCode] = useState('')
  const [selectedFactorId, setSelectedFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  
  // Factors state
  const [factors, setFactors] = useState<any>({ totp: [], phone: [] })

  useEffect(() => {
    // Initialize auth manager
    authManager.initialize().catch(console.error)
    
    // Set up auth state listener
    const unsubscribe = sessionManager.onAuthStateChange((event: any) => {
      console.log('Auth state change:', event)
      setCurrentUser(sessionManager.getUser())
      setCurrentSession(sessionManager.getSession())
    })

    // Initial state
    setCurrentUser(sessionManager.getUser())
    setCurrentSession(sessionManager.getSession())
    
    // Generate API keys on component mount
    generateAPIKeys()

    return unsubscribe
  }, [authManager, sessionManager])

  const generateAPIKeys = async () => {
    try {
      const keys = await apiKeyGenerator.generateApiKeys('default')
      setApiKeys(keys)
    } catch (error) {
      console.error('Failed to generate API keys:', error)
    }
  }

  const copyToClipboard = async (text: string, keyType: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(keyType)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const maskKey = (key: string) => {
    if (key.length <= 20) return key
    return key.slice(0, 10) + '...' + key.slice(-10)
  }

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    const startTime = performance.now()
    
    try {
      const result = await testFn()
      const duration = performance.now() - startTime
      
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          success: true,
          data: result,
          duration: Math.round(duration)
        }
      }))
      
      return result
    } catch (error: any) {
      const duration = performance.now() - startTime
      
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          success: false,
          error: error.message,
          duration: Math.round(duration)
        }
      }))
      
      throw error
    }
  }

  const handleSignUp = () => runTest('signup', async () => {
    return await authManager.signUp({
      email: signupEmail,
      password: signupPassword,
      data: { name: 'Test User' }
    })
  })

  const handleSignIn = () => runTest('signin', async () => {
    return await authManager.signIn({
      email: signinEmail,
      password: signinPassword
    })
  })

  const handleSignOut = () => runTest('signout', async () => {
    await authManager.signOut()
    return { success: true }
  })

  const handleUpdateUser = () => runTest('updateUser', async () => {
    return await authManager.updateUser({
      email: updateEmail || undefined,
      data: { updated_at: new Date().toISOString() }
    })
  })

  const handleRecoverPassword = () => runTest('recoverPassword', async () => {
    await authManager.requestPasswordRecovery(recoveryEmail)
    return { message: 'Recovery email sent' }
  })

  const handleRefreshToken = () => runTest('refreshToken', async () => {
    return await authManager.refreshSession()
  })

  const handleListFactors = () => runTest('listFactors', async () => {
    const result = await mfaService.listFactors()
    setFactors(result)
    return result
  })

  const handleEnrollFactor = () => runTest('enrollFactor', async () => {
    return await mfaService.enrollFactor(
      mfaFactorType,
      `My ${mfaFactorType.toUpperCase()}`,
      mfaFactorType === 'phone' ? mfaPhone : undefined
    )
  })

  const handleCreateChallenge = () => runTest('createChallenge', async () => {
    if (!selectedFactorId) throw new Error('Please select a factor first')
    const result = await mfaService.createChallenge(selectedFactorId)
    setChallengeId(result.id)
    return result
  })

  const handleVerifyChallenge = () => runTest('verifyChallenge', async () => {
    if (!selectedFactorId || !challengeId || !mfaCode) {
      throw new Error('Please provide factor ID, challenge ID, and code')
    }
    return await mfaService.verifyChallenge(selectedFactorId, challengeId, mfaCode)
  })

  const handleUnenrollFactor = () => runTest('unenrollFactor', async () => {
    if (!selectedFactorId) throw new Error('Please select a factor first')
    await mfaService.unenrollFactor(selectedFactorId)
    return { success: true }
  })

  const TestResult = ({ testName }: { testName: string }) => {
    const result = testResults[testName]
    if (!result) return null

    return (
      <div className="mt-2 p-2 border rounded text-sm">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={result.success ? "default" : "destructive"}>
            {result.success ? "✓" : "✗"}
          </Badge>
          <span className="font-medium">{testName}</span>
          <span className="text-muted-foreground">({result.duration}ms)</span>
        </div>
        {result.success && result.data && (
          <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        )}
        {!result.success && (
          <div className="text-red-600 text-xs">{result.error}</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Auth System Status</CardTitle>
          <CardDescription>
            Current authentication state and user information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Status: </span>
              <Badge variant={currentUser ? "default" : "secondary"}>
                {currentUser ? "Authenticated" : "Not authenticated"}
              </Badge>
            </div>
            {currentUser && (
              <>
                <div><span className="font-medium">User ID:</span> {currentUser.id}</div>
                <div><span className="font-medium">Email:</span> {currentUser.email}</div>
                <div><span className="font-medium">Role:</span> {currentUser.role}</div>
              </>
            )}
            {currentSession && (
              <div><span className="font-medium">Session expires:</span> {new Date(currentSession.expires_at * 1000).toLocaleString()}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="user">User Management</TabsTrigger>
          <TabsTrigger value="mfa">Multi-Factor Auth</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Use these keys to connect your applications to Supabase Lite. The anon key respects RLS policies, while the service_role key bypasses them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKeys ? (
                <>
                  {/* Anon Key */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          Anonymous Key
                          <Badge variant="secondary">anon</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Respects Row Level Security (RLS) policies. Safe to use in client-side code.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAnonKey(!showAnonKey)}
                        >
                          {showAnonKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(apiKeys.anon, 'anon')}
                        >
                          {copiedKey === 'anon' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded font-mono text-sm">
                      {showAnonKey ? apiKeys.anon : maskKey(apiKeys.anon)}
                    </div>
                  </div>

                  {/* Service Role Key */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          Service Role Key
                          <Badge variant="destructive">service_role</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Bypasses all RLS policies. Keep this secret and only use server-side.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowServiceKey(!showServiceKey)}
                        >
                          {showServiceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(apiKeys.service_role, 'service_role')}
                        >
                          {copiedKey === 'service_role' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded font-mono text-sm">
                      {showServiceKey ? apiKeys.service_role : maskKey(apiKeys.service_role)}
                    </div>
                  </div>

                  {/* Usage Examples */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Usage Examples</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-sm font-medium mb-2">Supabase.js Client</h5>
                        <pre className="bg-muted p-3 rounded text-sm overflow-auto">
{`import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  '${getBaseUrl()}',
  '${maskKey(apiKeys.anon)}' // Use anon key for client-side
)`}
                        </pre>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium mb-2">cURL Examples</h5>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">With anon key (respects RLS):</p>
                            <pre className="bg-muted p-3 rounded text-xs overflow-auto">
{`curl -X GET "${getBaseUrl()}/rest/v1/your_table" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -H "apikey: ${maskKey(apiKeys.anon)}" \\
  -H "Authorization: Bearer ${maskKey(apiKeys.anon)}"`}
                            </pre>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">With service_role key (bypasses RLS):</p>
                            <pre className="bg-muted p-3 rounded text-xs overflow-auto">
{`curl -X GET "${getBaseUrl()}/rest/v1/your_table" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -H "apikey: ${maskKey(apiKeys.service_role)}" \\
  -H "Authorization: Bearer ${maskKey(apiKeys.service_role)}"`}
                            </pre>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium mb-2">JavaScript Fetch</h5>
                        <pre className="bg-muted p-3 rounded text-sm overflow-auto">
{`fetch('${getBaseUrl()}/rest/v1/your_table', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'apikey': '${maskKey(apiKeys.anon)}',
    'Authorization': 'Bearer ${maskKey(apiKeys.anon)}'
  }
})
.then(response => response.json())
.then(data => console.log(data))`}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button onClick={generateAPIKeys} variant="outline">
                      Regenerate Keys
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Generating API keys...</p>
                  <Button onClick={generateAPIKeys}>Try Again</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sign Up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
              />
              <Button onClick={handleSignUp}>Sign Up</Button>
              <TestResult testName="signup" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Email"
                value={signinEmail}
                onChange={(e) => setSigninEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password"
                value={signinPassword}
                onChange={(e) => setSigninPassword(e.target.value)}
              />
              <Button onClick={handleSignIn}>Sign In</Button>
              <TestResult testName="signin" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={handleRefreshToken}>Refresh Token</Button>
                <Button onClick={handleSignOut} variant="destructive">Sign Out</Button>
              </div>
              <TestResult testName="refreshToken" />
              <TestResult testName="signout" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Update User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="New email (optional)"
                value={updateEmail}
                onChange={(e) => setUpdateEmail(e.target.value)}
              />
              <Button onClick={handleUpdateUser}>Update User</Button>
              <TestResult testName="updateUser" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password Recovery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Recovery email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
              />
              <Button onClick={handleRecoverPassword}>Send Recovery Email</Button>
              <TestResult testName="recoverPassword" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mfa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>MFA Factors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleListFactors}>List Factors</Button>
              <TestResult testName="listFactors" />
              
              {(factors.totp.length > 0 || factors.phone.length > 0) && (
                <div className="space-y-2">
                  <h4 className="font-medium">Current Factors:</h4>
                  {factors.totp.map((factor: any) => (
                    <div key={factor.id} className="flex items-center gap-2 p-2 border rounded">
                      <Badge>TOTP</Badge>
                      <span>{factor.friendly_name}</span>
                      <span className="text-xs text-muted-foreground">{factor.status}</span>
                    </div>
                  ))}
                  {factors.phone.map((factor: any) => (
                    <div key={factor.id} className="flex items-center gap-2 p-2 border rounded">
                      <Badge>Phone</Badge>
                      <span>{factor.phone}</span>
                      <span className="text-xs text-muted-foreground">{factor.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enroll Factor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select 
                value={mfaFactorType} 
                onChange={(e) => setMfaFactorType(e.target.value as 'totp' | 'phone')}
                className="w-full p-2 border rounded"
              >
                <option value="totp">TOTP (Authenticator)</option>
                <option value="phone">Phone (SMS)</option>
              </select>
              
              {mfaFactorType === 'phone' && (
                <Input
                  placeholder="Phone number (+1234567890)"
                  value={mfaPhone}
                  onChange={(e) => setMfaPhone(e.target.value)}
                />
              )}
              
              <Button onClick={handleEnrollFactor}>Enroll Factor</Button>
              <TestResult testName="enrollFactor" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verify Factor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Factor ID"
                value={selectedFactorId}
                onChange={(e) => setSelectedFactorId(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={handleCreateChallenge}>Create Challenge</Button>
                <Button onClick={handleUnenrollFactor} variant="destructive">Unenroll</Button>
              </div>
              <TestResult testName="createChallenge" />
              
              {challengeId && (
                <>
                  <div className="text-sm text-muted-foreground">Challenge ID: {challengeId}</div>
                  <Input
                    placeholder="Verification code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                  />
                  <Button onClick={handleVerifyChallenge}>Verify Challenge</Button>
                  <TestResult testName="verifyChallenge" />
                </>
              )}
              
              <TestResult testName="unenrollFactor" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}