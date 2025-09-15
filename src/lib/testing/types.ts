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

export interface PostgreSTTestData {
	sql: string;
}

export interface PostgreSTTest {
	id: string;
	name: string;
	code: string;
	data?: PostgreSTTestData;
	response: string;
	results?: TestResults;
	description?: string;
	hideCodeBlock?: boolean;
	unsupported?: boolean;
}

export interface PostgreSTCategory {
	id: string;
	title: string;
	$ref?: string;
	notes?: string;
	description?: string;
	examples: PostgreSTTest[];
}

export interface TestExecution {
	test: PostgreSTTest;
	category: PostgreSTCategory;
	status: 'pending' | 'running' | 'completed' | 'failed';
	startTime?: number;
	endTime?: number;
	actualResult?: any;
	expectedResult?: any;
	error?: string;
}

export interface TestSuiteExecution {
	categories: PostgreSTCategory[];
	executions: Map<string, TestExecution>;
	stats: {
		total: number;
		passed: number;
		failed: number;
		skipped: number;
		unsupported: number;
	};
}

// API response structure for compatibility
export interface SupabaseResponse {
	data?: any;
	error?: {
		code?: string;
		message: string;
		details?: any;
		hint?: any;
	};
	count?: number;
	status?: number;
	statusText?: string;
}

// Test execution configuration
export interface TestConfig {
	supabaseLiteUrl: string;
	debugSqlEndpoint: string;
	anonKey: string;
	skipUnsupported: boolean;
	stopOnFirstFailure: boolean;
}

// Result comparison interface
export interface ComparisonResult {
	match: boolean;
	differences?: string;
	actualValue?: any;
	expectedValue?: any;
}