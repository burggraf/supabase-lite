import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import { Loader2, Play, Clock, CheckCircle, XCircle, AlertTriangle, User, Shield, Database } from 'lucide-react'
import { PostgreSTTestRunner } from '../../lib/testing/postgrest-test-runner'
import { getPostgRESTTestData } from '../../lib/testing/postgrest-test-data'
import type { PostgreSTCategory, PostgreSTTest, TestExecution } from '../../lib/testing/types'
import { RLSTestRunner } from '../../lib/testing/rls-test-runner'
import { getRLSTestData } from '../../lib/testing/rls-test-data'
import type { RLSTestItem, RLSExample, RLSTestExecution } from '../../lib/testing/rls-types'

interface TestResult {
	test: string
	status?: number
	data?: unknown
	error?: string
	timestamp: string
	category?: string
	testId?: string
	execution?: TestExecution
	rlsExecution?: RLSTestExecution
	testType?: 'postgrest' | 'rls' | 'basic'
}

export function APITester() {
	const [results, setResults] = useState<TestResult[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [loadingTest, setLoadingTest] = useState<string | null>(null)

	// PostgREST testing state
	const [postgrestRunner, setPostgrestRunner] = useState<PostgreSTTestRunner | null>(null)
	const [postgrestCategories, setPostgrestCategories] = useState<PostgreSTCategory[]>([])
	const [loadingPostgrestTest, setLoadingPostgrestTest] = useState<string | null>(null)
	const [postgrestInitialized, setPostgrestInitialized] = useState(false)

	// RLS testing state
	const [rlsRunner, setRlsRunner] = useState<RLSTestRunner | null>(null)
	const [rlsTestItems, setRlsTestItems] = useState<RLSTestItem[]>([])
	const [loadingRlsTest, setLoadingRlsTest] = useState<string | null>(null)
	const [rlsInitialized, setRlsInitialized] = useState(false)

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

	// Initialize PostgREST test runner
	useEffect(() => {
		const initializePostgREST = async () => {
			try {
				const testData = await getPostgRESTTestData()
				const runner = new PostgreSTTestRunner()
				runner.loadTestData(testData)
				setPostgrestRunner(runner)
				setPostgrestCategories(testData)
				setPostgrestInitialized(true)
			} catch (error) {
				console.error('Failed to initialize PostgREST test runner:', error)
				setPostgrestInitialized(true) // Still mark as initialized to prevent infinite loading
			}
		}

		initializePostgREST()
	}, [])

	// Initialize RLS test runner
	useEffect(() => {
		const initializeRLS = async () => {
			try {
				const testData = await getRLSTestData()
				const runner = new RLSTestRunner()
				runner.loadTestData(testData)
				setRlsRunner(runner)
				setRlsTestItems(testData)
				setRlsInitialized(true)
			} catch (error) {
				console.error('Failed to initialize RLS test runner:', error)
				setRlsInitialized(true) // Still mark as initialized to prevent infinite loading
			}
		}

		initializeRLS()
	}, [])

	// Enhanced addResult for PostgREST tests
	const addPostgRESTResult = (execution: TestExecution) => {
		const result: TestResult = {
			test: `${execution.category.title} - ${execution.test.name}`,
			status: execution.actualResult?.status,
			data: execution.actualResult,
			error: execution.error,
			timestamp: new Date().toLocaleTimeString(),
			category: execution.category.id,
			testId: execution.test.id,
			execution,
			testType: 'postgrest'
		}
		setResults((prev) => [result, ...prev])
	}

	// Enhanced addResult for RLS tests
	const addRLSResult = (execution: RLSTestExecution) => {
		const result: TestResult = {
			test: `${execution.testItem.title} - ${execution.example.name}`,
			status: execution.status === 'completed' ? 200 : execution.status === 'failed' ? 400 : undefined,
			data: execution.stepResults,
			error: execution.error,
			timestamp: new Date().toLocaleTimeString(),
			category: execution.testItem.id,
			testId: execution.example.id,
			rlsExecution: execution,
			testType: 'rls'
		}
		setResults((prev) => [result, ...prev])
	}

	// Run a single PostgREST test
	const runPostgRESTTest = async (categoryId: string, testId: string) => {
		if (!postgrestRunner) return

		const testKey = `${categoryId}.${testId}`
		setIsLoading(true)
		setLoadingPostgrestTest(testKey)

		try {
			const execution = await postgrestRunner.executeTest(categoryId, testId)
			addPostgRESTResult(execution)
		} catch (error) {
			addResult(
				`PostgREST Test Error - ${categoryId}.${testId}`,
				undefined,
				undefined,
				error instanceof Error ? error.message : String(error)
			)
		}

		setIsLoading(false)
		setLoadingPostgrestTest(null)
	}

	// Run all tests in a PostgREST category
	const runPostgRESTCategoryTests = async (categoryId: string) => {
		if (!postgrestRunner) return

		const category = postgrestRunner.getCategory(categoryId)
		if (!category) return

		setIsLoading(true)
		setLoadingPostgrestTest(`category.${categoryId}`)

		try {
			await postgrestRunner.executeCategoryTests(categoryId, (execution) => {
				addPostgRESTResult(execution)
			})
		} catch (error) {
			addResult(
				`PostgREST Category Error - ${categoryId}`,
				undefined,
				undefined,
				error instanceof Error ? error.message : String(error)
			)
		}

		setIsLoading(false)
		setLoadingPostgrestTest(null)
	}

	// Run a single RLS example
	const runRLSExample = async (itemId: string, exampleId: string) => {
		if (!rlsRunner) return

		const testKey = `${itemId}.${exampleId}`
		setIsLoading(true)
		setLoadingRlsTest(testKey)

		try {
			const execution = await rlsRunner.executeExample(itemId, exampleId)
			addRLSResult(execution)
		} catch (error) {
			addResult(
				`RLS Test Error - ${itemId}.${exampleId}`,
				undefined,
				undefined,
				error instanceof Error ? error.message : String(error),
			)
		}

		setIsLoading(false)
		setLoadingRlsTest(null)
	}

	// Run all examples in an RLS test item
	const runRLSTestItemExamples = async (itemId: string) => {
		if (!rlsRunner) return

		const testItem = rlsRunner.getTestItem(itemId)
		if (!testItem) return

		setIsLoading(true)
		setLoadingRlsTest(`item.${itemId}`)

		try {
			await rlsRunner.executeTestItemExamples(itemId, (execution) => {
				addRLSResult(execution)
			})
		} catch (error) {
			addResult(
				`RLS Test Item Error - ${itemId}`,
				undefined,
				undefined,
				error instanceof Error ? error.message : String(error)
			)
		}

		setIsLoading(false)
		setLoadingRlsTest(null)
	}

	// Get test status for UI
	const getTestStatus = (test: PostgreSTTest) => {
		if (test.unsupported) return 'unsupported'
		if (test.results?.passed) return 'passed'
		if (test.results?.passed === false) return 'failed'
		return 'pending'
	}

	// Get status icon
	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'passed':
				return <CheckCircle className="h-3 w-3 text-green-500" />
			case 'failed':
				return <XCircle className="h-3 w-3 text-red-500" />
			case 'unsupported':
				return <AlertTriangle className="h-3 w-3 text-yellow-500" />
			default:
				return <Clock className="h-3 w-3 text-gray-400" />
		}
	}

	// Get status badge
	const getStatusBadge = (status: string) => {
		const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
			passed: 'default',
			failed: 'destructive',
			unsupported: 'secondary',
			pending: 'outline'
		}

		return (
			<Badge variant={variants[status] || 'outline'} className="text-xs">
				{status}
			</Badge>
		)
	}

	// Get RLS example status for UI
	const getRLSExampleStatus = (example: RLSExample) => {
		if (example.results?.passed) return 'passed'
		if (example.results?.passed === false) return 'failed'
		return 'pending'
	}

	// Get auth context icon
	const getAuthContextIcon = (runner: RLSTestRunner | null) => {
		if (!runner) return <User className="h-3 w-3 text-gray-400" />

		const authContext = runner.getAuthContext()
		if (authContext.serviceRole) {
			return <Shield className="h-3 w-3 text-purple-500" title="Service Role" />
		}
		if (authContext.currentUser) {
			return <User className="h-3 w-3 text-blue-500" title={`User: ${authContext.currentUser.email}`} />
		}
		return <User className="h-3 w-3 text-gray-400" title="Anonymous" />
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

			<Alert variant="destructive">
				<AlertTriangle className="h-4 w-4" />
				<AlertDescription>
					<strong>WARNING:</strong> Running any API tests may reset your entire database. DO NOT run any tests on a project that contains any data you need to keep.
				</AlertDescription>
			</Alert>

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

								<AccordionItem value="postgrest">
									<AccordionTrigger className="text-sm font-medium">
										PostgREST Tests
										{postgrestCategories && postgrestCategories.length > 0 && (
											<Badge variant="outline" className="ml-2 text-xs">
												{postgrestCategories?.reduce((total, cat) => total + (cat.examples?.length || 0), 0) || 0}
											</Badge>
										)}
									</AccordionTrigger>
									<AccordionContent>
										<div className="space-y-3">
											<div className="text-xs text-gray-600 mb-3">
												Comprehensive PostgREST API compatibility tests from the official Supabase test suite
											</div>

											{!postgrestInitialized ? (
												<div className="text-xs text-gray-500 italic">Loading test categories...</div>
											) : !postgrestCategories || postgrestCategories.length === 0 ? (
												<div className="text-xs text-gray-500 italic">No test categories found</div>
											) : (
												<Accordion type="single" collapsible className="w-full">
													{postgrestCategories?.map((category) => {
														const categoryStats = postgrestRunner?.getCategoryStats(category.id)
														return (
															<AccordionItem key={category.id} value={category.id} className="border-l-2 border-blue-100">
																<AccordionTrigger className="text-xs font-medium py-2">
																	<div className="flex items-center justify-between w-full mr-2">
																		<span className="text-left">{category.title}</span>
																		<div className="flex items-center space-x-1">
																			<Badge variant="outline" className="text-xs">
																				{category.examples?.length || 0}
																			</Badge>
																			{categoryStats && (
																				<div className="flex space-x-1">
																					{categoryStats.passed > 0 && (
																						<Badge variant="default" className="text-xs">
																							{categoryStats.passed}
																						</Badge>
																					)}
																					{categoryStats.failed > 0 && (
																						<Badge variant="destructive" className="text-xs">
																							{categoryStats.failed}
																						</Badge>
																					)}
																					{categoryStats.unsupported > 0 && (
																						<Badge variant="secondary" className="text-xs">
																							{categoryStats.unsupported}
																						</Badge>
																					)}
																				</div>
																			)}
																		</div>
																	</div>
																</AccordionTrigger>
																<AccordionContent className="space-y-2 pl-2">
																	<div className="flex items-center justify-between mb-2">
																		<span className="text-xs text-gray-600">{category.examples?.length || 0} tests</span>
																		<Button
																			onClick={() => runPostgRESTCategoryTests(category.id)}
																			disabled={isLoading}
																			variant="outline"
																			size="sm"
																			className="text-xs h-6 px-2"
																		>
																			{loadingPostgrestTest === `category.${category.id}` && (
																				<Loader2 className="mr-1 h-2 w-2 animate-spin" />
																			)}
																			Run All
																		</Button>
																	</div>

																	<div className="space-y-1 max-h-32 overflow-y-auto">
																		{(category.examples || []).map((test) => {
																			const status = getTestStatus(test)
																			const testKey = `${category.id}.${test.id}`
																			const isTestLoading = loadingPostgrestTest === testKey

																			return (
																				<div key={test.id} className="flex items-center justify-between p-2 rounded bg-gray-50 hover:bg-gray-100">
																					<div className="flex items-center space-x-2 flex-1 min-w-0">
																						{getStatusIcon(status)}
																						<span className="text-xs truncate" title={test.name}>
																							{test.name}
																						</span>
																						{getStatusBadge(status)}
																					</div>
																					<Button
																						onClick={() => runPostgRESTTest(category.id, test.id)}
																						disabled={isLoading || test.unsupported}
																						variant="ghost"
																						size="sm"
																						className="text-xs h-6 w-6 p-0 ml-2 flex-shrink-0"
																						title={test.unsupported ? "Unsupported by PGlite" : "Run test"}
																					>
																						{isTestLoading ? (
																							<Loader2 className="h-3 w-3 animate-spin" />
																						) : (
																							<Play className="h-3 w-3" />
																						)}
																					</Button>
																				</div>
																			)
																		})}
																	</div>
																</AccordionContent>
															</AccordionItem>
														)
													})}
												</Accordion>
											)}
										</div>
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="rls">
									<AccordionTrigger className="text-sm font-medium">
										RLS Tests
										{getAuthContextIcon(rlsRunner)}
										{rlsTestItems && rlsTestItems.length > 0 && (
											<Badge variant="outline" className="ml-2 text-xs">
												{rlsTestItems?.reduce((total, item) => total + (item.examples?.length || 0), 0) || 0}
											</Badge>
										)}
									</AccordionTrigger>
									<AccordionContent>
										<div className="space-y-3">
											<div className="text-xs text-gray-600 mb-3">
												Row Level Security tests covering authentication, policies, and data isolation scenarios
											</div>

											{!rlsInitialized ? (
												<div className="text-xs text-gray-500 italic">Loading RLS test items...</div>
											) : !rlsTestItems || rlsTestItems.length === 0 ? (
												<div className="text-xs text-gray-500 italic">No RLS test items found</div>
											) : (
												<Accordion type="single" collapsible className="w-full">
													{rlsTestItems?.map((testItem) => {
														const itemStats = rlsRunner?.getTestItemStats(testItem.id)
														return (
															<AccordionItem key={testItem.id} value={testItem.id} className="border-l-2 border-orange-100">
																<AccordionTrigger className="text-xs font-medium py-2">
																	<div className="flex items-center justify-between w-full mr-2">
																		<span className="text-left">{testItem.title}</span>
																		<div className="flex items-center space-x-1">
																			<Badge variant="outline" className="text-xs">
																				{testItem.examples?.length || 0}
																			</Badge>
																			{itemStats && (
																				<div className="flex space-x-1">
																					{itemStats.passed > 0 && (
																						<Badge variant="default" className="text-xs">
																							{itemStats.passed}
																						</Badge>
																					)}
																					{itemStats.failed > 0 && (
																						<Badge variant="destructive" className="text-xs">
																							{itemStats.failed}
																						</Badge>
																					)}
																				</div>
																			)}
																		</div>
																	</div>
																</AccordionTrigger>
																<AccordionContent className="space-y-2 pl-2">
																	<div className="flex items-center justify-between mb-2">
																		<div className="text-xs text-gray-600">
																			<div>{testItem.examples?.length || 0} workflow examples</div>
																			<div className="text-xs text-gray-500 mt-1">{testItem.description}</div>
																		</div>
																		<Button
																			onClick={() => runRLSTestItemExamples(testItem.id)}
																			disabled={isLoading}
																			variant="outline"
																			size="sm"
																			className="text-xs h-6 px-2"
																		>
																			{loadingRlsTest === `item.${testItem.id}` && (
																				<Loader2 className="mr-1 h-2 w-2 animate-spin" />
																			)}
																			Run All
																		</Button>
																	</div>

																	<div className="space-y-1 max-h-32 overflow-y-auto">
																		{(testItem.examples || []).map((example) => {
																			const status = getRLSExampleStatus(example)
																			const testKey = `${testItem.id}.${example.id}`
																			const isTestLoading = loadingRlsTest === testKey

																			return (
																				<div key={example.id} className="flex items-center justify-between p-2 rounded bg-gray-50 hover:bg-gray-100">
																					<div className="flex items-center space-x-2 flex-1 min-w-0">
																						{getStatusIcon(status)}
																						<div className="flex flex-col min-w-0 flex-1">
																							<span className="text-xs truncate" title={example.name}>
																								{example.name}
																							</span>
																							<div className="text-xs text-gray-500 flex items-center space-x-2">
																								<Database className="h-3 w-3" />
																								<span>{example.workflow.length} steps</span>
																							</div>
																						</div>
																						{getStatusBadge(status)}
																					</div>
																					<Button
																						onClick={() => runRLSExample(testItem.id, example.id)}
																						disabled={isLoading}
																						variant="ghost"
																						size="sm"
																						className="text-xs h-6 w-6 p-0 ml-2 flex-shrink-0"
																						title="Run RLS workflow"
																					>
																						{isTestLoading ? (
																							<Loader2 className="h-3 w-3 animate-spin" />
																						) : (
																							<Play className="h-3 w-3" />
																						)}
																					</Button>
																				</div>
																			)
																		})}
																	</div>
																</AccordionContent>
															</AccordionItem>
														)
													})}
												</Accordion>
											)}
										</div>
									</AccordionContent>
								</AccordionItem>
							</Accordion>

							<div className="mt-4 space-y-2">
								{postgrestRunner && (
									<Button
										onClick={async () => {
											if (!postgrestRunner) return
											setIsLoading(true)
											setLoadingPostgrestTest('all')
											try {
												await postgrestRunner.executeAllTests((execution) => {
													addPostgRESTResult(execution)
												})
											} catch (error) {
												addResult(
													'PostgREST Bulk Test Error',
													undefined,
													undefined,
													error instanceof Error ? error.message : String(error)
												)
											}
											setIsLoading(false)
											setLoadingPostgrestTest(null)
										}}
										disabled={isLoading}
										variant="default"
										size="sm"
										className="w-full"
									>
										{loadingPostgrestTest === 'all' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
										🚀 Run All PostgREST Tests
									</Button>
								)}
								{rlsRunner && (
									<Button
										onClick={async () => {
											if (!rlsRunner) return
											setIsLoading(true)
											setLoadingRlsTest('all')
											try {
												await rlsRunner.executeAllTests((execution) => {
													addRLSResult(execution)
												})
											} catch (error) {
												addResult(
													'RLS Bulk Test Error',
													undefined,
													undefined,
													error instanceof Error ? error.message : String(error)
												)
											}
											setIsLoading(false)
											setLoadingRlsTest(null)
										}}
										disabled={isLoading}
										variant="outline"
										size="sm"
										className="w-full"
									>
										{loadingRlsTest === 'all' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
										🔒 Run All RLS Tests
									</Button>
								)}
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
								{results.map((result, index) => {
									const isPostgRESTTest = result.execution !== undefined
									const isRLSTest = result.rlsExecution !== undefined
									const execution = result.execution
									const rlsExecution = result.rlsExecution

									return (
										<Card
											key={index}
											className={result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}
										>
											<CardHeader className='pb-2'>
												<div className='flex items-center justify-between'>
													<div className="flex flex-col space-y-1">
														<CardTitle className='text-sm font-medium'>
															{result.test}
															{result.status && (
																<span className='ml-2 text-xs bg-gray-100 px-2 py-1 rounded'>
																	{result.status}
																</span>
															)}
															{result.testType && (
																<span className={`ml-2 text-xs px-2 py-1 rounded ${
																	result.testType === 'postgrest' ? 'bg-blue-100 text-blue-800' :
																	result.testType === 'rls' ? 'bg-orange-100 text-orange-800' :
																	'bg-gray-100 text-gray-800'
																}`}>
																	{result.testType === 'postgrest' ? 'PostgREST' :
																	 result.testType === 'rls' ? 'RLS' : 'Basic'}
																</span>
															)}
														</CardTitle>
														{isPostgRESTTest && execution && (
															<div className="flex items-center space-x-2 text-xs text-gray-600">
																<span>ID: {execution.test.id}</span>
																<span>•</span>
																<span>Category: {execution.category.id}</span>
																{execution.startTime && execution.endTime && (
																	<>
																		<span>•</span>
																		<span>Duration: {execution.endTime - execution.startTime}ms</span>
																	</>
																)}
															</div>
														)}
														{isRLSTest && rlsExecution && (
															<div className="flex items-center space-x-2 text-xs text-gray-600">
																<span>ID: {rlsExecution.example.id}</span>
																<span>•</span>
																<span>Test Item: {rlsExecution.testItem.id}</span>
																<span>•</span>
																<span>Steps: {rlsExecution.example.workflow.length}</span>
																{rlsExecution.startTime && rlsExecution.endTime && (
																	<>
																		<span>•</span>
																		<span>Duration: {rlsExecution.endTime - rlsExecution.startTime}ms</span>
																	</>
																)}
															</div>
														)}
													</div>
													<span className='text-xs text-gray-500'>{result.timestamp}</span>
												</div>
											</CardHeader>
											<CardContent className='pt-0'>
												{isRLSTest && rlsExecution ? (
													<div className="space-y-3">
														{/* Workflow Description */}
														<div>
															<div className="text-xs font-medium text-gray-600 mb-1">Workflow Description:</div>
															<div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
																{rlsExecution.example.description}
															</div>
														</div>

														{/* Workflow Steps */}
														<Accordion type="single" collapsible className="w-full">
															<AccordionItem value="workflow" className="border-none">
																<AccordionTrigger className="text-xs font-medium py-1 hover:no-underline">
																	Workflow Steps ({rlsExecution.example.workflow.length})
																</AccordionTrigger>
																<AccordionContent>
																	<div className="space-y-2 max-h-32 overflow-y-auto">
																		{rlsExecution.example.workflow.map((step, stepIndex) => (
																			<div key={stepIndex} className="flex items-start space-x-2 text-xs">
																				<span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-mono min-w-[2rem] text-center">
																					{stepIndex + 1}
																				</span>
																				<div className="flex-1">
																					<div className="font-medium">{step.name}</div>
																					<div className="text-gray-600">Operation: {step.operation}</div>
																					{step.sql && (
																						<div className="text-xs text-gray-500 mt-1 font-mono bg-gray-50 p-1 rounded">
																							{step.sql.substring(0, 100)}{step.sql.length > 100 ? '...' : ''}
																						</div>
																					)}
																				</div>
																			</div>
																		))}
																	</div>
																</AccordionContent>
															</AccordionItem>
														</Accordion>

														{/* Test Item Details */}
														<div>
															<div className="text-xs font-medium text-gray-600 mb-1">Test Item:</div>
															<div className="text-xs text-gray-700">{rlsExecution.testItem.title}</div>
															<div className="text-xs text-gray-500 mt-1">{rlsExecution.testItem.description}</div>
														</div>

														{/* Error Details */}
														{result.error && (
															<div>
																<div className="text-xs font-medium text-red-600 mb-1">Error:</div>
																<pre className='text-xs bg-white p-3 rounded border overflow-auto max-h-32 text-red-600'>
																	{result.error}
																</pre>
															</div>
														)}

														{/* Step Results */}
														{rlsExecution.stepResults && rlsExecution.stepResults.length > 0 && (
															<Accordion type="single" collapsible className="w-full">
																<AccordionItem value="results" className="border-none">
																	<AccordionTrigger className="text-xs font-medium py-1 hover:no-underline">
																		Step Results
																	</AccordionTrigger>
																	<AccordionContent>
																		<div className="space-y-2 max-h-32 overflow-y-auto">
																			{rlsExecution.stepResults.map((stepResult, stepIndex) => (
																				<div key={stepIndex} className="text-xs border rounded p-2">
																					<div className="flex items-center justify-between">
																						<span className="font-medium">{stepResult.step.name}</span>
																						<Badge variant={stepResult.status === 'completed' ? 'default' : stepResult.status === 'failed' ? 'destructive' : 'outline'} className="text-xs">
																							{stepResult.status}
																						</Badge>
																					</div>
																					{stepResult.error && (
																						<div className="text-red-600 mt-1">{stepResult.error}</div>
																					)}
																				</div>
																			))}
																		</div>
																	</AccordionContent>
																</AccordionItem>
															</Accordion>
														)}
													</div>
												) : isPostgRESTTest && execution ? (
													<div className="space-y-3">
														{/* Test Code */}
														{execution.test.code && (
															<Accordion type="single" collapsible className="w-full">
																<AccordionItem value="code" className="border-none">
																	<AccordionTrigger className="text-xs font-medium py-1 hover:no-underline">
																		Test Code
																	</AccordionTrigger>
																	<AccordionContent>
																		<pre className='text-xs bg-white p-3 rounded border overflow-auto max-h-24 whitespace-pre-wrap'>
																			{execution.test.code.replace(/```(?:js|ts)?\n?/g, '').replace(/\n?```/g, '')}
																		</pre>
																	</AccordionContent>
																</AccordionItem>
															</Accordion>
														)}

														{/* SQL Setup Data */}
														{execution.test.data?.sql && (
															<Accordion type="single" collapsible className="w-full">
																<AccordionItem value="sql" className="border-none">
																	<AccordionTrigger className="text-xs font-medium py-1 hover:no-underline">
																		SQL Setup
																	</AccordionTrigger>
																	<AccordionContent>
																		<pre className='text-xs bg-white p-3 rounded border overflow-auto max-h-24 whitespace-pre-wrap'>
																			{execution.test.data.sql.replace(/```sql\n?/g, '').replace(/\n?```/g, '')}
																		</pre>
																	</AccordionContent>
																</AccordionItem>
															</Accordion>
														)}

														{/* Results Comparison */}
														{execution.expectedResult && (
															<div className="space-y-2">
																<div className="text-xs font-medium">Results:</div>
																<div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
																	<div>
																		<div className="text-xs font-medium text-gray-600 mb-1">Expected:</div>
																		<pre className='text-xs bg-white p-2 rounded border overflow-auto max-h-24'>
																			{JSON.stringify(execution.expectedResult, null, 2)}
																		</pre>
																	</div>
																	<div>
																		<div className="text-xs font-medium text-gray-600 mb-1">Actual:</div>
																		<pre className='text-xs bg-white p-2 rounded border overflow-auto max-h-24'>
																			{JSON.stringify(execution.actualResult, null, 2)}
																		</pre>
																	</div>
																</div>
															</div>
														)}

														{/* Error Details */}
														{result.error && (
															<div>
																<div className="text-xs font-medium text-red-600 mb-1">Error:</div>
																<pre className='text-xs bg-white p-3 rounded border overflow-auto max-h-32 text-red-600'>
																	{result.error}
																</pre>
															</div>
														)}
													</div>
												) : (
													<pre className='text-xs bg-white p-3 rounded border overflow-auto max-h-32'>
														{result.error
															? JSON.stringify({ error: result.error }, null, 2)
															: JSON.stringify(result.data, null, 2)}
													</pre>
												)}
											</CardContent>
										</Card>
									)
								})}

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