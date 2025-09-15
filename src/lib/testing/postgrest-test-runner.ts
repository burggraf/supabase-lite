import { TestExecutionEngine } from './test-execution-engine';
import type {
	PostgreSTCategory,
	PostgreSTTest,
	TestExecution,
	TestSuiteExecution,
	TestConfig,
	TestResults,
	ComparisonResult
} from './types';

export class PostgreSTTestRunner {
	private config: TestConfig;
	private executionEngine: TestExecutionEngine;
	private testData: PostgreSTCategory[] = [];

	constructor(config?: Partial<TestConfig>) {
		const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
		this.config = {
			supabaseLiteUrl: currentOrigin,
			debugSqlEndpoint: `${currentOrigin}/debug/sql`,
			anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
			skipUnsupported: true,
			stopOnFirstFailure: false,
			...config
		};

		this.executionEngine = new TestExecutionEngine(this.config);
	}

	/**
	 * Load test data from the imported JSON
	 */
	loadTestData(testData: PostgreSTCategory[]): void {
		this.testData = testData;
	}

	/**
	 * Get all test categories
	 */
	getCategories(): PostgreSTCategory[] {
		return this.testData;
	}

	/**
	 * Get a specific category by ID
	 */
	getCategory(categoryId: string): PostgreSTCategory | undefined {
		return this.testData.find(category => category.id === categoryId);
	}

	/**
	 * Get a specific test by category and test ID
	 */
	getTest(categoryId: string, testId: string): PostgreSTTest | undefined {
		const category = this.getCategory(categoryId);
		if (!category) return undefined;
		return category.examples?.find(test => test.id === testId);
	}

	/**
	 * Get all tests from all categories
	 */
	getAllTests(): Array<{ category: PostgreSTCategory; test: PostgreSTTest }> {
		const allTests: Array<{ category: PostgreSTCategory; test: PostgreSTTest }> = [];

		for (const category of this.testData) {
			for (const test of category.examples || []) {
				allTests.push({ category, test });
			}
		}

		return allTests;
	}

	/**
	 * Check if a test should be skipped
	 */
	private shouldSkipTest(test: PostgreSTTest): string | null {
		// Always skip tests marked as unsupported
		if (test.unsupported && this.config.skipUnsupported) {
			return "unsupported by pglite";
		}

		return null;
	}

