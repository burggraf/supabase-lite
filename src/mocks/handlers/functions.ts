import { http, HttpResponse } from 'msw'
import { vfsManager } from '../../lib/vfs/VFSManager'
import { logger } from '../../lib/infrastructure/Logger'
import { edgeFunctionsWebvmManager, EDGE_FUNCTIONS_VM_ROOT } from '../../lib/webvm'
import { withProjectResolution } from './shared/project-resolution'
import { 
  createErrorResponse, 
  safeJsonParse
} from './shared/common-handlers'

/**
 * Helper function for Edge Function simulation
 * Simulates realistic edge function execution with code parsing
 */
async function simulateEdgeFunctionExecution(
  functionName: string,
  code: string,
  requestBody: unknown
): Promise<{
  status: number;
  response: unknown;
  executionTime: number;
  headers: Record<string, string>;
}> {
  const startTime = performance.now();
  
  try {
    // Simulate realistic execution delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 80 + 20));
    
    let response: any;
    const status = 200;
    
    // Try to extract response patterns from the actual code
    try {
      // Look for Response constructor with JSON.stringify - improved regex to handle multiline objects
      const responseMatch = code.match(/new Response\(JSON\.stringify\((\{[\s\S]*?\})\)/);
      if (responseMatch) {
        let responseCode = responseMatch[1];
        
        // Simple variable substitution for common patterns
        responseCode = responseCode.replace(/new Date\(\)\.toISOString\(\)/g, `"${new Date().toISOString()}"`);
        responseCode = responseCode.replace(/req\.method/g, '"POST"');
        responseCode = responseCode.replace(/req\.url/g, `"${functionName}"`);
        
        // Handle variable substitution - if responseCode is just a variable name, find its definition
        if (responseCode.trim().match(/^\w+$/)) {
          const varName = responseCode.trim();
          const varMatch = code.match(new RegExp(`const\\s+${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});`, 'm'));
          if (varMatch) {
            responseCode = varMatch[1];
          }
        }
        
        // Handle request body access patterns and string concatenation
        if (code.includes('await req.json()') && requestBody) {
          // Handle direct property access like name
          if (typeof requestBody === 'object' && requestBody !== null) {
            for (const [key, value] of Object.entries(requestBody as any)) {
              // Replace patterns like: "Hello " + (name || "World") + "!"
              const pattern = new RegExp(`"([^"]*)" \\+ \\(${key} \\|\\| "([^"]*)"\\) \\+ "([^"]*)"`, 'g');
              responseCode = responseCode.replace(pattern, `"$1${value}$3"`);
              
              // Replace simple variable access
              responseCode = responseCode.replace(new RegExp(`\\b${key}\\b`, 'g'), `"${value}"`);
            }
          }
        }
        
        // Safely evaluate the response object
        try {
          response = eval(`(${responseCode})`);
        } catch {
          // Fallback if evaluation fails
          response = {
            message: `Function executed successfully`,
            timestamp: new Date().toISOString(),
            input: requestBody
          };
        }
      }
      // If we didn't find the full Response constructor, try just JSON.stringify pattern
      else if (code.includes('JSON.stringify')) {
        const jsonMatch = code.match(/JSON\.stringify\(([^)]+)\)/);
        if (jsonMatch) {
          let responseCode = jsonMatch[1].trim();
          
          // Handle variable substitution - if responseCode is just a variable name, find its definition
          if (responseCode.match(/^\w+$/)) {
            const varName = responseCode.trim();
            const varMatch = code.match(new RegExp(`const\\s+${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});`, 'm'));
            if (varMatch) {
              responseCode = varMatch[1];
            }
          }
          
          // Handle request body access patterns and string concatenation
          if (code.includes('await req.json()') && requestBody) {
            // Handle direct property access like name
            if (typeof requestBody === 'object' && requestBody !== null) {
              for (const [key, value] of Object.entries(requestBody as any)) {
                // Replace patterns like: "Hello " + (name || "World") + "!"
                const pattern = new RegExp(`"([^"]*)" \\+ \\(${key} \\|\\| "([^"]*)"\\) \\+ "([^"]*)"`, 'g');
                responseCode = responseCode.replace(pattern, `"$1${value}$3"`);
                
                // Replace simple variable access
                responseCode = responseCode.replace(new RegExp(`\\b${key}\\b`, 'g'), `"${value}"`);
              }
            }
          }
          
          // Safely evaluate the response object
          try {
            response = eval(`(${responseCode})`);
          } catch {
            // Fallback if evaluation fails
            response = {
              message: `Function executed successfully`,
              timestamp: new Date().toISOString(),
              input: requestBody
            };
          }
        }
      }
      // Look for simple object returns
      else if (code.includes('return') && code.includes('{')) {
        const returnMatch = code.match(/return\s+({[^}]+})/s);
        if (returnMatch) {
          try {
            let returnCode = returnMatch[1];
            returnCode = returnCode.replace(/new Date\(\)\.toISOString\(\)/g, `"${new Date().toISOString()}"`);
            response = eval(`(${returnCode})`);
          } catch {
            response = {
              result: 'Function executed',
              timestamp: new Date().toISOString()
            };
          }
        }
      }
    } catch {
      // Ignore parsing errors, use fallback
    }
    
    // Error simulation based on code content
    if ((code.includes('throw') || code.includes('Error')) && Math.random() > 0.8) {
      return {
        status: 500,
        response: { 
          error: 'Runtime Error',
          message: 'Function execution failed'
        },
        executionTime: performance.now() - startTime,
        headers: {
          'X-Edge-Runtime': 'deno',
          'X-Function-Status': 'error',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Fallback response if we couldn't parse the code
    if (!response) {
      response = {
        message: `Function executed successfully`,
        timestamp: new Date().toISOString(),
        requestBody: requestBody || null
      };
    }
    
    return {
      status,
      response,
      executionTime: performance.now() - startTime,
      headers: {
        'X-Edge-Runtime': 'deno',
        'X-Function-Version': '1',
        'X-Function-Status': 'success',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    return {
      status: 500,
      response: { 
        error: 'Function execution error',
        message: (error as Error).message
      },
      executionTime: performance.now() - startTime,
      headers: {
        'X-Edge-Runtime': 'deno',
        'X-Function-Status': 'error',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function readDeployedEdgeFunction(functionName: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crossOriginIsolated) {
    return null;
  }

  try {
    const instance = await edgeFunctionsWebvmManager.ensureStarted();
    const candidatePaths = [
      `${EDGE_FUNCTIONS_VM_ROOT}/${functionName}/index.ts`,
      `${EDGE_FUNCTIONS_VM_ROOT}/${functionName}/index.js`,
      `${EDGE_FUNCTIONS_VM_ROOT}/${functionName}.ts`,
      `${EDGE_FUNCTIONS_VM_ROOT}/${functionName}.js`,
    ];

    for (const path of candidatePaths) {
      try {
        const blob = await instance.readFileAsBlob(path);
        if (!blob) {
          continue;
        }

        const text = await blob.text();
        if (text) {
          return text;
        }
      } catch (error) {
        logger.debug('Unable to read deployed edge function from WebVM', { path, error });
      }
    }
  } catch (error) {
    logger.warn('Failed to access Edge Functions WebVM for deployed code', error as Error);
  }

  return null;
}

/**
 * Common Edge Function execution handler
 */
const createEdgeFunctionHandler = () => async ({ params, request }: any) => {
  try {
    const functionName = params.functionName as string;
    
    // Extract headers for authentication (Supabase.js compatibility)
    const apikey = request.headers.get('apikey');
    const authorization = request.headers.get('authorization');
    
    logger.info('Edge function invoked', { 
      functionName,
      hasApikey: !!apikey,
      hasAuth: !!authorization,
      method: request.method
    });

    const possiblePaths = [
      `edge-functions/${functionName}.ts`,
      `edge-functions/${functionName}/index.ts`,
      `edge-functions/${functionName}.js`,
    ];

    let functionSource = await readDeployedEdgeFunction(functionName);

    if (!functionSource) {
      for (const path of possiblePaths) {
        const file = await vfsManager.readFile(path);
        if (file?.content) {
          functionSource = file.content;
          break;
        }
      }
    }

    if (!functionSource) {
      return createErrorResponse(
        'Function not found',
        `Function '${functionName}' not found. Tried paths: ${possiblePaths.join(', ')}`,
        404
      );
    }

    // Get request body
    const requestBody = await safeJsonParse(request);

    // Simulate function execution
    const executionResult = await simulateEdgeFunctionExecution(
      functionName,
      functionSource,
      requestBody
    );

    logger.info('Edge function executed', { 
      functionName,
      status: executionResult.status,
      duration: executionResult.executionTime
    });

    return HttpResponse.json(executionResult.response as any, {
      status: executionResult.status,
      headers: {
        'Content-Type': 'application/json',
        'X-Function-Name': functionName,
        'X-Execution-Time': executionResult.executionTime.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
        ...executionResult.headers
      }
    });
  } catch (error) {
    logger.error('Edge function execution failed', error as Error);
    return createErrorResponse(
      'Function execution failed',
      (error as Error).message,
      500
    );
  }
}

// Edge Functions handlers
export const functionsHandlers = [
  // Non-project-scoped Edge Functions handlers
  http.all('/functions/:functionName', withProjectResolution(createEdgeFunctionHandler())),
  
  // Project-scoped Edge Functions handlers
  http.all('/:projectId/functions/:functionName', withProjectResolution(createEdgeFunctionHandler())),

  // Legacy /functions/v1/ prefix support (Supabase.js compatibility)
  http.all('/functions/v1/:functionName', withProjectResolution(createEdgeFunctionHandler())),
]
