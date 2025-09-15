import React from 'react'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'

interface GuidesProps {
  codeLanguage: 'javascript' | 'bash'
}

export default function Guides({ codeLanguage }: GuidesProps) {
  const getQuickStartExample = () => {
    if (codeLanguage === 'javascript') {
      return `// 1. Install the Supabase client
npm install @supabase/supabase-js

// 2. Initialize the client
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://your-project.supabase.co'
const supabaseKey = 'your-anon-key'
const supabase = createClient(supabaseUrl, supabaseKey)

// 3. Start using Supabase
const { data, error } = await supabase
  .from('products')
  .select('*')
  .limit(10)`
    } else {
      return `# 1. Set your project URL and API key
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_KEY="your-anon-key"

# 2. Test the connection
curl -X GET "$SUPABASE_URL/rest/v1/products?limit=10" \\
-H "apikey: $SUPABASE_KEY" \\
-H "Authorization: Bearer $SUPABASE_KEY"

# 3. Start building your application`
    }
  }

  const getAuthExample = () => {
    if (codeLanguage === 'javascript') {
      return `// Sign up a new user
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password'
})

// Sign in existing user
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') console.log('User signed in:', session.user)
  if (event === 'SIGNED_OUT') console.log('User signed out')
})`
    } else {
      return `# Sign up a new user
curl -X POST 'https://your-project.supabase.co/auth/v1/signup' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{"email": "user@example.com", "password": "secure-password"}'

# Sign in existing user
curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{"email": "user@example.com", "password": "secure-password"}'`
    }
  }

  const getRLSExample = () => {
    return `-- Enable RLS on the table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create a policy for authenticated users
CREATE POLICY "Users can view all products" ON products
FOR SELECT TO authenticated USING (true);

-- Create a policy for inserting products (admin only)
CREATE POLICY "Only admins can insert products" ON products
FOR INSERT TO authenticated
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create a policy for user-specific data
CREATE POLICY "Users can only see their own orders" ON orders
FOR ALL TO authenticated USING (user_id = auth.uid());`
  }

  const getRealtimeExample = () => {
    if (codeLanguage === 'javascript') {
      return `// Subscribe to all changes on the products table
const channel = supabase
  .channel('products-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'products' },
    (payload) => {
      console.log('Change received!', payload)
      // Handle the change in your UI
      if (payload.eventType === 'INSERT') {
        console.log('New product added:', payload.new)
      } else if (payload.eventType === 'UPDATE') {
        console.log('Product updated:', payload.new)
      } else if (payload.eventType === 'DELETE') {
        console.log('Product deleted:', payload.old)
      }
    }
  )
  .subscribe()

// Unsubscribe when component unmounts
return () => {
  supabase.removeChannel(channel)
}`
    } else {
      return `# Real-time subscriptions require WebSocket connections
# Use the JavaScript client for real-time functionality
# Example: Subscribe to database changes and broadcast updates`
    }
  }

  const getFileUploadExample = () => {
    if (codeLanguage === 'javascript') {
      return `// Upload a file to storage
const { data, error } = await supabase.storage
  .from('avatars')
  .upload('user-avatar.png', file)

// Get public URL for uploaded file
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl('user-avatar.png')

// Download a file
const { data, error } = await supabase.storage
  .from('avatars')
  .download('user-avatar.png')

// List files in a bucket
const { data, error } = await supabase.storage
  .from('avatars')
  .list('folder/', {
    limit: 100,
    offset: 0
  })`
    } else {
      return `# Upload a file
curl -X POST 'https://your-project.supabase.co/storage/v1/object/avatars/user-avatar.png' \\
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
-H "Content-Type: image/png" \\
--data-binary @avatar.png

# Download a file
curl -X GET 'https://your-project.supabase.co/storage/v1/object/avatars/user-avatar.png' \\
-H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# List files
curl -X POST 'https://your-project.supabase.co/storage/v1/object/list/avatars' \\
-H "Authorization: Bearer YOUR_ACCESS_TOKEN"`
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-6">Guides</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-6">
          Learn how to build applications with Supabase through step-by-step guides and best practices.
        </p>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">What You'll Learn</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• How to set up and configure your Supabase project</li>
            <li>• Authentication and user management best practices</li>
            <li>• Database design and Row Level Security (RLS)</li>
            <li>• Real-time features and file storage</li>
            <li>• Performance optimization and deployment</li>
          </ul>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
        <p className="text-muted-foreground mb-4">
          Get up and running with Supabase in minutes. This guide covers installation, setup, and your first API call.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">GETTING STARTED</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getQuickStartExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Authentication Guide */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Authentication Guide</h2>
        <p className="text-muted-foreground mb-4">
          Implement secure user authentication with sign up, sign in, and session management.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">USER AUTHENTICATION</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getAuthExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Row Level Security */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Row Level Security (RLS)</h2>
        <p className="text-muted-foreground mb-4">
          Secure your data with PostgreSQL's Row Level Security. Control who can access what data at the database level.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">RLS POLICIES</h3>
          <Badge variant="outline" className="text-xs">SQL</Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getRLSExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Real-time Guide */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Real-time Subscriptions</h2>
        <p className="text-muted-foreground mb-4">
          Subscribe to database changes and build real-time applications with live updates.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">REAL-TIME SUBSCRIPTIONS</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getRealtimeExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Storage Guide */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">File Storage</h2>
        <p className="text-muted-foreground mb-4">
          Upload, download, and manage files with Supabase Storage. Perfect for user avatars, documents, and media.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">FILE OPERATIONS</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getFileUploadExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Best Practices */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Best Practices</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Database Design</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Design your database schema with performance and security in mind.
            </p>
            <ul className="text-xs space-y-1">
              <li>• Use proper indexes for frequently queried columns</li>
              <li>• Implement foreign key relationships</li>
              <li>• Enable RLS on all public tables</li>
              <li>• Use UUIDs for primary keys</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Security</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Protect your application and user data with proper security measures.
            </p>
            <ul className="text-xs space-y-1">
              <li>• Never expose your service_role key client-side</li>
              <li>• Validate all user inputs</li>
              <li>• Use HTTPS for all API calls</li>
              <li>• Implement proper error handling</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Performance</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Optimize your application for speed and scalability.
            </p>
            <ul className="text-xs space-y-1">
              <li>• Select only the columns you need</li>
              <li>• Use pagination for large datasets</li>
              <li>• Implement client-side caching</li>
              <li>• Monitor query performance</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Development</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Follow development best practices for maintainable code.
            </p>
            <ul className="text-xs space-y-1">
              <li>• Use TypeScript for type safety</li>
              <li>• Handle errors gracefully</li>
              <li>• Test your RLS policies thoroughly</li>
              <li>• Keep your schema migrations version controlled</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Next Steps</h3>
        <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
          <li>• Explore the API documentation for detailed endpoint information</li>
          <li>• Set up your database schema and enable Row Level Security</li>
          <li>• Implement authentication in your application</li>
          <li>• Add real-time features for live updates</li>
          <li>• Deploy your application and monitor performance</li>
        </ul>
      </div>
    </div>
  )
}