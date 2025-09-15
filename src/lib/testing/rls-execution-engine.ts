import { createClient } from '@supabase/supabase-js';
import type {
	RLSTestConfig,
	RLSTestContext,
	WorkflowStep,
	WorkflowStepResult,
	RLSExample,
	TestLog,
	TestResults,
	OperationResult,
	AuthOperationResult,
	SQLOperationResult,
	TableOperationResult,
	RLSComparisonResult,
	UserCredentials
} from './rls-types';

export class RLSExecutionEngine {
	private config: RLSTestConfig;
	private context: RLSTestContext;

	constructor(config: RLSTestConfig) {
		this.config = config;
		this.context = {
			currentUser: null,
			serviceRole: false,
			supabaseClient: null,
			serviceClient: null,
			testData: new Map()
		};

		this.initializeClients();
	}

	/**
	 * Initialize Supabase clients
	 */
	private initializeClients(): void {
		this.context.supabaseClient = createClient(this.config.supabaseLiteUrl, this.config.anonKey);
		this.context.serviceClient = createClient(this.config.supabaseLiteUrl, this.config.serviceRoleKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});
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
	 * Get current active client based on service role state
	 */
	private getActiveClient() {
		return this.context.serviceRole ? this.context.serviceClient : this.context.supabaseClient;
	}

	/**
	 * Execute a single workflow step
	 */
	async executeWorkflowStep(step: WorkflowStep): Promise<WorkflowStepResult> {
		const logs: TestLog[] = [];
		const stepResult: WorkflowStepResult = {
			step,
			status: 'running',
			startTime: Date.now(),
			logs
		};

		logs.push(this.createTestLog('info', `Executing step: ${step.name}`));

		try {
			const result = await this.executeOperation(step, logs);

			stepResult.status = 'completed';
			stepResult.result = result;
			stepResult.endTime = Date.now();

			logs.push(this.createTestLog('info', `Step completed successfully: ${step.name}`));

		} catch (error) {
			stepResult.status = 'failed';
			stepResult.error = error instanceof Error ? error.message : String(error);
			stepResult.endTime = Date.now();

			logs.push(this.createTestLog('error', `Step failed: ${step.name} - ${stepResult.error}`));
		}

		return stepResult;
	}

