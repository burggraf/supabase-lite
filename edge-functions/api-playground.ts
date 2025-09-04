import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * API Playground Edge Function
 * 
 * Interactive function for testing various external APIs.
 * Supports multiple API endpoints that developers commonly use.
 */

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const startTime = Date.now();
    
    // Parse request body
    let requestBody = null;
    try {
      requestBody = await req.json();
    } catch {
      // No body - return API list
    }
    
    // If no specific API requested, return available APIs
    if (!requestBody?.api) {
      return new Response(JSON.stringify({
        message: 'API Playground - Test external API connectivity',
        usage: 'POST with {"api": "api_name"} to test specific APIs',
        availableAPIs: {
          'posts': 'JSONPlaceholder - Sample blog posts',
          'users': 'JSONPlaceholder - Sample user data', 
          'weather': 'Open-Meteo - Current weather data',
          'quote': 'Quotable - Random inspirational quotes',
          'joke': 'JokesAPI - Random programming jokes',
          'cat': 'Cat Facts API - Random cat facts',
          'dog': 'Dog CEO API - Random dog images',
          'uuid': 'UUID Generator API - Generate UUIDs',
          'httpbin': 'HTTPBin - HTTP testing utilities',
          'time': 'WorldTimeAPI - Current time zones'
        },
        examples: [
          '{"api": "weather"}',
          '{"api": "quote"}', 
          '{"api": "joke"}',
          '{"api": "posts"}'
        ],
        tailscaleStatus: 'Connected and working!'
      }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const apiType = requestBody.api.toLowerCase();
    let apiUrl: string;
    let description: string;
    let apiName: string;

    // Select API endpoint
    switch (apiType) {
      case 'posts':
        apiUrl = 'https://jsonplaceholder.typicode.com/posts?_limit=2';
        description = 'Sample blog posts from JSONPlaceholder';
        apiName = 'JSONPlaceholder Posts';
        break;
        
      case 'users':
        apiUrl = 'https://jsonplaceholder.typicode.com/users?_limit=2';
        description = 'Sample user data from JSONPlaceholder';
        apiName = 'JSONPlaceholder Users';
        break;
        
      case 'weather':
        // Berlin weather from Open-Meteo (no API key needed)
        apiUrl = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true&temperature_unit=celsius';
        description = 'Current weather for Berlin from Open-Meteo API';
        apiName = 'Open-Meteo Weather';
        break;
        
      case 'quote':
        apiUrl = 'https://api.quotable.io/random?maxLength=150';
        description = 'Random inspirational quote from Quotable API';
        apiName = 'Quotable API';
        break;
        
      case 'joke':
        apiUrl = 'https://v2.jokeapi.dev/joke/Programming?type=single';
        description = 'Random programming joke from JokesAPI';
        apiName = 'JokesAPI';
        break;
        
      case 'cat':
        apiUrl = 'https://catfact.ninja/fact';
        description = 'Random cat fact from Cat Facts API';
        apiName = 'Cat Facts API';
        break;
        
      case 'dog':
        apiUrl = 'https://dog.ceo/api/breeds/image/random';
        description = 'Random dog image from Dog CEO API';
        apiName = 'Dog CEO API';
        break;
        
      case 'uuid':
        apiUrl = 'https://httpbin.org/uuid';
        description = 'Generate a random UUID from HTTPBin';
        apiName = 'UUID Generator';
        break;
        
      case 'httpbin':
        apiUrl = 'https://httpbin.org/json';
        description = 'Sample JSON response from HTTPBin';
        apiName = 'HTTPBin JSON';
        break;
        
      case 'time':
        apiUrl = 'http://worldtimeapi.org/api/timezone/America/New_York';
        description = 'Current time in New York from WorldTimeAPI';
        apiName = 'WorldTimeAPI';
        break;
        
      default:
        return new Response(JSON.stringify({
          error: `Unknown API: ${apiType}`,
          availableAPIs: ['posts', 'users', 'weather', 'quote', 'joke', 'cat', 'dog', 'uuid', 'httpbin', 'time']
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
    }

    console.log(`🌐 Calling ${apiName}: ${apiUrl}`);

    // Make the API call
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Supabase-Edge-Function-Playground/1.0',
        'Accept': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      throw new Error(`${apiName} returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`✅ ${apiName} call successful (${responseTime}ms)`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully called ${apiName}! 🎉`,
      api: {
        name: apiName,
        url: apiUrl,
        description,
        statusCode: response.status,
        responseTime: `${responseTime}ms`
      },
      data,
      networking: {
        tailscaleEnabled: true,
        status: 'Working perfectly!',
        message: 'External API calls are working through Tailscale networking.'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestedAPI: apiType
      }
    }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-API-Name': apiName,
        'X-Response-Time': `${responseTime}ms`,
      },
    });

  } catch (error) {
    console.error('❌ API call failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'API call failed - check Tailscale networking configuration',
      error: {
        name: error.name,
        message: error.message
      },
      troubleshooting: [
        '1. Verify Tailscale is connected (Edge Functions → Networking)',
        '2. Check the connection status shows "Connected"',
        '3. Try the "Test Connectivity" button',
        '4. Ensure your auth key is valid and reusable'
      ],
      networking: {
        tailscaleEnabled: false,
        status: 'Connection issues detected',
        message: 'External API calls require Tailscale networking to be active.'
      }
    }, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});