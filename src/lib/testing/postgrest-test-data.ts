import type { PostgreSTCategory } from './types';

// Import the JSON data - will need to be loaded from the file
export const loadPostgRESTTestData = async (): Promise<PostgreSTCategory[]> => {
	try {
		// Try to load the JSON file directly
		const response = await fetch('/postgrest.test.json');
		if (!response.ok) {
			throw new Error(`Failed to load test data: ${response.status} ${response.statusText}`);
		}
		const data = await response.json();
		return data as PostgreSTCategory[];
	} catch (error) {
		console.error('Failed to load PostgREST test data:', error);

		// Fallback to a minimal test set for development
		return [{
			id: 'select',
			title: 'Fetch data: select()',
			examples: [{
				id: 'getting-your-data',
				name: 'Getting your data',
				code: `const { data, error } = await supabase
  .from('characters')
  .select()`,
				data: {
					sql: `CREATE TABLE characters (id int8 primary key, name text);
INSERT INTO characters (id, name) VALUES (1, 'Harry'), (2, 'Frodo'), (3, 'Katniss');`
				},
				response: `{
  "data": [
    {"id": 1, "name": "Harry"},
    {"id": 2, "name": "Frodo"},
    {"id": 3, "name": "Katniss"}
  ],
  "status": 200,
  "statusText": "OK"
}`
			}]
		}];
	}
};

// Cache for the test data to avoid multiple loads
let cachedTestData: PostgreSTCategory[] | null = null;

export const getPostgRESTTestData = async (): Promise<PostgreSTCategory[]> => {
	if (cachedTestData === null) {
		cachedTestData = await loadPostgRESTTestData();
	}
	return cachedTestData;
};

// Helper function to get categories for UI
export const getTestCategories = async (): Promise<Array<{ id: string; title: string; count: number }>> => {
	const testData = await getPostgRESTTestData();
	return testData.map(category => ({
		id: category.id,
		title: category.title,
		count: category.examples?.length || 0
	}));
};

// Helper function to get tests for a specific category
export const getCategoryTests = async (categoryId: string): Promise<PostgreSTCategory | null> => {
	const testData = await getPostgRESTTestData();
	return testData.find(category => category.id === categoryId) || null;
};