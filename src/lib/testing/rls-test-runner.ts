import { RLSExecutionEngine } from './rls-execution-engine';
import type {
	RLSTestConfig,
	RLSTestItem,
	RLSExample,
	RLSTestExecution,
	RLSTestSuiteExecution,
	WorkflowStepResult,
	TestResults
} from './rls-types';

export class RLSTestRunner {
	private config: RLSTestConfig;
	private executionEngine: RLSExecutionEngine;
	private testData: RLSTestItem[] = [];

	constructor(config?: Partial<RLSTestConfig>) {
		const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
		this.config = {
			supabaseLiteUrl: currentOrigin,
			debugSqlEndpoint: `${currentOrigin}/debug/sql`,
			anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
			serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
			skipOnFirstFailure: false,
			maxRetries: 3,
			...config
		};

		this.executionEngine = new RLSExecutionEngine(this.config);
	}

	/**
	 * Load test data from the RLS test JSON
	 */
	loadTestData(testData: RLSTestItem[]): void {
		this.testData = testData;
	}

	/**
	 * Get all test items (categories)
	 */
	getTestItems(): RLSTestItem[] {
		return this.testData;
	}

	/**
	 * Get a specific test item by ID
	 */
	getTestItem(itemId: string): RLSTestItem | undefined {
		return this.testData.find(item => item.id === itemId);
	}

	/**
	 * Get a specific example by item and example ID
	 */
	getExample(itemId: string, exampleId: string): RLSExample | undefined {
		const testItem = this.getTestItem(itemId);
		if (!testItem) return undefined;
		return testItem.examples?.find(example => example.id === exampleId);
	}

	/**
	 * Get all examples from all test items
	 */
	getAllExamples(): Array<{ testItem: RLSTestItem; example: RLSExample }> {
		const allExamples: Array<{ testItem: RLSTestItem; example: RLSExample }> = [];

		for (const testItem of this.testData) {
			for (const example of testItem.examples || []) {
				allExamples.push({ testItem, example });
			}
		}

		return allExamples;
	}

	/**
	 * Execute a single RLS example
	 */
	async executeExample(itemId: string, exampleId: string): Promise<RLSTestExecution> {
		const testItem = this.getTestItem(itemId);
		const example = this.getExample(itemId, exampleId);

		if (!testItem || !example) {
			throw new Error(`RLS test not found: ${itemId}.${exampleId}`);
		}

		const execution: RLSTestExecution = {
			example,
			testItem,
			status: 'running',
			startTime: Date.now(),
			currentStepIndex: 0,
			stepResults: []
		};

		try {
			// Reset context before each test for isolation (including clearing Supabase client session)
			await this.executionEngine.resetContextAsync();

			// Execute the workflow example
			const results = await this.executionEngine.executeExample(example);

			// Update execution with results
			execution.status = results.passed ? 'completed' : 'failed';
			execution.endTime = Date.now();

			if (!results.passed) {
				const errorLogs = results.log.filter(log => log.type === 'error');
				execution.error = errorLogs.length > 0
					? errorLogs[errorLogs.length - 1].message
					: 'Unknown error';
			}

			// Update the example's results for future reference
			example.results = results;

		} catch (error) {
			execution.status = 'failed';
			execution.endTime = Date.now();
			execution.error = error instanceof Error ? error.message : String(error);

			// Update the example's results
			example.results = {
				passed: false,
				log: [{
					type: 'error',
					message: execution.error,
					timestamp: new Date().toISOString()
				}],
				skip: false
			};
		}

		return execution;
	}

