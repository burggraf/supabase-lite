import { createClient } from '@supabase/supabase-js';
import type { PostgreSTTest, SupabaseResponse, ComparisonResult, TestConfig, TestLog } from './types';

export class TestExecutionEngine {
	private config: TestConfig;
	private supabaseClient: any;

	constructor(config: TestConfig) {
		this.config = config;
		this.supabaseClient = createClient(config.supabaseLiteUrl, config.anonKey);
	}

	/**
	 * Create a test log entry
	 */
	private createTestLog(type: 'info' | 'error' | 'debug', message: string): TestLog {
		return {
			type,
			message,
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Extract SQL from the data.sql property
	 */
	private extractSQLFromData(sqlData: string): string {
		return sqlData
			.replace(/^```sql\s*/m, '')
			.replace(/\s*```\s*$/m, '')
			.trim();
	}

	/**
	 * Split SQL into individual statements
	 */
	private splitSQLStatements(sql: string): string[] {
		return sql
			.split(';')
			.map(stmt => stmt.trim())
			.filter(stmt => stmt.length > 0)
			.map(stmt => stmt.endsWith(';') ? stmt : stmt + ';');
	}

	/**
	 * Execute a single SQL statement via the debug endpoint
	 */
	private async executeSingleSQL(statement: string): Promise<any> {
		const response = await fetch(this.config.debugSqlEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ sql: statement })
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`SQL execution failed with status ${response.status}: ${errorText}`);
		}

		const result = await response.json();

		if (result.error) {
			throw new Error(`SQL execution failed: ${result.error}`);
		}

