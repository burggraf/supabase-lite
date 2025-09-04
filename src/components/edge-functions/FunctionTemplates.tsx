import React from 'react';
import { Card, CardContent } from '../ui/card';
import { ChevronRight } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  code: string;
}

interface FunctionTemplatesProps {
  onSelectTemplate: (templateId: string) => void;
}

const templates: Template[] = [
  {
    id: 'hello-world',
    name: 'Simple Hello World',
    description: 'Basic function that returns a JSON response',
    icon: '👋',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const data = {
    message: "Hello from Supabase Edge Functions!",
    timestamp: new Date().toISOString(),
  };
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    }
  });
});`,
  },
  {
    id: 'database-access',
    name: 'Supabase Database Access',
    description: 'Example using Supabase client to query your database',
    icon: '🗄️',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const { data, error } = await supabase
    .from('your_table')
    .select('*')
    .limit(10);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  });
});`,
  },
  {
    id: 'storage-upload',
    name: 'Supabase Storage Upload',
    description: 'Upload files to Supabase Storage',
    icon: '📁',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(\`\${Date.now()}_\${file.name}\`, file);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  });
});`,
  },
  {
    id: 'node-api',
    name: 'Node Built-in API Example',
    description: 'Example using Node.js built-in crypto and http modules',
    icon: '🟢',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createHash } from "node:crypto";

Deno.serve(async (req: Request) => {
  const { text } = await req.json();
  
  if (!text) {
    return new Response(JSON.stringify({ error: 'Text is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hash = createHash('sha256').update(text).digest('hex');
  
  return new Response(JSON.stringify({
    original: text,
    hash,
    algorithm: 'sha256'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});`,
  },
  {
    id: 'express',
    name: 'Express Server',
    description: 'Example using Express.js for routing',
    icon: '⚡',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import express from "npm:express@4.18.2";

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/echo', (req, res) => {
  res.json({ echo: req.body });
});

app.get('*', (req, res) => {
  res.json({ message: 'Hello from Express on Edge Functions!' });
});

Deno.serve(app.fetch);`,
  },
  {
    id: 'openai-completion',
    name: 'OpenAI Text Completion',
    description: 'Generate text completions using OpenAI GPT-3',
    icon: '🤖',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const { prompt } = await req.json();
  
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${Deno.env.get('OPENAI_API_KEY')}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    }),
  });

  const data = await response.json();
  
  return new Response(JSON.stringify({
    completion: data.choices[0]?.message?.content,
    usage: data.usage
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});`,
  },
  {
    id: 'stripe-webhook',
    name: 'Stripe Webhook Example',
    description: 'Handle Stripe webhook events securely',
    icon: '💳',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  
  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  // Verify webhook signature
  // const event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Handle the event
  const event = JSON.parse(body);
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log('Payment succeeded:', event.data.object);
      break;
    case 'customer.created':
      console.log('Customer created:', event.data.object);
      break;
    default:
      console.log(\`Unhandled event type: \${event.type}\`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});`,
  },
  {
    id: 'resend-email',
    name: 'Send Emails',
    description: 'Send emails using the Resend API',
    icon: '📧',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const { to, subject, html } = await req.json();
  
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields: to, subject, html' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${Deno.env.get('RESEND_API_KEY')}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'noreply@yourdomain.com',
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json();
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});`,
  },
  {
    id: 'image-transform',
    name: 'Image Transformation',
    description: 'Transform images using ImageMagick WASM',
    icon: '🖼️',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const formData = await req.formData();
  const file = formData.get('image') as File;
  const width = parseInt(formData.get('width') as string) || 300;
  const height = parseInt(formData.get('height') as string) || 300;
  
  if (!file) {
    return new Response(JSON.stringify({ error: 'No image provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Note: This is a simplified example
  // In a real implementation, you would use ImageMagick WASM
  const arrayBuffer = await file.arrayBuffer();
  
  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': file.type,
      'Content-Disposition': \`attachment; filename="resized_\${file.name}"\`,
    },
  });
});`,
  },
  {
    id: 'websocket-server',
    name: 'WebSocket Server Example',
    description: 'Create a real-time WebSocket server',
    icon: '🔌',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve((req: Request) => {
  const upgrade = req.headers.get("upgrade") || "";
  
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  socket.onopen = () => {
    console.log("WebSocket connection opened");
    socket.send(JSON.stringify({ 
      type: "welcome", 
      message: "Connected to Supabase Edge Function WebSocket!" 
    }));
  };

  socket.onmessage = (event) => {
    console.log("Received:", event.data);
    const data = JSON.parse(event.data);
    
    // Echo the message back
    socket.send(JSON.stringify({
      type: "echo",
      data,
      timestamp: new Date().toISOString()
    }));
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed");
  };

  return response;
});`,
  },
  {
    id: 'external-api-test',
    name: 'External API Test',
    description: 'Test external API connectivity through Tailscale networking',
    icon: '🌐',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    console.log(\`🌐 Testing external API: \${apiUrl}\`);
    console.log(\`📝 \${description}\`);

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
      throw new Error(\`External API returned \${externalResponse.status}: \${externalResponse.statusText}\`);
    }

    const externalData = await externalResponse.json();
    
    console.log(\`✅ External API call successful (\${responseTime}ms)\`);

    // Return success response with external data
    const responseData = {
      success: true,
      message: 'External API call successful! Tailscale networking is working.',
      api: {
        type: apiType,
        url: apiUrl,
        description,
        statusCode: externalResponse.status,
        responseTime: \`\${responseTime}ms\`
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
        'X-Response-Time': \`\${responseTime}ms\`,
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
});`,
  },
  {
    id: 'network-health-check',
    name: 'Network Health Check',
    description: 'Comprehensive health check for Tailscale network connectivity',
    icon: '🏥',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    console.log(\`🌐 Testing \${endpoints.length} external endpoints...\`);
    
    const results = await Promise.all(
      endpoints.map(({ url, description }) => 
        testEndpoint(url, description)
      )
    );
    
    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(\`✅ Health check complete: \${successCount}/\${results.length} endpoints successful\`);
    
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
        totalTime: \`\${totalTime}ms\`
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
        responseTime: result.responseTime ? \`\${result.responseTime}ms\` : undefined
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
        'X-Response-Time': \`\${totalTime}ms\`,
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
});`,
  },
  {
    id: 'api-playground',
    name: 'API Playground',
    description: 'Interactive playground for testing various external APIs',
    icon: '🎮',
    code: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
          error: \`Unknown API: \${apiType}\`,
          availableAPIs: ['posts', 'users', 'weather', 'quote', 'joke', 'cat', 'dog', 'uuid', 'httpbin', 'time']
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
    }

    console.log(\`🌐 Calling \${apiName}: \${apiUrl}\`);

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
      throw new Error(\`\${apiName} returned \${response.status}: \${response.statusText}\`);
    }

    const data = await response.json();
    
    console.log(\`✅ \${apiName} call successful (\${responseTime}ms)\`);

    return new Response(JSON.stringify({
      success: true,
      message: \`Successfully called \${apiName}! 🎉\`,
      api: {
        name: apiName,
        url: apiUrl,
        description,
        statusCode: response.status,
        responseTime: \`\${responseTime}ms\`
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
        'X-Response-Time': \`\${responseTime}ms\`,
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
});`,
  },
];

export const FunctionTemplates: React.FC<FunctionTemplatesProps> = ({
  onSelectTemplate,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <button
          key={template.id}
          className="text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
          onClick={() => onSelectTemplate(template.id)}
          aria-label={`Select ${template.name} template: ${template.description}`}
        >
          <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl">{template.icon}</div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{template.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
};

export { templates };