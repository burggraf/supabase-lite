import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Edge Function to test external API connectivity through Tailscale networking
 * 
 * This function demonstrates:
 * - External HTTP requests to third-party APIs
 * - Error handling for network failures
 * - JSON parsing and response formatting
 * - CORS headers for browser access
 */

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const startTime = Date.now();
    
    // Parse request to get which API to test
    let requestBody = null;
    try {
      requestBody = await req.json();
    } catch {
      // No body or invalid JSON - use defaults
    }
    
    const apiType = requestBody?.api || 'posts';
    let apiUrl: string;
    let description: string;

    // Choose API endpoint based on request
    switch (apiType) {
      case 'posts':
        apiUrl = 'https://jsonplaceholder.typicode.com/posts?_limit=3';
        description = 'Fetching sample posts from JSONPlaceholder';
        break;
      case 'users':
        apiUrl = 'https://jsonplaceholder.typicode.com/users?_limit=3';
        description = 'Fetching sample users from JSONPlaceholder';
        break;
      case 'todos':
        apiUrl = 'https://jsonplaceholder.typicode.com/todos?_limit=5';
        description = 'Fetching sample todos from JSONPlaceholder';
        break;
      case 'weather':
        // Using a free weather API (no auth needed)
        apiUrl = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true';
        description = 'Fetching current weather for Berlin from Open-Meteo API';
        break;
      case 'quote':
        apiUrl = 'https://api.quotable.io/random';
        description = 'Fetching random quote from Quotable API';
        break;
      default:
        apiUrl = 'https://jsonplaceholder.typicode.com/posts/1';
        description = 'Fetching single post from JSONPlaceholder';
    }

    console.log(`🌐 Testing external API: ${apiUrl}`);
    console.log(`📝 ${description}`);

    // Make the external API call
    const externalResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Supabase-Edge-Function/1.0',
        'Accept': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;

    if (!externalResponse.ok) {
      throw new Error(`External API returned ${externalResponse.status}: ${externalResponse.statusText}`);
    }

    const externalData = await externalResponse.json();
    
    console.log(`✅ External API call successful (${responseTime}ms)`);

    // Return success response with external data
    const responseData = {
      success: true,
      message: 'External API call successful! Tailscale networking is working.',
      api: {
        type: apiType,
        url: apiUrl,
        description,
        statusCode: externalResponse.status,
        responseTime: `${responseTime}ms`
      },
      data: externalData,
      metadata: {
        timestamp: new Date().toISOString(),
        userAgent: req.headers.get('User-Agent'),
        method: req.method,
        tailscaleEnabled: true
      }
    };

    return new Response(JSON.stringify(responseData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Response-Time': `${responseTime}ms`,
      },
    });

  } catch (error) {
    console.error('❌ External API call failed:', error);
    
    const errorResponse = {
      success: false,
      message: 'External API call failed. Check Tailscale networking configuration.',
      error: {
        name: error.name,
        message: error.message,
        timestamp: new Date().toISOString()
      },
      troubleshooting: [
        'Verify Tailscale is connected in Edge Functions → Networking',
        'Check that the auth key is properly configured',
        'Ensure the target API endpoint is accessible',
        'Test connectivity using the "Test Connectivity" button'
      ]
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});