	/**
	 * Execute a single test
	 */
	async executeTest(categoryId: string, testId: string): Promise<TestExecution> {
		const category = this.getCategory(categoryId);
		const test = this.getTest(categoryId, testId);

		if (!category || !test) {
			throw new Error(`Test not found: ${categoryId}.${testId}`);
		}

		const execution: TestExecution = {
			test,
			category,
			status: 'running',
			startTime: Date.now()
		};

		try {
			// Check if test should be skipped
			const skipReason = this.shouldSkipTest(test);
			if (skipReason) {
				execution.status = 'completed';
				execution.endTime = Date.now();
				execution.error = `Skipped: ${skipReason}`;
				return execution;
			}

			// Reset schema for test isolation
			await this.executionEngine.resetPublicSchema();

			// Execute the test
			const result = await this.executionEngine.executeTest(test);

			// Update execution with results
			execution.actualResult = result.actualResult;
			execution.expectedResult = result.expectedResult;
			execution.endTime = Date.now();

			if (result.comparison.match) {
				execution.status = 'completed';
			} else {
				execution.status = 'failed';
				execution.error = result.comparison.differences;
			}

			// Update the test's results for future reference
			test.results = {
				passed: result.comparison.match,
				log: result.logs,
				skip: result.comparison.match // Mark as skip for future runs if it passed
			};

		} catch (error) {
			execution.status = 'failed';
			execution.endTime = Date.now();
			execution.error = error instanceof Error ? error.message : String(error);

			// Update the test's results
			test.results = {
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
	 * Execute all tests in a category
	 */
	async executeCategoryTests(
		categoryId: string,
		onTestComplete?: (execution: TestExecution) => void
	): Promise<TestExecution[]> {
		const category = this.getCategory(categoryId);
		if (!category) {
			throw new Error(`Category not found: ${categoryId}`);
		}

		const executions: TestExecution[] = [];

		for (const test of category.examples || []) {
			const execution = await this.executeTest(categoryId, test.id);
			executions.push(execution);

			if (onTestComplete) {
				onTestComplete(execution);
			}

			// Stop on first failure if configured
			if (this.config.stopOnFirstFailure && execution.status === 'failed') {
				break;
			}
		}

		return executions;
	}

	/**
	 * Execute all tests in the suite
	 */
	async executeAllTests(
		onTestComplete?: (execution: TestExecution) => void,
		onCategoryComplete?: (categoryId: string, executions: TestExecution[]) => void
	): Promise<TestSuiteExecution> {
		const allExecutions = new Map<string, TestExecution>();
		const stats = {
			total: 0,
			passed: 0,
			failed: 0,
			skipped: 0,
			unsupported: 0
		};

		for (const category of this.testData) {
			const categoryExecutions = await this.executeCategoryTests(
				category.id,
				(execution) => {
					const key = `${execution.category.id}.${execution.test.id}`;
					allExecutions.set(key, execution);

					// Update stats
					stats.total++;
					if (execution.status === 'completed' && !execution.error) {
						stats.passed++;
					} else if (execution.status === 'failed') {
						stats.failed++;
					} else if (execution.error?.includes('Skipped')) {
						if (execution.error.includes('unsupported')) {
							stats.unsupported++;
						} else {
							stats.skipped++;
						}
					}

					if (onTestComplete) {
						onTestComplete(execution);
					}
				}
			);

			if (onCategoryComplete) {
				onCategoryComplete(category.id, categoryExecutions);
			}

			// Stop on first failure if configured
			if (this.config.stopOnFirstFailure && categoryExecutions.some(e => e.status === 'failed')) {
				break;
			}
		}

		return {
			categories: this.testData,
			executions: allExecutions,
			stats
		};
	}

	/**
	 * Get test statistics for a category
	 */
	getCategoryStats(categoryId: string): {
		total: number;
		passed: number;
		failed: number;
		skipped: number;
		unsupported: number;
	} {
		const category = this.getCategory(categoryId);
		if (!category) {
			return { total: 0, passed: 0, failed: 0, skipped: 0, unsupported: 0 };
		}

		const stats = {
			total: category.examples?.length || 0,
			passed: 0,
			failed: 0,
			skipped: 0,
			unsupported: 0
		};

		for (const test of category.examples || []) {
			if (test.unsupported) {
				stats.unsupported++;
			} else if (test.results?.passed) {
				stats.passed++;
			} else if (test.results?.passed === false) {
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
		unsupported: number;
		categories: number;
	} {
		const stats = {
			total: 0,
			passed: 0,
			failed: 0,
			skipped: 0,
			unsupported: 0,
			categories: this.testData.length
		};

		for (const category of this.testData) {
			const categoryStats = this.getCategoryStats(category.id);
			stats.total += categoryStats.total;
			stats.passed += categoryStats.passed;
			stats.failed += categoryStats.failed;
			stats.skipped += categoryStats.skipped;
			stats.unsupported += categoryStats.unsupported;
		}

		return stats;
	}

	/**
	 * Reset all test results
	 */
	resetAllResults(): void {
		for (const category of this.testData) {
			for (const test of category.examples || []) {
				delete test.results;
			}
		}
	}

	/**
	 * Export test results for debugging
	 */
	exportResults(): {
		config: TestConfig;
		stats: any;
		categories: Array<{
			id: string;
			title: string;
			stats: any;
			tests: Array<{
				id: string;
				name: string;
				status: string;
				results?: TestResults;
			}>;
		}>;
	} {
		return {
			config: this.config,
			stats: this.getOverallStats(),
			categories: this.testData.map(category => ({
				id: category.id,
				title: category.title,
				stats: this.getCategoryStats(category.id),
				tests: (category.examples || []).map(test => ({
					id: test.id,
					name: test.name,
					status: test.unsupported ? 'unsupported' :
						test.results?.passed ? 'passed' :
						test.results?.passed === false ? 'failed' : 'pending',
					results: test.results
				}))
			}))
		};
	}
}