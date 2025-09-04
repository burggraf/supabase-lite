import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Network Health Check Edge Function
 * 
 * Tests multiple external endpoints to verify Tailscale networking is working properly.
 * Returns a comprehensive report of network connectivity status.
 */

interface HealthCheckResult {
  endpoint: string;
  description: string;
  success: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

async function testEndpoint(url: string, description: string, timeout = 5000): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Supabase-Edge-Function-HealthCheck/1.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    return {
      endpoint: url,
      description,
      success: response.ok,
      responseTime,
      statusCode: response.status,
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      endpoint: url,
      description,
      success: false,
      responseTime,
      error: error.message,
    };
  }
}

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
    console.log('🔍 Starting network health check...');
    
    // Define test endpoints
    const endpoints = [
      {
        url: 'https://httpbin.org/ip',
        description: 'HTTP testing service (httpbin.org)'
      },
      {
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        description: 'JSON API service (JSONPlaceholder)'
      },
      {
        url: 'https://api.github.com/zen',
        description: 'GitHub API (rate limited but public)'
      },
      {
        url: 'https://api.quotable.io/random?maxLength=100',
        description: 'Random quotes API (Quotable)'
      },
      {
        url: 'https://dog.ceo/api/breeds/image/random',
        description: 'Dog images API (Dog CEO)'
      }
    ];
    
    // Test all endpoints concurrently
    console.log(`🌐 Testing ${endpoints.length} external endpoints...`);
    
    const results = await Promise.all(
      endpoints.map(({ url, description }) => 
        testEndpoint(url, description)
      )
    );
    
    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(`✅ Health check complete: ${successCount}/${results.length} endpoints successful`);
    
    // Calculate health score
    const healthScore = Math.round((successCount / results.length) * 100);
    
    let healthStatus: string;
    let statusEmoji: string;
    
    if (healthScore >= 80) {
      healthStatus = 'Excellent';
      statusEmoji = '🟢';
    } else if (healthScore >= 60) {
      healthStatus = 'Good';
      statusEmoji = '🟡';
    } else if (healthScore >= 40) {
      healthStatus = 'Poor';
      statusEmoji = '🟠';
    } else {
      healthStatus = 'Critical';
      statusEmoji = '🔴';
    }
    
    const response = {
      healthCheck: {
        status: healthStatus,
        emoji: statusEmoji,
        score: healthScore,
        timestamp: new Date().toISOString(),
        totalTime: `${totalTime}ms`
      },
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        averageResponseTime: results
          .filter(r => r.responseTime)
          .reduce((acc, r) => acc + (r.responseTime || 0), 0) / results.length
      },
      results: results.map(result => ({
        ...result,
        responseTime: result.responseTime ? `${result.responseTime}ms` : undefined
      })),
      networking: {
        tailscaleEnabled: true,
        message: healthScore >= 80 
          ? 'Tailscale networking is working perfectly! All external APIs are accessible.'
          : healthScore >= 60
          ? 'Tailscale networking is working well. Most external APIs are accessible.'
          : healthScore >= 40
          ? 'Tailscale networking has some issues. Some external APIs are not accessible.'
          : 'Tailscale networking may not be working properly. Most external APIs are not accessible.'
      },
      troubleshooting: failureCount > 0 ? [
        'If some endpoints failed, this might indicate network connectivity issues',
        'Check Tailscale connection status in Edge Functions → Networking',
        'Verify your auth key is valid and the connection is active',
        'Some endpoints might be temporarily unavailable'
      ] : [
        'All endpoints are responding correctly',
        'Tailscale networking is functioning properly',
        'You can now use external APIs in your Edge Functions'
      ]
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Health-Score': healthScore.toString(),
        'X-Response-Time': `${totalTime}ms`,
      },
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return new Response(JSON.stringify({
      healthCheck: {
        status: 'Error',
        emoji: '❌',
        score: 0,
        timestamp: new Date().toISOString()
      },
      error: {
        message: 'Health check failed to execute',
        details: error.message
      },
      troubleshooting: [
        'Check that the Edge Function is deployed correctly',
        'Verify Tailscale networking is configured',
        'Try running individual API tests first'
      ]
    }, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});