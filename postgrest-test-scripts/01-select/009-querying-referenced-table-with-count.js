import { createClient } from '@supabase/supabase-js'

import { executeCleanupSQL, extractTableNamesFromSQL } from '../cleanup-utils.js'
import { SUPABASE_CONFIG } from '../config/supabase-config.js'

// Test: Querying referenced table with count
// Function: select
// Example ID: querying-referenced-table-with-count

async function executeSetupSQL(sql) {
	if (!sql.trim()) return

	// Split multiple SQL commands by semicolon
	const commands = sql
		.split(';')
		.map((cmd) => cmd.trim())
		.filter((cmd) => cmd.length > 0)

	for (const command of commands) {
		const response = await fetch(SUPABASE_CONFIG.debugSqlEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sql: command }),
		})

		const result = await response.json()
		if (result.error) {
			throw new Error(`Setup SQL failed: ${result.error} - ${result.message || ''}`)
		}
	}
}

async function runTest() {
	console.log('='.repeat(60))
	console.log(`Running test: 009-querying-referenced-table-with-count`)
	console.log(`Function: select`)
	console.log(`Test: Querying referenced table with count`)
	console.log('='.repeat(60))

	// Expected response for comparison
	const expectedResponse = [
		{
			id: '693694e7-d993-4360-a6d7-6294e325d9b6',
			name: 'strings',
			instruments: [
				{
					count: 4,
				},
			],
		},
	]

	// Track tables created for cleanup
	let createdTables = []

	try {
		// Initialize Supabase client
		const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)

		// Setup SQL
		const setupSQL = `drop table if exists instruments;
drop table if exists orchestral_sections;

create table orchestral_sections (
  "id" "uuid" primary key default gen_random_uuid() not null,
  "name" text
);
create table instruments (
  "id" "uuid" primary key default gen_random_uuid() not null,
  "name" text,
  "section_id" "uuid" references public.orchestral_sections on delete cascade
);
with section as (
  insert into orchestral_sections (name)
  values ('strings') returning id
)
insert into instruments (name, section_id) values
('violin', (select id from section)),
('viola', (select id from section)),
('cello', (select id from section)),
('double bass', (select id from section));`
		if (setupSQL.trim()) {
			console.log('📋 Executing setup SQL...')
			createdTables = extractTableNamesFromSQL(setupSQL)
			await executeSetupSQL(setupSQL)
			console.log('✅ Setup completed')
		}

		// Execute test code
		console.log('🧪 Executing test code...')
		const { data, error } = await supabase
			.from('orchestral_sections')
			.select(`*, instruments(count)`)

		// Basic validation
		if (data && expectedResponse) {
			const dataMatches = JSON.stringify(data) === JSON.stringify(expectedResponse)
			console.log(`✅ Test result: ${dataMatches ? 'PASS' : 'FAIL'}`)

			if (!dataMatches) {
				console.log('📊 Expected:', JSON.stringify(expectedResponse, null, 2))
				console.log('📊 Actual:', JSON.stringify(data, null, 2))
			}

			return {
				testId: '009-querying-referenced-table-with-count',
				functionId: 'select',
				name: 'Querying referenced table with count',
				passed: dataMatches,
				error: null,
				data: data,
				expected: expectedResponse,
			}
		} else {
			console.log('⚠️  No expected response data to compare')
			return {
				testId: '009-querying-referenced-table-with-count',
				functionId: 'select',
				name: 'Querying referenced table with count',
				passed: data ? true : false,
				error: error ? error.message : null,
				data: data,
				expected: expectedResponse,
			}
		}
	} catch (err) {
		console.log(`❌ Test failed with error: ${err.message}`)
		return {
			testId: '009-querying-referenced-table-with-count',
			functionId: 'select',
			name: 'Querying referenced table with count',
			passed: false,
			error: err.message,
			data: null,
			expected: expectedResponse,
		}
	} finally {
		// Always cleanup, regardless of pass/fail
		await executeCleanupSQL(createdTables, SUPABASE_CONFIG.debugSqlEndpoint)
	}
}

// Export the test function
export default runTest

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runTest()
		.then((result) => {
			console.log('\n📋 Final Result:', result)
			process.exit(result.passed ? 0 : 1)
		})
		.catch((err) => {
			console.error('💥 Test runner error:', err)
			process.exit(1)
		})
}
