// id: filtering-through-referenced-tables
// name: Filtering through referenced tables       
import { createClient } from '@supabase/supabase-js';
const SUPABASE_CONFIG = {
    url: 'http://localhost:5173/b0cdc8d9-d9ef-4700-8fe0-7061dc914e48',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    debugSqlEndpoint: 'http://localhost:5173/debug/sql'
};
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
const expected_response = {
  "data": [
    {
      "name": "flute",
      "orchestral_sections": null
    },
    {
      "name": "violin",
      "orchestral_sections": null
    }
  ],
  "status": 200,
  "statusText": "OK"
};

// Helper functions for error mapping
function getStatusCodeFromError(errorCode: string): number {
    switch (errorCode) {
        case '23505': // unique_violation
            return 409;
        case '23503': // foreign_key_violation
            return 409;
        case '23502': // not_null_violation
            return 400;
        case '23514': // check_violation
            return 400;
        case '42P01': // undefined_table
            return 404;
        case '42703': // undefined_column
            return 400;
        default:
            return 400;
    }
}

function getStatusTextFromError(errorCode: string): string {
    switch (errorCode) {
        case '23505': // unique_violation
        case '23503': // foreign_key_violation
            return 'Conflict';
        case '42P01': // undefined_table
            return 'Not Found';
        default:
            return 'Bad Request';
    }
}
async function run() {
    try {
        let responseData, responseError, responseCount, responseStatus, responseStatusText;
        
        try {
            const { data, error } = await supabase
  .from('instruments')
  .select('name, orchestral_sections(*)')
  .eq('orchestral_sections.name', 'percussion')
            
            // Extract response components for compatibility
            // Handle both destructuring and direct response patterns
            if (typeof response !== 'undefined') {
                // Direct response object (const response = await ...)
                ({ data: responseData, error: responseError, count: responseCount, status: responseStatus, statusText: responseStatusText } = response || {});
            } else if (typeof data !== 'undefined' || typeof error !== 'undefined') {
                // Destructuring pattern (const { data, error } = await ...)
                responseData = data;
                responseError = error;
            }
        } catch (executionError) {
            // Handle JavaScript execution errors (like calling .eq() before .select())
            console.log('Data:', JSON.stringify({
                error: {
                    code: 'UNKNOWN',
                    details: null,
                    hint: null,
                    message: executionError.message
                },
                status: 400,
                statusText: 'Bad Request'
            }));
            return;
        }
        
        // Handle error cases - format as PostgREST error response
        if (responseError) {
            // Create PostgREST-compatible error response
            const errorResponse = {
                error: {
                    code: responseError.code || 'UNKNOWN',
                    details: responseError.details || null,
                    hint: responseError.hint || null,
                    message: responseError.message || 'An error occurred'
                },
                status: getStatusCodeFromError(responseError.code),
                statusText: getStatusTextFromError(responseError.code)
            };
            
            console.log('Data:', JSON.stringify(errorResponse));
            return;
        }
        
        // Extract status information from response data (injected by ResponseFormatter for testing)
        let extractedStatus, extractedStatusText;
        if (responseData && typeof responseData === 'object' && responseData.__supabase_status) {
            extractedStatus = responseData.__supabase_status;
            extractedStatusText = responseData.__supabase_status_text;
            // Replace the data with the actual data value for compatibility
            responseData = responseData.__supabase_data;
        }
        
        // Helper functions to extract parts from code
        function extractTableFromCode(code) {
            const match = code.match(/\.from\(['"`]([^'"`]+)['"`]\)/);
            return match ? match[1] : 'unknown';
        }
        
        function extractFilterFromCode(code) {
            const match = code.match(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains)\(['"`]([^'"`]+)['"`],\s*([^)]+)\)/);
            if (match) {
                const [, operator, column, value] = match;
                const cleanValue = value.replace(/['"`]/g, '');
                return `?${column}=${operator}.${cleanValue}`;
            }
            return '';
        }
        
        function extractBodyFromCode(code) {
            const match = code.match(/\.update\(([^)]+)\)/);
            if (match) {
                try {
                    return JSON.parse(match[1]);
                } catch {
                    // If parsing fails, try to extract simple object
                    const objMatch = match[1].match(/\{\s*([^}]+)\s*\}/);
                    if (objMatch) {
                        const keyValue = objMatch[1].match(/(\w+):\s*['"`]([^'"`]+)['"`]/);
                        if (keyValue) {
                            return { [keyValue[1]]: keyValue[2] };
                        }
                    }
                }
            }
            return {};
        }

        // Create Supabase-compatible response structure
        // Handle different response types (data queries vs count queries vs mutation operations)
        let testResponse;
        if (typeof responseData !== 'undefined' && responseData !== null) {
            // Check if this is an INSERT/UPDATE/DELETE operation by examining the code
            const codeString = "const { data, error } = await supabase\n  .from('instruments')\n  .select('name, orchestral_sections(*)')\n  .eq('orchestral_sections.name', 'percussion')";
            const isInsertOperation = codeString.includes('.insert(');
            const isUpdateOperation = codeString.includes('.update(');
            const isUpsertOperation = codeString.includes('.upsert(');
            const isDeleteOperation = codeString.includes('.delete(');
            const hasSelectClause = codeString.includes('.select(');
            
            if (isInsertOperation || isUpsertOperation) {
                if (hasSelectClause) {
                    // INSERT/UPSERT with .select() - should return 201 Created with data
                    testResponse = {
                        data: responseData,
                        status: 201,
                        statusText: "Created"
                    };
                } else {
                    // INSERT/UPSERT without .select() - should return 201 Created, no data
                    testResponse = {
                        status: 201,
                        statusText: "Created"
                    };
                }
            } else if (isUpdateOperation || isDeleteOperation) {
                if (hasSelectClause) {
                    // UPDATE/DELETE with .select() - should return 200 OK with data
                    testResponse = {
                        data: responseData,
                        status: 200,
                        statusText: "OK"
                    };
                } else {
                    // UPDATE/DELETE without .select() - should return 204 No Content, no data
                    testResponse = {
                        status: 204,
                        statusText: "No Content"
                    };
                }
            } else {
                // Normal SELECT query - should return 200 OK with data
                testResponse = {
                    data: responseData,
                    status: 200,
                    statusText: "OK"
                };
            }
        } else if (typeof responseCount !== 'undefined') {
            // Check if this is a DELETE/UPDATE operation with null count (should return 204, not count response)
            const codeString = "const { data, error } = await supabase\n  .from('instruments')\n  .select('name, orchestral_sections(*)')\n  .eq('orchestral_sections.name', 'percussion')";
            const isDeleteOperation = codeString.includes('.delete(');
            const isUpdateOperation = codeString.includes('.update(');
            const hasSelectClause = codeString.includes('.select(');
            
            if ((isDeleteOperation || isUpdateOperation) && !hasSelectClause && responseCount === null) {
                // DELETE/UPDATE without .select() - should return 204 No Content, not count response
                testResponse = {
                    status: 204,
                    statusText: "No Content"
                };
            } else {
                // Legitimate count query
                testResponse = {
                    count: responseCount,
                    status: 200,
                    statusText: "OK"
                };
            }
        } else if (typeof responseError === 'undefined' || responseError === null) {
            // Check if we extracted status info from the response data
            if (extractedStatus && extractedStatusText) {
                // Use the extracted status from MSW handler injection
                testResponse = {
                    status: extractedStatus,
                    statusText: extractedStatusText
                };
            } else if (typeof responseStatus !== 'undefined' && typeof responseStatusText !== 'undefined') {
                // Use the API response status directly when available
                testResponse = {
                    status: responseStatus,
                    statusText: responseStatusText
                };
            } else {
                // INSERT/UPDATE/DELETE operations that succeed (no data/count returned, no error)
                const codeString = "const { data, error } = await supabase\n  .from('instruments')\n  .select('name, orchestral_sections(*)')\n  .eq('orchestral_sections.name', 'percussion')";
                const isInsertOperation = codeString.includes('.insert(');
                const isUpsertOperation = codeString.includes('.upsert(');
                const isUpdateOperation = codeString.includes('.update(');
                const isDeleteOperation = codeString.includes('.delete(');
                
                if (isInsertOperation || isUpsertOperation) {
                    // INSERT/UPSERT without .select() - should return 201 Created
                    testResponse = {
                        status: 201,
                        statusText: "Created"
                    };
                } else if (isUpdateOperation || isDeleteOperation) {
                    // UPDATE/DELETE without .select() - should return 204 No Content
                    testResponse = {
                        status: 204,
                        statusText: "No Content"
                    };
                } else {
                    // Fallback for other operations
                    testResponse = {
                        status: 200,
                        statusText: "OK"
                    };
                }
            }
        } else {
            // Fallback - check what variables are available
            const availableVars = [];
            if (typeof responseData !== 'undefined') availableVars.push('data');
            if (typeof responseCount !== 'undefined') availableVars.push('count');
            if (typeof responseError !== 'undefined') availableVars.push('error');
            throw new Error(`Could not determine response structure. Available variables: ${availableVars.join(', ')}`);
        }
        
        console.log('Data:', JSON.stringify(testResponse));
    } catch (error) {
        console.error('Unexpected Error:', error);
        Deno.exit(1);
    }
}
run();