	/**
	 * Execute all examples in a test item
	 */
	async executeTestItemExamples(
		itemId: string,
		onExampleComplete?: (execution: RLSTestExecution) => void
	): Promise<RLSTestExecution[]> {
		const testItem = this.getTestItem(itemId);
		if (!testItem) {
			throw new Error(`RLS test item not found: ${itemId}`);
		}

		const executions: RLSTestExecution[] = [];

		for (const example of testItem.examples || []) {
			const execution = await this.executeExample(itemId, example.id);
			executions.push(execution);

			if (onExampleComplete) {
				onExampleComplete(execution);
			}

			// Stop on first failure if configured
			if (this.config.skipOnFirstFailure && execution.status === 'failed') {
				break;
			}
		}

		return executions;
	}

	/**
	 * Execute all RLS tests
	 */
	async executeAllTests(
		onExampleComplete?: (execution: RLSTestExecution) => void,
		onTestItemComplete?: (itemId: string, executions: RLSTestExecution[]) => void
	): Promise<RLSTestSuiteExecution> {
		const allExecutions = new Map<string, RLSTestExecution>();
		const stats = {
			total: 0,
			passed: 0,
			failed: 0,
			skipped: 0
		};

		for (const testItem of this.testData) {
			const itemExecutions = await this.executeTestItemExamples(
				testItem.id,
				(execution) => {
					const key = `${execution.testItem.id}.${execution.example.id}`;
					allExecutions.set(key, execution);

					// Update stats
					stats.total++;
					if (execution.status === 'completed') {
						stats.passed++;
					} else if (execution.status === 'failed') {
						stats.failed++;
					} else {
						stats.skipped++;
					}

					if (onExampleComplete) {
						onExampleComplete(execution);
					}
				}
			);

			if (onTestItemComplete) {
				onTestItemComplete(testItem.id, itemExecutions);
			}

			// Stop on first failure if configured
			if (this.config.skipOnFirstFailure && itemExecutions.some(e => e.status === 'failed')) {
				break;
			}
		}

		return {
			testItems: this.testData,
			executions: allExecutions,
			stats
		};
	}

	/**
	 * Get test statistics for a specific test item
	 */
	getTestItemStats(itemId: string): {
		total: number;
		passed: number;
		failed: number;
		skipped: number;
	} {
		const testItem = this.getTestItem(itemId);
		if (!testItem) {
			return { total: 0, passed: 0, failed: 0, skipped: 0 };
		}

		const stats = {
			total: testItem.examples?.length || 0,
			passed: 0,
			failed: 0,
			skipped: 0
		};

		for (const example of testItem.examples || []) {
			if (example.results?.passed) {
				stats.passed++;
			} else if (example.results?.passed === false) {
				stats.failed++;
			} else {
				// No results yet - count as skipped for now
				stats.skipped++;
			}
		}

		return stats;
	}

	/**
	 * Get overall test statistics
	 */
	getOverallStats(): {
		total: number;
		passed: number;
		failed: number;
		skipped: number;
		testItems: number;
	} {
		const stats = {
			total: 0,
			passed: 0,
			failed: 0,
			skipped: 0,
			testItems: this.testData.length
		};

		for (const testItem of this.testData) {
			const itemStats = this.getTestItemStats(testItem.id);
			stats.total += itemStats.total;
			stats.passed += itemStats.passed;
			stats.failed += itemStats.failed;
			stats.skipped += itemStats.skipped;
		}

		return stats;
	}

	/**
	 * Reset all test results
	 */
	resetAllResults(): void {
		for (const testItem of this.testData) {
			for (const example of testItem.examples || []) {
				delete example.results;
			}
		}
	}

	/**
	 * Get current authentication context
	 */
	getAuthContext(): {
		currentUser: any;
		serviceRole: boolean;
	} {
		const context = this.executionEngine.getContext();
		return {
			currentUser: context.currentUser,
			serviceRole: context.serviceRole
		};
	}