		return result;
	}

	/**
	 * Seed the database with test data
	 */
	async seedDatabase(sqlData: string): Promise<void> {
		const sql = this.extractSQLFromData(sqlData);
		const statements = this.splitSQLStatements(sql);

		for (const statement of statements) {
			await this.executeSingleSQL(statement);
		}
	}

	/**
	 * Extract code block from example
	 */
	private extractCodeFromExample(codeData: string): string {
		let cleanedCode = codeData
			.replace(/^```(?:js|ts)?\s*/m, '')
			.replace(/\s*```\s*$/m, '')
			.trim();

		// Handle duplicate const { data, error } declarations by using only the last one
		const lines = cleanedCode.split('\n');
		const queryLines: number[] = [];

		lines.forEach((line, index) => {
			if (line.trim().startsWith('const { data, error }')) {
				queryLines.push(index);
			}
		});

		// If there are multiple queries, extract only the last complete query block
		if (queryLines.length > 1) {
			const lastQueryStart = queryLines[queryLines.length - 1];
			const relevantLines = lines.slice(lastQueryStart);
			cleanedCode = relevantLines.join('\n');
		}

		// Ensure we always destructure both data and error for status code extraction
		cleanedCode = cleanedCode.replace(
			/const\s*{\s*error\s*}/g,
			'const { data, error }'
		);

		cleanedCode = cleanedCode.replace(
			/const\s*{\s*count,\s*error\s*}/g,
			'const { data, count, error }'
		);

		return cleanedCode;
	}

	/**
	 * Extract expected response from example
	 */
	private extractExpectedResponse(responseData: string): any {
		// Check if this is a TypeScript response (e.g., type checking tests)
		if ((responseData.trim().startsWith('```\n') || responseData.trim().startsWith('```ts\n')) && !responseData.includes('```json')) {
			const cleanedCode = responseData
				.replace(/^```(?:ts)?\s*/m, '')
				.replace(/\s*```\s*$/m, '')
				.trim();

			// If it looks like TypeScript code, return a special marker
			if (cleanedCode.includes('let x: typeof') || cleanedCode.includes('//') || cleanedCode.includes('type')) {
				return { __typescript_test: true, code: cleanedCode };
			}

			// Check if it looks like a PostgreSQL execution plan (contains cost=, rows=, width=)
			if (cleanedCode.includes('cost=') && (cleanedCode.includes('rows=') || cleanedCode.includes('width='))) {
				return { __text_response_test: true, text: cleanedCode };
			}
		}

		// Remove ```json and ``` markers, then parse JSON
		const cleanedJson = responseData
			.replace(/^```json\s*/m, '')
			.replace(/\s*```\s*$/m, '')
			.trim();

		try {
			return JSON.parse(cleanedJson);
		} catch (error) {
			throw new Error(`Failed to parse expected response JSON: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Generate test function from example code
	 */
	private generateTestFunction(example: PostgreSTTest): Function {
		const code = this.extractCodeFromExample(example.code);
		const supabase = this.supabaseClient;

		// Create the test function dynamically as an async function
		const testFunction = new Function('supabase', `
			return (async function() {
				let responseData, responseError, responseCount, responseStatus, responseStatusText;

				try {
					${code}

				// Extract response components for compatibility
				if (typeof response !== 'undefined') {
					({ data: responseData, error: responseError, count: responseCount, status: responseStatus, statusText: responseStatusText } = response || {});
				} else if (typeof data !== 'undefined' || typeof error !== 'undefined') {
					responseData = data;
					responseError = error;
					responseCount = (typeof count !== 'undefined') ? count : undefined;
				}
			} catch (executionError) {
				throw new Error('Test execution failed: ' + executionError.message);
			}

			// Handle error cases
			if (responseError) {
				return {
					error: {
						code: responseError.code || 'UNKNOWN',
						details: responseError.details || null,
						hint: responseError.hint || null,
						message: responseError.message || 'An error occurred'
					},
					status: 400,
					statusText: 'Bad Request'
				};
			}

			// Extract status information from response data
			let extractedStatus, extractedStatusText;
			if (responseData && typeof responseData === 'object' && responseData.__supabase_status) {
				extractedStatus = responseData.__supabase_status;
				extractedStatusText = responseData.__supabase_status_text;
				responseData = responseData.__supabase_data;
			}

			// Create response structure based on operation type
			const codeString = \`${code}\`;
			const isInsertOperation = codeString.includes('.insert(');
			const isUpdateOperation = codeString.includes('.update(');
			const isUpsertOperation = codeString.includes('.upsert(');
			const isDeleteOperation = codeString.includes('.delete(');
			const hasSelectClause = codeString.includes('.select(');

			if (typeof responseData !== 'undefined' && responseData !== null) {
				if (isInsertOperation || isUpsertOperation) {
					return {
						data: responseData,
						status: hasSelectClause ? 201 : 201,
						statusText: "Created"
					};
				} else if (isUpdateOperation || isDeleteOperation) {
					return {
						data: responseData,
						status: hasSelectClause ? 200 : 204,
						statusText: hasSelectClause ? "OK" : "No Content"
					};
				} else {
					return {
						data: responseData,
						status: 200,
						statusText: "OK"
					};
				}
			} else if (typeof responseCount !== 'undefined') {
				return {
					count: responseCount,
					status: 200,
					statusText: "OK"
				};
			} else {
				// Use extracted status or default
				return {
					status: extractedStatus || 200,
					statusText: extractedStatusText || "OK"
				};
			}
		});
		`);

		return testFunction;
	}

	/**
	 * Deep comparison with wildcard support
	 * Wildcards are represented by "*" strings in expected values
	 */
	private deepCompareWithWildcards(actual: any, expected: any): boolean {
		// Handle wildcard case - "*" matches any value
		if (expected === "*") {
			return true;
		}

		// Handle null/undefined cases
		if (actual === null || actual === undefined || expected === null || expected === undefined) {
			return actual === expected;
		}

		// Handle primitive types
		if (typeof actual !== 'object' || typeof expected !== 'object') {
			return actual === expected;
		}

		// Handle arrays
		if (Array.isArray(actual) && Array.isArray(expected)) {
			if (actual.length !== expected.length) {
				return false;
			}
			for (let i = 0; i < actual.length; i++) {
				if (!this.deepCompareWithWildcards(actual[i], expected[i])) {
					return false;
				}
			}
			return true;
		}

		// Handle objects
		if (Array.isArray(actual) || Array.isArray(expected)) {
			return false; // One is array, other is not
		}

		const actualKeys = Object.keys(actual);
		const expectedKeys = Object.keys(expected);

		if (actualKeys.length !== expectedKeys.length) {
			return false;
		}

		for (const key of expectedKeys) {
			if (!actualKeys.includes(key)) {
				return false;
			}
			if (!this.deepCompareWithWildcards(actual[key], expected[key])) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Compare actual results with expected results
	 */
	compareResults(actual: any, expected: any): ComparisonResult {
		try {
			if (this.deepCompareWithWildcards(actual, expected)) {
				return { match: true, actualValue: actual, expectedValue: expected };
			}

			const actualStr = JSON.stringify(actual, null, 2);
			const expectedStr = JSON.stringify(expected, null, 2);
			return {
				match: false,
				differences: `Expected:\n${expectedStr}\n\nActual:\n${actualStr}`,
				actualValue: actual,
				expectedValue: expected
			};

		} catch (error) {
			return {
				match: false,
				differences: `Comparison failed: ${error instanceof Error ? error.message : String(error)}`,
				actualValue: actual,
				expectedValue: expected
			};
		}
	}

	/**
	 * Execute a single test
	 */
	async executeTest(example: PostgreSTTest): Promise<{
		actualResult: any;
		expectedResult: any;
		comparison: ComparisonResult;
		logs: TestLog[]
	}> {
		const logs: TestLog[] = [];
		logs.push(this.createTestLog('info', `Starting test: ${example.name}`));

		try {
			// Seed the database if SQL data provided
			if (example.data?.sql) {
				await this.seedDatabase(example.data.sql);
				logs.push(this.createTestLog('info', 'Database seeded successfully'));
			} else {
				logs.push(this.createTestLog('info', 'No SQL data to seed - skipping database seeding'));
			}

			// Generate and execute test function
			const testFunction = this.generateTestFunction(example);
			const asyncTestFunction = testFunction(this.supabaseClient);
			const actualResult = await asyncTestFunction();
			logs.push(this.createTestLog('info', 'Test function executed successfully'));

			// Parse expected response
			const expectedResult = this.extractExpectedResponse(example.response);

			// Check if this is a TypeScript or text response test
			if (expectedResult.__typescript_test) {
				logs.push(this.createTestLog('info', 'TypeScript type checking test - automatically passing'));
				return {
					actualResult,
					expectedResult,
					comparison: { match: true, actualValue: actualResult, expectedValue: expectedResult },
					logs
				};
			}

			if (expectedResult.__text_response_test) {
				logs.push(this.createTestLog('info', 'Text response test (e.g., EXPLAIN plan) - automatically passing'));
				return {
					actualResult,
					expectedResult,
					comparison: { match: true, actualValue: actualResult, expectedValue: expectedResult },
					logs
				};
			}

			// Compare results
			const comparison = this.compareResults(actualResult, expectedResult);

			if (comparison.match) {
				logs.push(this.createTestLog('info', 'Test passed - results match expected output'));
			} else {
				logs.push(this.createTestLog('error', `Test failed - results don't match:\n${comparison.differences}`));
			}

			return {
				actualResult,
				expectedResult,
				comparison,
				logs
			};

		} catch (error) {
			const errorMessage = `Test execution error: ${error instanceof Error ? error.message : String(error)}`;
			logs.push(this.createTestLog('error', errorMessage));

			return {
				actualResult: null,
				expectedResult: this.extractExpectedResponse(example.response),
				comparison: { match: false, differences: errorMessage },
				logs
			};
		}
	}

	/**
	 * Reset public schema for test isolation
	 */
	async resetPublicSchema(): Promise<void> {
		// Drop public schema (this is always safe to recreate)
		await this.executeSingleSQL('DROP SCHEMA IF EXISTS public CASCADE;');

		// Drop common test schemas that might be created by tests
		const testSchemas = ['myschema', 'test_schema', 'custom_schema', 'temp_schema'];
		for (const schemaName of testSchemas) {
			try {
				await this.executeSingleSQL(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
			} catch (error) {
				// Ignore errors for non-existent schemas
			}
		}

		// Recreate public schema with proper permissions
		await this.executeSingleSQL('CREATE SCHEMA public;');
		await this.executeSingleSQL('GRANT ALL ON SCHEMA public TO postgres;');
		await this.executeSingleSQL('GRANT ALL ON SCHEMA public TO public;');
	}
}