import { useState } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

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
		try {
			const response = await fetch('/health')
			const data = await response.json()
			addResult('Health Check', response.status, data)
		} catch (error) {
			addResult('Health Check', undefined, undefined, (error as Error).message)
		}
		setIsLoading(false)
	}

	const testUsers = async () => {
		setIsLoading(true)
		try {
			const response = await fetch('/rest/v1/users')
			const data = await response.json()
			addResult('Get Users', response.status, data)
		} catch (error) {
			addResult('Get Users', undefined, undefined, (error as Error).message)
		}
		setIsLoading(false)
	}

	const testCreateUser = async () => {
		setIsLoading(true)
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
	}

	const testAuth = async () => {
		setIsLoading(true)
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
	}

	const testQueryParams = async () => {
		setIsLoading(true)
		try {
			const response = await fetch('/rest/v1/users?select=id,email,name&limit=5')
			const data = await response.json()
			addResult('Query with Params', response.status, data)
		} catch (error) {
			addResult('Query with Params', undefined, undefined, (error as Error).message)
		}
		setIsLoading(false)
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
				<CardContent>
					<div className='flex flex-wrap gap-2 mb-4'>
						<Button onClick={testHealth} disabled={isLoading} variant='outline'>
							Test Health Check
						</Button>
						<Button onClick={testUsers} disabled={isLoading} variant='outline'>
							Get Users
						</Button>
						<Button onClick={testCreateUser} disabled={isLoading} variant='outline'>
							Create User
						</Button>
						<Button onClick={testAuth} disabled={isLoading} variant='outline'>
							Test Auth Signup
						</Button>
						<Button onClick={testQueryParams} disabled={isLoading} variant='outline'>
							Test Query Params
						</Button>
						<Button onClick={clearResults} disabled={isLoading} variant='secondary'>
							Clear Results
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className='space-y-4'>
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
			</div>

			{results.length === 0 && (
				<Card className='border-dashed'>
					<CardContent className='flex items-center justify-center py-8'>
						<p className='text-gray-500'>Click a test button above to see results</p>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