	/**
	 * Export test results for debugging
	 */
	exportResults(): {
		config: RLSTestConfig;
		stats: any;
		authContext: any;
		testItems: Array<{
			id: string;
			title: string;
			description: string;
			stats: any;
			examples: Array<{
				id: string;
				name: string;
				description: string;
				status: string;
				workflowSteps: number;
				results?: TestResults;
			}>;
		}>;
	} {
		const authContext = this.getAuthContext();

		return {
			config: this.config,
			stats: this.getOverallStats(),
			authContext,
			testItems: this.testData.map(testItem => ({
				id: testItem.id,
				title: testItem.title,
				description: testItem.description,
				stats: this.getTestItemStats(testItem.id),
				examples: (testItem.examples || []).map(example => ({
					id: example.id,
					name: example.name,
					description: example.description,
					status: example.results?.passed ? 'passed' :
						example.results?.passed === false ? 'failed' : 'pending',
					workflowSteps: example.workflow.length,
					results: example.results
				}))
			}))
		};
	}

	/**
	 * Execute a specific workflow step for debugging
	 */
	async executeWorkflowStep(itemId: string, exampleId: string, stepIndex: number): Promise<WorkflowStepResult> {
		const example = this.getExample(itemId, exampleId);
		if (!example) {
			throw new Error(`RLS example not found: ${itemId}.${exampleId}`);
		}

		if (stepIndex < 0 || stepIndex >= example.workflow.length) {
			throw new Error(`Invalid step index: ${stepIndex}`);
		}

		const step = example.workflow[stepIndex];
		return await this.executionEngine.executeWorkflowStep(step);
	}

	/**
	 * Get workflow step preview for debugging
	 */
	getWorkflowStepPreview(itemId: string, exampleId: string, stepIndex: number): {
		step: any;
		operation: string;
		name: string;
		description?: string;
		hasSQL: boolean;
		hasParams: boolean;
		expectedResult: boolean;
	} | null {
		const example = this.getExample(itemId, exampleId);
		if (!example || stepIndex < 0 || stepIndex >= example.workflow.length) {
			return null;
		}

		const step = example.workflow[stepIndex];
		return {
			step,
			operation: step.operation,
			name: step.name,
			description: step.step,
			hasSQL: Boolean(step.sql),
			hasParams: Boolean(step.params),
			expectedResult: Boolean(step.expected_result)
		};
	}

	/**
	 * Health check for the RLS testing environment
	 */
	async healthCheck(): Promise<{ healthy: boolean; details: string[] }> {
		const details: string[] = [];

		try {
			// Test basic connectivity
			const response = await fetch(`${this.config.supabaseLiteUrl}/health`, {
				method: 'GET',
				headers: {
					'apikey': this.config.anonKey,
					'Authorization': `Bearer ${this.config.anonKey}`
				}
			});

			if (response.ok) {
				details.push('✅ Supabase Lite connection successful');
			} else {
				details.push(`❌ Supabase Lite connection failed: ${response.status}`);
				return { healthy: false, details };
			}

			// Test debug SQL endpoint
			const sqlResponse = await fetch(this.config.debugSqlEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'apikey': this.config.serviceRoleKey
				},
				body: JSON.stringify({ sql: 'SELECT 1 as test' })
			});

			if (sqlResponse.ok) {
				details.push('✅ Debug SQL endpoint accessible');
			} else {
				details.push(`❌ Debug SQL endpoint failed: ${sqlResponse.status}`);
				return { healthy: false, details };
			}

			// Test authentication system
			try {
				const context = this.executionEngine.getContext();
				if (context.supabaseClient && context.serviceClient) {
					details.push('✅ Authentication clients initialized');
				} else {
					details.push('❌ Authentication clients not properly initialized');
					return { healthy: false, details };
				}
			} catch (error) {
				details.push(`❌ Authentication system error: ${error instanceof Error ? error.message : String(error)}`);
				return { healthy: false, details };
			}

			details.push('🎉 RLS testing environment is healthy');
			return { healthy: true, details };

		} catch (error) {
			details.push(`❌ Health check failed: ${error instanceof Error ? error.message : String(error)}`);
			return { healthy: false, details };
		}
	}
}