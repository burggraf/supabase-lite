import type { RLSTestItem } from './rls-types';

// Import the JSON data - will need to be loaded from the file
export const loadRLSTestData = async (): Promise<RLSTestItem[]> => {
	try {
		// Try to load the JSON file directly
		const response = await fetch('/rls.test.json');
		if (!response.ok) {
			throw new Error(`Failed to load RLS test data: ${response.status} ${response.statusText}`);
		}
		const data = await response.json();
		return data as RLSTestItem[];
	} catch (error) {
		console.error('Failed to load RLS test data:', error);

		// Fallback to a minimal test set for development
		return [{
			id: 'basic-user-isolation',
			title: 'Basic User Data Isolation',
			description: 'Two users create tables, enable RLS, insert data - each only sees own data',
			examples: [{
				id: 'user-isolation-workflow',
				name: 'Complete User Isolation Workflow',
				description: 'Full end-to-end test of user signup, table creation, RLS setup, and data isolation',
				workflow: [
					{
						step: 'cleanup',
						name: 'Clean up any existing test data',
						operation: 'cleanup'
					},
					{
						step: 'create_user_alice',
						name: 'Create User Alice',
						operation: 'auth_signup',
						params: {
							email: 'alice@rlstest.com',
							password: 'Password123!',
							data: { full_name: 'Alice Smith' }
						}
					},
					{
						step: 'signin_alice',
						name: 'Sign in as Alice',
						operation: 'auth_signin',
						params: {
							email: 'alice@rlstest.com',
							password: 'Password123!'
						}
					},
					{
						step: 'create_posts_table',
						name: 'Alice creates posts table',
						operation: 'raw_sql',
						sql: 'CREATE TABLE IF NOT EXISTS test_posts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id), title TEXT NOT NULL, content TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());'
					},
					{
						step: 'enable_rls',
						name: 'Alice enables RLS on posts table',
						operation: 'raw_sql',
						sql: 'ALTER TABLE test_posts ENABLE ROW LEVEL SECURITY;'
					},
					{
						step: 'create_select_policy',
						name: 'Alice creates SELECT policy',
						operation: 'raw_sql',
						sql: 'CREATE POLICY "Users can view own posts" ON test_posts FOR SELECT USING (auth.uid() = user_id);'
					},
					{
						step: 'alice_insert_post',
						name: 'Alice inserts her own post',
						operation: 'table_insert',
						table: 'test_posts',
						data: {
							title: "Alice's First Post",
							content: "This is Alice's content"
						}
					},
					{
						step: 'alice_query_posts',
						name: 'Alice queries posts (should see her own)',
						operation: 'table_select',
						table: 'test_posts',
						select: '*',
						expected_result: {
							row_count: 1,
							contains: {
								title: "Alice's First Post"
							}
						}
					}
				]
			}]
		}];
	}
};

// Cache for the test data to avoid multiple loads
let cachedRLSTestData: RLSTestItem[] | null = null;

export const getRLSTestData = async (): Promise<RLSTestItem[]> => {
	if (cachedRLSTestData === null) {
		cachedRLSTestData = await loadRLSTestData();
	}
	return cachedRLSTestData;
};

// Helper function to get test items for UI
export const getRLSTestItems = async (): Promise<Array<{ id: string; title: string; exampleCount: number; description: string }>> => {
	const testData = await getRLSTestData();
	return testData.map(testItem => ({
		id: testItem.id,
		title: testItem.title,
		description: testItem.description,
		exampleCount: testItem.examples?.length || 0
	}));
};

// Helper function to get examples for a specific test item
export const getRLSTestItemExamples = async (itemId: string): Promise<RLSTestItem | null> => {
	const testData = await getRLSTestData();
	return testData.find(testItem => testItem.id === itemId) || null;
};

// Helper function to get a specific example
export const getRLSExample = async (itemId: string, exampleId: string) => {
	const testItem = await getRLSTestItemExamples(itemId);
	if (!testItem) return null;
	return testItem.examples?.find(example => example.id === exampleId) || null;
};

// Helper function to get workflow step counts for UI
export const getRLSWorkflowStats = async (): Promise<{
	totalTestItems: number;
	totalExamples: number;
	totalWorkflowSteps: number;
	operationCounts: Record<string, number>;
}> => {
	const testData = await getRLSTestData();

	let totalExamples = 0;
	let totalWorkflowSteps = 0;
	const operationCounts: Record<string, number> = {};

	for (const testItem of testData) {
		totalExamples += testItem.examples?.length || 0;

		for (const example of testItem.examples || []) {
			totalWorkflowSteps += example.workflow.length;

			for (const step of example.workflow) {
				operationCounts[step.operation] = (operationCounts[step.operation] || 0) + 1;
			}
		}
	}

	return {
		totalTestItems: testData.length,
		totalExamples,
		totalWorkflowSteps,
		operationCounts
	};
};

