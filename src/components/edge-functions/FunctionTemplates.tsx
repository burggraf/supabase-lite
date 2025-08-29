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
];

export const FunctionTemplates: React.FC<FunctionTemplatesProps> = ({
  onSelectTemplate,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <Card
          key={template.id}
          className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200"
          onClick={() => onSelectTemplate(template.id)}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="text-2xl">{template.icon}</div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">{template.name}</h3>
            <p className="text-sm text-gray-600">{template.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export { templates };