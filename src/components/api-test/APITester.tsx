import { useState } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion'
import { Loader2 } from 'lucide-react'

interface TestResult {
	test: string
	status?: number
	data?: unknown
	error?: string
	timestamp: string
}

export function APITester() {
	const [results, setResults] = useState<TestResult[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [loadingTest, setLoadingTest] = useState<string | null>(null)

	const addResult = (test: string, status?: number, data?: unknown, error?: string) => {
		const result: TestResult = {
			test,
			status,
			data,
			error,
			timestamp: new Date().toLocaleTimeString(),
		}
		setResults((prev) => [result, ...prev])
	}

	const testHealth = async () => {
		setIsLoading(true)
		setLoadingTest('health')
		try {
			const response = await fetch('/health')
			const data = await response.json()
			addResult('Health Check', response.status, data)
		} catch (error) {
			addResult('Health Check', undefined, undefined, (error as Error).message)
		}
		setIsLoading(false)
		setLoadingTest(null)
	}

	const testUsers = async () => {
		setIsLoading(true)
		setLoadingTest('users')
		try {
			const response = await fetch('/rest/v1/users')
			const data = await response.json()
			addResult('Get Users', response.status, data)
		} catch (error) {
			addResult('Get Users', undefined, undefined, (error as Error).message)
		}
		setIsLoading(false)
		setLoadingTest(null)
	}

	const testCreateUser = async () => {
		setIsLoading(true)
		setLoadingTest('create-user')
		try {
			const response = await fetch('/rest/v1/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'test@example.com',
					name: 'Test User',
					created_at: new Date().toISOString(),
				}),
			})
			const data = await response.json()
			addResult('Create User', response.status, data)
		} catch (error) {
			addResult('Create User', undefined, undefined, (error as Error).message)
		}
		setIsLoading(false)
		setLoadingTest(null)
	}

	const testAuth = async () => {
		setIsLoading(true)
		setLoadingTest('auth')
		try {
			const response = await fetch('/auth/v1/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'auth@example.com',
					password: 'Password123$',
					name: 'Auth User',
				}),
			})
			const data = await response.json()
			addResult('Auth Signup', response.status, data)
		} catch (error) {
			addResult('Auth Signup', undefined, undefined, (error as Error).message)
		}
		setIsLoading(false)
		setLoadingTest(null)
	}

	const testQueryParams = async () => {
		setIsLoading(true)
		setLoadingTest('query-params')
		try {
			const response = await fetch('/rest/v1/users?select=id,email,name&limit=5')
			const data = await response.json()
			addResult('Query with Params', response.status, data)
		} catch (error) {
			addResult('Query with Params', undefined, undefined, (error as Error).message)
		}
		setIsLoading(false)
		setLoadingTest(null)
	}

	const clearResults = () => {
		setResults([])
	}

	return (
		<div className='space-y-6'>
			<Card>
				<CardHeader>
					<CardTitle>🚀 API Tester</CardTitle>
					<CardDescription>
						Test the browser-only Supabase API endpoints using MSW + PGlite
					</CardDescription>
				</CardHeader>
			</Card>

			<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
				{/* Left Column - Test Categories */}
				<div className='lg:col-span-1'>
					<Card>
						<CardHeader className='pb-3'>
							<CardTitle className='text-lg'>Test Categories</CardTitle>
						</CardHeader>
						<CardContent>
							<Accordion type="single" collapsible className="w-full">
								<AccordionItem value="health">
									<AccordionTrigger className="text-sm font-medium">
										System Health
									</AccordionTrigger>
									<AccordionContent className="space-y-3">
										<Button
											onClick={testHealth}
											disabled={isLoading}
											variant='outline'
											size="sm"
											className="w-full justify-start"
										>
											{loadingTest === 'health' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
											Health Check
										</Button>
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="rest">
									<AccordionTrigger className="text-sm font-medium">
										REST API
									</AccordionTrigger>
									<AccordionContent className="space-y-3">
										<Button
											onClick={testUsers}
											disabled={isLoading}
											variant='outline'
											size="sm"
											className="w-full justify-start"
										>
											{loadingTest === 'users' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
											Get Users
										</Button>
										<Button
											onClick={testCreateUser}
											disabled={isLoading}
											variant='outline'
											size="sm"
											className="w-full justify-start"
										>
											{loadingTest === 'create-user' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
											Create User
										</Button>
										<Button
											onClick={testQueryParams}
											disabled={isLoading}
											variant='outline'
											size="sm"
											className="w-full justify-start"
										>
											{loadingTest === 'query-params' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
											Query with Params
										</Button>
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="auth">
									<AccordionTrigger className="text-sm font-medium">
										Authentication
									</AccordionTrigger>
									<AccordionContent className="space-y-3">
										<Button
											onClick={testAuth}
											disabled={isLoading}
											variant='outline'
											size="sm"
											className="w-full justify-start"
										>
											{loadingTest === 'auth' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
											Auth Signup
										</Button>
									</AccordionContent>
								</AccordionItem>
							</Accordion>

							<div className="mt-4">
								<Button
									onClick={clearResults}
									disabled={isLoading}
									variant='secondary'
									size="sm"
									className="w-full"
								>
									Clear Results
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Right Column - Results */}
				<div className='lg:col-span-2'>
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className='text-lg'>Test Results</CardTitle>
								<div className="text-xs text-gray-500">
									{results.length} result{results.length !== 1 ? 's' : ''}
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className='space-y-4 max-h-[600px] overflow-y-auto'>
								{results.map((result, index) => (
									<Card
										key={index}
										className={result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
										<CardHeader className='pb-2'>
											<div className='flex items-center justify-between'>
												<CardTitle className='text-sm font-medium'>
													{result.test}
													{result.status && (
														<span className='ml-2 text-xs bg-gray-100 px-2 py-1 rounded'>
															{result.status}
														</span>
													)}
												</CardTitle>
												<span className='text-xs text-gray-500'>{result.timestamp}</span>
											</div>
										</CardHeader>
										<CardContent className='pt-0'>
											<pre className='text-xs bg-white p-3 rounded border overflow-auto max-h-32'>
												{result.error
													? JSON.stringify({ error: result.error }, null, 2)
													: JSON.stringify(result.data, null, 2)}
											</pre>
										</CardContent>
									</Card>
								))}

								{results.length === 0 && (
									<Card className='border-dashed'>
										<CardContent className='flex items-center justify-center py-8'>
											<p className='text-gray-500'>
												Select a test from the categories on the left to see results
											</p>
										</CardContent>
									</Card>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}