import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  try {
    // Get request body if it exists
    let requestBody = null;
    try {
      requestBody = await req.json();
    } catch {
      // No body or invalid JSON
    }

    // Extract name from request body
    const name = requestBody?.name || 'World';

    // Create response data
    const data = {
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString(),
      method: req.method,
      received: requestBody
    };
    
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});