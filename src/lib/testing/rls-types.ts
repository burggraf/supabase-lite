// Common interfaces shared with PostgREST tests
export interface TestLog {
	type: 'info' | 'error' | 'debug';
	message: string;
	timestamp: string;
}

export interface TestResults {
	passed: boolean;
	log: TestLog[];
	skip: boolean;
}

// RLS-specific interfaces
export interface WorkflowStep {
	step: string;
	name: string;
	operation: string;
	params?: any;
	sql?: string;
	table?: string;
	data?: any;
	select?: string;
	filter?: any;
	expected_result?: {
		row_count?: number;
		contains?: any | any[];
		not_contains?: any | any[];
		should_error?: boolean;
		error_message?: string;
	};
	expected_error?: boolean;
}

export interface RLSExample {
	id: string;
	name: string;
	description: string;
	workflow: WorkflowStep[];
	results?: TestResults;
}

export interface RLSTestItem {
	id: string;
	title: string;
	description: string;
	examples: RLSExample[];
}

// Authentication and user context types
export interface UserCredentials {
	email: string;
	password: string;
	id?: string;
	data?: any;
}

export interface RLSTestContext {
	currentUser: UserCredentials | null;
	serviceRole: boolean;
	supabaseClient: any;
	serviceClient: any;
	testData: Map<string, any>;
}

// Test execution types
export interface RLSTestExecution {
	example: RLSExample;
	testItem: RLSTestItem;
	status: 'pending' | 'running' | 'completed' | 'failed';
	startTime?: number;
	endTime?: number;
	currentStepIndex?: number;
	stepResults?: WorkflowStepResult[];
	error?: string;
}

export interface WorkflowStepResult {
	step: WorkflowStep;
	status: 'pending' | 'running' | 'completed' | 'failed';
	startTime?: number;
	endTime?: number;
	result?: any;
	error?: string;
	logs: TestLog[];
}

export interface RLSTestSuiteExecution {
	testItems: RLSTestItem[];
	executions: Map<string, RLSTestExecution>;
	stats: {
		total: number;
		passed: number;
		failed: number;
		skipped: number;
	};
}

// Configuration for RLS testing
export interface RLSTestConfig {
	supabaseLiteUrl: string;
	debugSqlEndpoint: string;
	anonKey: string;
	serviceRoleKey: string;
	skipOnFirstFailure: boolean;
	maxRetries: number;
}

// Result comparison interface for RLS tests
export interface RLSComparisonResult {
	match: boolean;
	differences?: string;
	actualValue?: any;
	expectedValue?: any;
	validationDetails?: {
		rowCount?: { expected: number; actual: number; match: boolean };
		contains?: { items: any[]; allFound: boolean };
		notContains?: { items: any[]; noneFound: boolean };
	};
}

// Operation result interfaces
export interface OperationResult {
	success: boolean;
	data?: any;
	error?: string;
	expectedError?: boolean;
	logs?: TestLog[];
	count?: number;
}

export interface AuthOperationResult extends OperationResult {
	user?: any;
	session?: any;
	existing?: boolean;
}

export interface SQLOperationResult extends OperationResult {
	rowsAffected?: number;
	executionTime?: number;
}

export interface TableOperationResult extends OperationResult {
	rowCount?: number;
	affectedRows?: number;
}

// Test validation interfaces
export interface ExpectedResultValidation {
	rowCountValid?: boolean;
	containsValid?: boolean;
	notContainsValid?: boolean;
	errorValid?: boolean;
	details?: string[];
}