// Helper function to get test complexity metrics
export const getRLSTestComplexity = async (itemId?: string, exampleId?: string) => {
	const testData = await getRLSTestData();

	let targetItems: RLSTestItem[] = testData;

	if (itemId) {
		const item = testData.find(t => t.id === itemId);
		targetItems = item ? [item] : [];
	}

	const complexity = {
		authOperations: 0,
		sqlOperations: 0,
		tableOperations: 0,
		policyOperations: 0,
		cleanupOperations: 0,
		expectedResultChecks: 0,
		multiStepWorkflows: 0,
		averageStepsPerWorkflow: 0
	};

	let totalSteps = 0;
	let workflowCount = 0;

	for (const testItem of targetItems) {
		let targetExamples = testItem.examples || [];

		if (exampleId) {
			const example = testItem.examples?.find(e => e.id === exampleId);
			targetExamples = example ? [example] : [];
		}

		for (const example of targetExamples) {
			workflowCount++;
			totalSteps += example.workflow.length;

			if (example.workflow.length > 5) {
				complexity.multiStepWorkflows++;
			}

			for (const step of example.workflow) {
				switch (step.operation) {
					case 'auth_signup':
					case 'auth_signin':
					case 'auth_signout':
					case 'auth_update_user':
					case 'set_service_role':
						complexity.authOperations++;
						break;
					case 'raw_sql':
						complexity.sqlOperations++;
						if (step.sql?.includes('POLICY')) {
							complexity.policyOperations++;
						}
						break;
					case 'table_insert':
					case 'table_select':
					case 'table_update':
					case 'table_delete':
						complexity.tableOperations++;
						break;
					case 'cleanup':
						complexity.cleanupOperations++;
						break;
				}

				if (step.expected_result) {
					complexity.expectedResultChecks++;
				}
			}
		}
	}

	complexity.averageStepsPerWorkflow = workflowCount > 0 ? Math.round(totalSteps / workflowCount * 10) / 10 : 0;

	return complexity;
};

// Helper function to validate RLS test data structure
export const validateRLSTestData = async (): Promise<{
	isValid: boolean;
	errors: string[];
	warnings: string[];
	summary: {
		testItems: number;
		examples: number;
		workflowSteps: number;
	};
}> => {
	const errors: string[] = [];
	const warnings: string[] = [];

	try {
		const testData = await getRLSTestData();

		if (!Array.isArray(testData)) {
			errors.push('Test data is not an array');
			return { isValid: false, errors, warnings, summary: { testItems: 0, examples: 0, workflowSteps: 0 } };
		}

		let totalExamples = 0;
		let totalWorkflowSteps = 0;

		for (let i = 0; i < testData.length; i++) {
			const testItem = testData[i];

			// Validate test item structure
			if (!testItem.id) {
				errors.push(`Test item ${i} missing id`);
			}
			if (!testItem.title) {
				errors.push(`Test item ${i} missing title`);
			}
			if (!testItem.description) {
				warnings.push(`Test item ${i} missing description`);
			}
			if (!testItem.examples || !Array.isArray(testItem.examples)) {
				errors.push(`Test item ${i} missing or invalid examples array`);
				continue;
			}

			totalExamples += testItem.examples.length;

			// Validate examples
			for (let j = 0; j < testItem.examples.length; j++) {
				const example = testItem.examples[j];

				if (!example.id) {
					errors.push(`Example ${j} in test item ${i} missing id`);
				}
				if (!example.name) {
					errors.push(`Example ${j} in test item ${i} missing name`);
				}
				if (!example.workflow || !Array.isArray(example.workflow)) {
					errors.push(`Example ${j} in test item ${i} missing or invalid workflow array`);
					continue;
				}

				totalWorkflowSteps += example.workflow.length;

				// Validate workflow steps
				for (let k = 0; k < example.workflow.length; k++) {
					const step = example.workflow[k];

					if (!step.step) {
						warnings.push(`Step ${k} in example ${j} of test item ${i} missing step identifier`);
					}
					if (!step.name) {
						warnings.push(`Step ${k} in example ${j} of test item ${i} missing name`);
					}
					if (!step.operation) {
						errors.push(`Step ${k} in example ${j} of test item ${i} missing operation`);
					}

					// Validate operation-specific requirements
					if (step.operation === 'raw_sql' && !step.sql) {
						errors.push(`SQL step ${k} in example ${j} of test item ${i} missing sql property`);
					}
					if (['table_insert', 'table_select', 'table_update', 'table_delete'].includes(step.operation) && !step.table) {
						errors.push(`Table step ${k} in example ${j} of test item ${i} missing table property`);
					}
					if (['auth_signup', 'auth_signin', 'auth_update_user'].includes(step.operation) && !step.params) {
						errors.push(`Auth step ${k} in example ${j} of test item ${i} missing params property`);
					}
				}
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			summary: {
				testItems: testData.length,
				examples: totalExamples,
				workflowSteps: totalWorkflowSteps
			}
		};

	} catch (error) {
		errors.push(`Failed to validate test data: ${error instanceof Error ? error.message : String(error)}`);
		return { isValid: false, errors, warnings, summary: { testItems: 0, examples: 0, workflowSteps: 0 } };
	}
};

// Helper function to clear cached data
export const clearRLSTestDataCache = (): void => {
	cachedRLSTestData = null;
};

// Helper function to get operation type descriptions
export const getRLSOperationDescription = (operation: string): string => {
	const descriptions: Record<string, string> = {
		'cleanup': 'Reset test environment and clean up data',
		'auth_signup': 'Create a new user account',
		'auth_signin': 'Sign in an existing user',
		'auth_signout': 'Sign out the current user',
		'auth_update_user': 'Update user profile information',
		'set_service_role': 'Switch to service role context',
		'raw_sql': 'Execute raw SQL statement',
		'table_insert': 'Insert data into table with RLS',
		'table_select': 'Query data from table with RLS',
		'table_update': 'Update data in table with RLS',
		'table_delete': 'Delete data from table with RLS'
	};

	return descriptions[operation] || `Unknown operation: ${operation}`;
};