	/**
	 * Execute a complete workflow example
	 */
	async executeExample(example: RLSExample): Promise<TestResults> {
		const logs: TestLog[] = [];
		logs.push(this.createTestLog('info', `Starting RLS example: ${example.name}`));

		try {
			for (const step of example.workflow) {
				const stepResult = await this.executeWorkflowStep(step);
				logs.push(...stepResult.logs);

				if (stepResult.status === 'failed' && !stepResult.step.expected_error) {
					throw new Error(`Workflow step failed: ${step.name}`);
				}

				// Small delay between steps for stability
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			logs.push(this.createTestLog('info', `RLS example completed successfully: ${example.name}`));
			return {
				passed: true,
				log: logs,
				skip: false
			};

		} catch (error) {
			logs.push(this.createTestLog('error', `RLS example failed: ${error instanceof Error ? error.message : String(error)}`));
			return {
				passed: false,
				log: logs,
				skip: false
			};
		}
	}

	/**
	 * Execute a workflow operation
	 */
	private async executeOperation(step: WorkflowStep, logs: TestLog[]): Promise<OperationResult> {
		switch (step.operation) {
			case 'cleanup':
				return await this.executeCleanup(logs);
			case 'auth_signup':
				return await this.executeAuthSignup(step, logs);
			case 'auth_signin':
				return await this.executeAuthSignin(step, logs);
			case 'auth_signout':
				return await this.executeAuthSignout(logs);
			case 'auth_update_user':
				return await this.executeAuthUpdateUser(step, logs);
			case 'set_service_role':
				return this.executeSetServiceRole(logs);
			case 'raw_sql':
				return await this.executeRawSQL(step, logs);
			case 'table_insert':
				return await this.executeTableInsert(step, logs);
			case 'table_select':
				return await this.executeTableSelect(step, logs);
			case 'table_update':
				return await this.executeTableUpdate(step, logs);
			case 'table_delete':
				return await this.executeTableDelete(step, logs);
			default:
				throw new Error(`Unknown operation: ${step.operation}`);
		}
	}

	/**
	 * Cleanup operation - Reset test environment
	 */
	private async executeCleanup(logs: TestLog[]): Promise<OperationResult> {
		logs.push(this.createTestLog('info', 'Starting cleanup of RLS test data'));

		try {
			const wasServiceRole = this.context.serviceRole;
			this.context.serviceRole = true;

			// Drop test tables
			const tablesToDrop = ['test_comments', 'test_documents', 'test_projects', 'test_posts'];

			for (const table of tablesToDrop) {
				try {
					const response = await fetch(this.config.debugSqlEndpoint, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'apikey': this.config.serviceRoleKey
						},
						body: JSON.stringify({
							sql: `DROP TABLE IF EXISTS ${table} CASCADE;`
						})
					});

					if (response.ok) {
						logs.push(this.createTestLog('debug', `Dropped table: ${table}`));
					}
				} catch (e) {
					logs.push(this.createTestLog('debug', `Cleanup warning for ${table}: ${e instanceof Error ? e.message : String(e)}`));
				}
			}

			// Clean up test users - follow exact Deno pattern
			// First cleanup is full (deletes users), subsequent cleanups are selective (preserve users)
			const isFirstCleanup = !this.context.testData.has('isFirstCleanup');
			if (isFirstCleanup) {
				this.context.testData.set('isFirstCleanup', false);

				try {
					const response = await fetch(this.config.debugSqlEndpoint, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'apikey': this.config.serviceRoleKey
						},
						body: JSON.stringify({
							sql: `DELETE FROM auth.users WHERE email IN ('alice@rlstest.com', 'bob@rlstest.com', 'charlie@rlstest.com');`
						})
					});

					if (response.ok) {
						logs.push(this.createTestLog('debug', 'Full cleanup: Removed test users from auth.users'));
					}
				} catch (e) {
					logs.push(this.createTestLog('debug', `User cleanup warning: ${e instanceof Error ? e.message : String(e)}`));
				}
			} else {
				// Selective cleanup: preserve users, clean only table data (like Deno script)
				logs.push(this.createTestLog('debug', 'Selective cleanup: Preserving users, cleaning only table data'));
			}

			// Reset context and clear Supabase client session
			this.context.serviceRole = wasServiceRole;
			this.context.currentUser = null;

			// Clear any existing session from the Supabase client to ensure clean state
			try {
				await this.context.supabaseClient.auth.signOut();
				logs.push(this.createTestLog('debug', 'Cleared Supabase client session'));
			} catch (signoutError) {
				logs.push(this.createTestLog('debug', `Session cleanup warning: ${signoutError instanceof Error ? signoutError.message : String(signoutError)}`));
			}

			// Clear test data cache but preserve persistent flags
			const preserveFirstCleanupFlag = this.context.testData.get('isFirstCleanup');
			this.context.testData.clear();
			if (preserveFirstCleanupFlag !== undefined) {
				this.context.testData.set('isFirstCleanup', preserveFirstCleanupFlag);
			}

			logs.push(this.createTestLog('info', 'Cleanup completed'));
			return { success: true };

		} catch (error) {
			logs.push(this.createTestLog('error', `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`));
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Auth signup operation
	 */
	private async executeAuthSignup(step: WorkflowStep, logs: TestLog[]): Promise<AuthOperationResult> {
		logs.push(this.createTestLog('info', `Signing up user: ${step.params.email}`));

		try {
			// Use Supabase client's built-in auth methods (like Deno script)
			const { data, error } = await this.context.supabaseClient.auth.signUp({
				email: step.params.email,
				password: step.params.password,
				options: {
					data: step.params.data || {}
				}
			});

			if (error) {
				// Check if user already exists
				if (error.message.includes('already') || error.message.includes('exists')) {
					logs.push(this.createTestLog('info', `User already exists: ${step.params.email}`));
					return { success: true, data, existing: true };
				}
				throw error;
			}

			if (data.user) {
				this.context.testData.set(step.params.email, {
					id: data.user.id,
					email: step.params.email,
					password: step.params.password
				});

				// Update currentUser context
				this.context.currentUser = {
					email: step.params.email,
					password: step.params.password,
					id: data.user.id
				};

				logs.push(this.createTestLog('info', `User signed up successfully: ${step.params.email} (${data.user.id})`));
			}

			return { success: true, data, user: data.user, session: data.session };

		} catch (error) {
			logs.push(this.createTestLog('error', `Signup failed for ${step.params.email}: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	/**
	 * Auth signin operation
	 */
	private async executeAuthSignin(step: WorkflowStep, logs: TestLog[]): Promise<AuthOperationResult> {
		logs.push(this.createTestLog('info', `Signing in user: ${step.params.email}`));

		try {
			// Use Supabase client's built-in auth methods (like Deno script)
			const { data, error } = await this.context.supabaseClient.auth.signInWithPassword({
				email: step.params.email,
				password: step.params.password
			});

			if (error) {
				// Debug logging
				console.log('RLS Auth signin error:', error);
				console.log('RLS Auth error message:', error.message);
				console.log('RLS Auth error code:', error.code);

				// If signin fails because user doesn't exist, try to create the user first
				if (error.message.includes('Invalid login credentials') || error.message.includes('User not found')) {
					logs.push(this.createTestLog('info', `User not found, attempting to create: ${step.params.email}`));

					// Create the user first
					const signupResult = await this.context.supabaseClient.auth.signUp({
						email: step.params.email,
						password: step.params.password,
						options: {
							data: step.params.data || {}
						}
					});

					if (signupResult.error) {
						// If signup also fails, try to signin again (user might exist but with different error)
						if (!signupResult.error.message.includes('already') && !signupResult.error.message.includes('exists')) {
							throw signupResult.error;
						}
						logs.push(this.createTestLog('info', `User already exists, retrying signin: ${step.params.email}`));
					} else {
						logs.push(this.createTestLog('info', `User created successfully: ${step.params.email} (${signupResult.data.user?.id})`));
					}

					// Try signin again after creation
					const retrySignin = await this.context.supabaseClient.auth.signInWithPassword({
						email: step.params.email,
						password: step.params.password
					});

					if (retrySignin.error) {
						throw retrySignin.error;
					}

					// Success on retry
					if (retrySignin.data.user) {
						this.context.currentUser = {
							email: step.params.email,
							password: step.params.password,
							id: retrySignin.data.user.id
						};

						this.context.testData.set(step.params.email, {
							id: retrySignin.data.user.id,
							email: step.params.email,
							password: step.params.password
						});

						logs.push(this.createTestLog('info', `User signed in successfully after creation: ${step.params.email} (${retrySignin.data.user.id})`));
					}

					this.context.serviceRole = false;
					return { success: true, data: retrySignin.data, user: retrySignin.data.user, session: retrySignin.data.session };
				} else {
					throw error;
				}
			}

			if (data.user) {
				this.context.currentUser = {
					email: step.params.email,
					password: step.params.password,
					id: data.user.id
				};

				logs.push(this.createTestLog('info', `User signed in successfully: ${step.params.email} (${data.user.id})`));
			}

			this.context.serviceRole = false;
			return { success: true, data, user: data.user, session: data.session };

		} catch (error) {
			logs.push(this.createTestLog('error', `Signin failed for ${step.params.email}: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	/**
	 * Auth signout operation
	 */
	private async executeAuthSignout(logs: TestLog[]): Promise<AuthOperationResult> {
		logs.push(this.createTestLog('info', 'Signing out current user'));

		try {
			// Use Supabase client's built-in auth methods (like Deno script)
			const { error } = await this.context.supabaseClient.auth.signOut();

			if (error) {
				throw error;
			}

			this.context.currentUser = null;
			this.context.serviceRole = false;

			logs.push(this.createTestLog('info', 'User signed out successfully'));
			return { success: true };

		} catch (error) {
			logs.push(this.createTestLog('error', `Signout failed: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	/**
	 * Auth update user operation
	 */
	private async executeAuthUpdateUser(step: WorkflowStep, logs: TestLog[]): Promise<AuthOperationResult> {
		logs.push(this.createTestLog('info', 'Updating user profile'));

		try {
			// Use Supabase client method (matches Deno implementation)
			const { data, error } = await this.context.supabaseClient.auth.updateUser({
				data: step.params.data
			});

			if (error) {
				logs.push(this.createTestLog('error', `User update failed: ${error.message}`));
				throw new Error(error.message);
			}

			logs.push(this.createTestLog('info', 'User profile updated successfully'));
			return { success: true, data, user: data.user };

		} catch (error) {
			logs.push(this.createTestLog('error', `User update failed: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	/**
	 * Set service role operation
	 */
	private executeSetServiceRole(logs: TestLog[]): OperationResult {
		logs.push(this.createTestLog('info', 'Switching to service role'));
		this.context.serviceRole = true;
		this.context.currentUser = null;
		return { success: true };
	}

	/**
	 * Raw SQL execution operation
	 */
	private async executeRawSQL(step: WorkflowStep, logs: TestLog[]): Promise<SQLOperationResult> {
		const sqlPreview = step.sql?.substring(0, 100) + (step.sql && step.sql.length > 100 ? '...' : '');
		logs.push(this.createTestLog('info', `Executing SQL: ${sqlPreview}`));

		try {
			let sql = step.sql || '';

			// Inject user context for authenticated users
			if (!this.context.serviceRole && this.context.currentUser && sql.includes('INSERT INTO')) {
				sql = this.injectUserContextInSQL(sql);
			}

			const response = await fetch(this.config.debugSqlEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'apikey': this.context.serviceRole ? this.config.serviceRoleKey : this.config.anonKey,
					'Authorization': `Bearer ${this.context.serviceRole ? this.config.serviceRoleKey : this.config.anonKey}`
				},
				body: JSON.stringify({ sql })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || `HTTP ${response.status}`);
			}

			logs.push(this.createTestLog('info', `SQL executed successfully, affected rows: ${result.data?.length || 0}`));
			return { success: true, data: result.data, rowsAffected: result.data?.length || 0 };

		} catch (error) {
			logs.push(this.createTestLog('error', `SQL execution failed: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	/**
	 * Inject user context into SQL statements
	 */
	private injectUserContextInSQL(sql: string): string {
		if (!this.context.currentUser) return sql;

		let modifiedSQL = sql;

		// Use the exact same injection logic as the Deno script
		// Replace user_id placeholders with actual user ID
		modifiedSQL = modifiedSQL.replace(/user_id,/g, `user_id,`)
			.replace(/VALUES \(/g, `VALUES ('${this.context.currentUser.id}',`)
			.replace(/,\s*title/g, `, title`)
			.replace(/,\s*content/g, `, content`);

		// Handle cases where user_id is not explicitly specified but should be auto-filled
		if (modifiedSQL.includes('INSERT INTO test_posts') && !modifiedSQL.includes('user_id')) {
			modifiedSQL = modifiedSQL.replace(/INSERT INTO test_posts \(/, `INSERT INTO test_posts (user_id, `)
				.replace(/VALUES \(/, `VALUES ('${this.context.currentUser.id}', `);
		}

		if (modifiedSQL.includes('INSERT INTO test_projects') && !modifiedSQL.includes('owner_id')) {
			modifiedSQL = modifiedSQL.replace(/INSERT INTO test_projects \(/, `INSERT INTO test_projects (owner_id, `)
				.replace(/VALUES \(/, `VALUES ('${this.context.currentUser.id}', `);
		}

		if (modifiedSQL.includes('INSERT INTO test_documents') && !modifiedSQL.includes('owner_id')) {
			modifiedSQL = modifiedSQL.replace(/INSERT INTO test_documents \(/, `INSERT INTO test_documents (owner_id, `)
				.replace(/VALUES \(/, `VALUES ('${this.context.currentUser.id}', `);
		}

		return modifiedSQL;
	}

	/**
	 * Table insert operation
	 */
	private async executeTableInsert(step: WorkflowStep, logs: TestLog[]): Promise<TableOperationResult> {
		logs.push(this.createTestLog('info', `Inserting into table: ${step.table}`));

		try {
			const client = this.getActiveClient();
			let insertData = { ...step.data };

			// Auto-add user/owner IDs for authenticated users
			if (!this.context.serviceRole && this.context.currentUser) {
				if (step.table === 'test_posts' && !insertData.user_id) {
					insertData.user_id = this.context.currentUser.id;
				}
				if ((step.table === 'test_projects' || step.table === 'test_documents') && !insertData.owner_id) {
					insertData.owner_id = this.context.currentUser.id;
				}
				if (step.table === 'test_comments' && !insertData.author_id) {
					insertData.author_id = this.context.currentUser.id;
				}
			}

			const { data, error } = await client
				.from(step.table!)
				.insert(insertData)
				.select();

			if (error) {
				if (step.expected_error) {
					logs.push(this.createTestLog('info', `Expected error occurred: ${error.message}`));
					return { success: true, expectedError: true, error: error.message };
				}
				throw error;
			}

			if (step.expected_error) {
				throw new Error('Expected an error but operation succeeded');
			}

			logs.push(this.createTestLog('info', `Insert successful, ${data?.length || 0} rows inserted`));
			return { success: true, data, rowCount: data?.length || 0 };

		} catch (error) {
			logs.push(this.createTestLog('error', `Insert failed: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	/**
	 * Table select operation
	 */
	private async executeTableSelect(step: WorkflowStep, logs: TestLog[]): Promise<TableOperationResult> {
		logs.push(this.createTestLog('info', `Querying table: ${step.table}`));

		try {
			const client = this.getActiveClient();
			let query = client.from(step.table!).select(step.select || '*');

			// Apply filters
			if (step.filter) {
				for (const [column, conditions] of Object.entries(step.filter)) {
					for (const [operator, value] of Object.entries(conditions as any)) {
						query = query[operator](column, value);
					}
				}
			}

			const { data, error } = await query;

			if (error) {
				throw error;
			}

			logs.push(this.createTestLog('info', `Query successful, ${data?.length || 0} rows returned`));

			// Validate expected results
			if (step.expected_result) {
				await this.validateExpectedResult(data, step.expected_result, logs);
			}

			return { success: true, data, rowCount: data?.length || 0 };

		} catch (error) {
			logs.push(this.createTestLog('error', `Query failed: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	/**
	 * Table update operation
	 */
	private async executeTableUpdate(step: WorkflowStep, logs: TestLog[]): Promise<TableOperationResult> {
		logs.push(this.createTestLog('info', `Updating table: ${step.table}`));

		try {
			const client = this.getActiveClient();
			let query = client.from(step.table!).update(step.data);

			// Apply filters
			if (step.filter) {
				for (const [column, conditions] of Object.entries(step.filter)) {
					for (const [operator, value] of Object.entries(conditions as any)) {
						query = query[operator](column, value);
					}
				}
			}

			const { data, error, count } = await query.select();

			if (error) {
				if (step.expected_result?.should_error) {
					logs.push(this.createTestLog('info', `Expected error occurred: ${error.message}`));
					return { success: true, expectedError: true, error: error.message };
				}
				throw error;
			}

			const rowCount = count ?? data?.length ?? 0;
			logs.push(this.createTestLog('info', `Update successful, ${rowCount} rows affected`));

			// Validate expected results
			if (step.expected_result?.row_count !== undefined) {
				if (rowCount !== step.expected_result.row_count) {
					throw new Error(`Expected ${step.expected_result.row_count} rows affected, got ${rowCount}`);
				}
			}

			return { success: true, data, rowCount, affectedRows: rowCount };

		} catch (error) {
			logs.push(this.createTestLog('error', `Update failed: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	/**
	 * Table delete operation
	 */
	private async executeTableDelete(step: WorkflowStep, logs: TestLog[]): Promise<TableOperationResult> {
		logs.push(this.createTestLog('info', `Deleting from table: ${step.table}`));

		try {
			const client = this.getActiveClient();
			let query = client.from(step.table!).delete();

			// Apply filters
			if (step.filter) {
				for (const [column, conditions] of Object.entries(step.filter)) {
					for (const [operator, value] of Object.entries(conditions as any)) {
						query = query[operator](column, value);
					}
				}
			}

			const { data, error, count } = await query.select();

			if (error) {
				if (step.expected_result?.should_error) {
					logs.push(this.createTestLog('info', `Expected error occurred: ${error.message}`));
					return { success: true, expectedError: true, error: error.message };
				}
				throw error;
			}

			const rowCount = count ?? data?.length ?? 0;
			logs.push(this.createTestLog('info', `Delete successful, ${rowCount} rows affected`));

			// Validate expected results
			if (step.expected_result?.row_count !== undefined) {
				if (rowCount !== step.expected_result.row_count) {
					throw new Error(`Expected ${step.expected_result.row_count} rows affected, got ${rowCount}`);
				}
			}

			return { success: true, data, rowCount, affectedRows: rowCount };

		} catch (error) {
			logs.push(this.createTestLog('error', `Delete failed: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	/**
	 * Validate expected results against actual data
	 */
	private async validateExpectedResult(data: any[], expected: any, logs: TestLog[]): Promise<void> {
		if (expected.row_count !== undefined) {
			if (data.length !== expected.row_count) {
				throw new Error(`Expected ${expected.row_count} rows, got ${data.length}`);
			}
			logs.push(this.createTestLog('info', `✓ Row count validation passed: ${data.length}`));
		}

		if (expected.contains) {
			const containsArray = Array.isArray(expected.contains) ? expected.contains : [expected.contains];

			for (const expectedItem of containsArray) {
				const found = data.some(row => {
					return Object.entries(expectedItem).every(([key, value]) => row[key] === value);
				});

				if (!found) {
					throw new Error(`Expected to find item with ${JSON.stringify(expectedItem)}`);
				}

				logs.push(this.createTestLog('info', `✓ Contains validation passed: ${JSON.stringify(expectedItem)}`));
			}
		}

		if (expected.not_contains) {
			const notContainsArray = Array.isArray(expected.not_contains) ? expected.not_contains : [expected.not_contains];

			for (const unexpectedItem of notContainsArray) {
				const found = data.some(row => {
					return Object.entries(unexpectedItem).every(([key, value]) => row[key] === value);
				});

				if (found) {
					throw new Error(`Expected NOT to find item with ${JSON.stringify(unexpectedItem)}`);
				}

				logs.push(this.createTestLog('info', `✓ Not contains validation passed: ${JSON.stringify(unexpectedItem)}`));
			}
		}
	}

	/**
	 * Get current test context
	 */
	getContext(): RLSTestContext {
		return this.context;
	}

	/**
	 * Reset test context
	 */
	resetContext(): void {
		this.context.currentUser = null;
		this.context.serviceRole = false;
		this.context.testData.clear();
	}

	/**
	 * Async version of resetContext that also clears Supabase client session
	 */
	async resetContextAsync(): Promise<void> {
		this.context.currentUser = null;
		this.context.serviceRole = false;
		this.context.testData.clear();

		// Clear any existing session from the Supabase client
		try {
			await this.context.supabaseClient.auth.signOut();
		} catch (error) {
			// Ignore signout errors during cleanup - session might not exist
		}
	}
}