import React from 'react'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'

interface TablesIntroProps {
  codeLanguage: 'javascript' | 'bash'
}

export default function TablesIntro({ codeLanguage }: TablesIntroProps) {
  const getBasicSelectExample = () => {
    if (codeLanguage === 'javascript') {
      return `// Select all columns from a table
let { data, error } = await supabase
  .from('table_name')
  .select('*')

// Select specific columns
let { data, error } = await supabase
  .from('table_name')
  .select('column1, column2, column3')`
    } else {
      return `# Select all columns from a table
curl -X GET 'https://your-project.supabase.co/rest/v1/table_name' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"

# Select specific columns
curl -X GET 'https://your-project.supabase.co/rest/v1/table_name?select=column1,column2,column3' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`
    }
  }

  const getFilteringExample = () => {
    if (codeLanguage === 'javascript') {
      return `// Filter rows with WHERE conditions
let { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', 'value')
  .gt('price', 100)
  .order('created_at', { ascending: false })
  .limit(10)`
    } else {
      return `# Filter rows with query parameters
curl -X GET 'https://your-project.supabase.co/rest/v1/table_name?column=eq.value&price=gt.100&order=created_at.desc&limit=10' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`
    }
  }

  const getJoinExample = () => {
    if (codeLanguage === 'javascript') {
      return `// Join tables with foreign key relationships
let { data, error } = await supabase
  .from('orders')
  .select(\`
    id,
    quantity,
    products (
      name,
      price
    ),
    users (
      email,
      name
    )
  \`)`
    } else {
      return `# Join tables using embedded resources
curl -X GET 'https://your-project.supabase.co/rest/v1/orders?select=id,quantity,products(name,price),users(email,name)' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-6">Tables and Views</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-6">
          Supabase auto-generates RESTful APIs for all your database tables and views.
          Each table becomes a REST endpoint that supports full CRUD operations with powerful querying capabilities.
        </p>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Auto-Generated APIs</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Every table automatically gets REST endpoints</li>
            <li>• Views are treated as read-only tables</li>
            <li>• Foreign key relationships enable automatic joins</li>
            <li>• Row Level Security (RLS) policies are automatically enforced</li>
          </ul>
        </div>
      </div>

      {/* Available Tables */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Available Tables</h2>
        <p className="text-muted-foreground mb-6">
          The following tables are available in your database. Click on any table name in the sidebar to see detailed API documentation.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">orders</h3>
              <Badge variant="outline">Table</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Order management with user associations and product references.
            </p>
            <div className="text-xs text-muted-foreground">
              <strong>Columns:</strong> id, user_id, product_id, quantity, status, created_at, items, order_date
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">products</h3>
              <Badge variant="outline">Table</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Product catalog with pricing and categorization.
            </p>
            <div className="text-xs text-muted-foreground">
              <strong>Columns:</strong> id, name, price, category, created_at
            </div>
          </Card>
        </div>
      </div>

      {/* Basic Operations */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Basic Operations</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Reading Data</h3>
            <p className="text-muted-foreground mb-3">
              Use the select method to read data from your tables. You can select all columns with * or specify individual columns.
            </p>
            <Card className="p-4">
              <pre className="text-sm overflow-x-auto">
                <code>{getBasicSelectExample()}</code>
              </pre>
            </Card>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Filtering and Ordering</h3>
            <p className="text-muted-foreground mb-3">
              Apply filters, sorting, and pagination to your queries for precise data retrieval.
            </p>
            <Card className="p-4">
              <pre className="text-sm overflow-x-auto">
                <code>{getFilteringExample()}</code>
              </pre>
            </Card>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Joining Tables</h3>
            <p className="text-muted-foreground mb-3">
              Fetch related data from multiple tables using foreign key relationships.
            </p>
            <Card className="p-4">
              <pre className="text-sm overflow-x-auto">
                <code>{getJoinExample()}</code>
              </pre>
            </Card>
          </div>
        </div>
      </div>

      {/* Common Patterns */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Common Query Patterns</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Pagination</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Use range() for offset-based pagination or cursor-based pagination for better performance.
            </p>
            <div className="text-xs">
              <code className="bg-muted px-1 py-0.5 rounded">
                .range(0, 9) // First 10 rows
              </code>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Full-Text Search</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Search across text columns using PostgreSQL's full-text search capabilities.
            </p>
            <div className="text-xs">
              <code className="bg-muted px-1 py-0.5 rounded">
                .textSearch('title', 'keyword')
              </code>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Aggregation</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Use database functions for counting, summing, and other aggregations.
            </p>
            <div className="text-xs">
              <code className="bg-muted px-1 py-0.5 rounded">
                .select('*, count(*)')
              </code>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Real-time</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Subscribe to real-time changes on any table for live updates.
            </p>
            <div className="text-xs">
              <code className="bg-muted px-1 py-0.5 rounded">
                .on('postgres_changes', ...)
              </code>
            </div>
          </Card>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Performance Tips</h3>
        <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
          <li>• Select only the columns you need instead of using *</li>
          <li>• Use database indexes for frequently filtered columns</li>
          <li>• Implement pagination for large result sets</li>
          <li>• Use RLS policies to automatically filter data at the database level</li>
        </ul>
      </div>
    </div>
  )
}