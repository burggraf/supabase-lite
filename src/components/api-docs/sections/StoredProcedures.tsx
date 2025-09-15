import React from 'react'
import { APISection } from '../../../pages/APIDocs'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'

interface StoredProceduresProps {
  activeSection: APISection
  codeLanguage: 'javascript' | 'bash'
}

export default function StoredProcedures({ activeSection, codeLanguage }: StoredProceduresProps) {
  const renderIntroduction = () => (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-6">Stored Procedures</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-6">
          Stored procedures (PostgreSQL functions) are exposed as REST endpoints in Supabase.
          They can be called directly via the API for complex database operations and business logic.
        </p>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Function Features</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• PostgreSQL functions are automatically exposed as RPC endpoints</li>
            <li>• Support for complex parameters and return types</li>
            <li>• Can perform operations across multiple tables</li>
            <li>• Row Level Security (RLS) policies are enforced</li>
          </ul>
        </div>
      </div>

      {/* Available Functions */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Available Functions</h2>
        <p className="text-muted-foreground mb-6">
          The following stored procedures are available in your database. Click on any function name in the sidebar to see detailed documentation.
        </p>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">get_category_summary</h3>
              <Badge variant="outline">Function</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Returns a summary of products grouped by category with counts and averages.
            </p>
            <div className="text-xs text-muted-foreground">
              <strong>Returns:</strong> category, product_count, avg_price
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">get_product_stats</h3>
              <Badge variant="outline">Function</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Provides comprehensive statistics about products including pricing and order metrics.
            </p>
            <div className="text-xs text-muted-foreground">
              <strong>Returns:</strong> total_products, avg_price, min_price, max_price, total_orders
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">get_products_by_category</h3>
              <Badge variant="outline">Function</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Filters products by category with optional price range filtering.
            </p>
            <div className="text-xs text-muted-foreground">
              <strong>Parameters:</strong> category_name (text), min_price (numeric), max_price (numeric)
            </div>
          </Card>
        </div>
      </div>

      {/* Basic Usage */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Basic Usage</h2>
        <p className="text-muted-foreground mb-4">
          Call stored procedures using the RPC (Remote Procedure Call) method.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">CALLING A FUNCTION</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{codeLanguage === 'javascript'
              ? `const { data, error } = await supabase
  .rpc('function_name', {
    param1: 'value1',
    param2: 'value2'
  })`
              : `curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/function_name' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "param1": "value1",
  "param2": "value2"
}'`}</code>
          </pre>
        </Card>
      </div>
    </div>
  )

  const renderProcedure = (name: string, description: string, parameters: string[], returns: string, example: any) => (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-6">{name}</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-6">{description}</p>
      </div>

      {/* Parameters */}
      {parameters.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Parameters</h2>
          <div className="space-y-2">
            {parameters.map((param, index) => (
              <Card key={index} className="p-3">
                <code className="text-sm">{param}</code>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Returns */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Returns</h2>
        <Card className="p-3">
          <code className="text-sm">{returns}</code>
        </Card>
      </div>

      {/* Example */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Example</h2>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">CALL {name.toUpperCase()}</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{codeLanguage === 'javascript' ? example.javascript : example.bash}</code>
          </pre>
        </Card>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'procedures-intro':
        return renderIntroduction()

      case 'procedure-get_category_summary':
        return renderProcedure(
          'get_category_summary',
          'Returns a summary of products grouped by category, including product counts and average prices.',
          [],
          'TABLE(category text, product_count bigint, avg_price numeric)',
          {
            javascript: `const { data, error } = await supabase
  .rpc('get_category_summary')

// Example response:
// [
//   { category: "Electronics", product_count: 15, avg_price: 299.99 },
//   { category: "Books", product_count: 8, avg_price: 24.50 }
// ]`,
            bash: `curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/get_category_summary' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{}'`
          }
        )

      case 'procedure-get_product_stats':
        return renderProcedure(
          'get_product_stats',
          'Provides comprehensive statistics about all products including pricing metrics and order counts.',
          [],
          'TABLE(total_products bigint, avg_price numeric, min_price numeric, max_price numeric, total_orders bigint)',
          {
            javascript: `const { data, error } = await supabase
  .rpc('get_product_stats')

// Example response:
// [{
//   total_products: 23,
//   avg_price: 156.78,
//   min_price: 9.99,
//   max_price: 999.99,
//   total_orders: 127
// }]`,
            bash: `curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/get_product_stats' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{}'`
          }
        )

      case 'procedure-get_products_by_category':
        return renderProcedure(
          'get_products_by_category',
          'Filters products by category with optional price range constraints.',
          [
            'category_name text - The category to filter by',
            'min_price numeric DEFAULT 0 - Minimum price filter (optional)',
            'max_price numeric DEFAULT NULL - Maximum price filter (optional)'
          ],
          'TABLE(id integer, name text, price numeric, category text, created_at timestamp)',
          {
            javascript: `const { data, error } = await supabase
  .rpc('get_products_by_category', {
    category_name: 'Electronics',
    min_price: 100,
    max_price: 500
  })

// Example response:
// [
//   { id: 1, name: "Laptop", price: 299.99, category: "Electronics", created_at: "..." },
//   { id: 2, name: "Phone", price: 199.99, category: "Electronics", created_at: "..." }
// ]`,
            bash: `curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/get_products_by_category' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "category_name": "Electronics",
  "min_price": 100,
  "max_price": 500
}'`
          }
        )

      default:
        return renderIntroduction()
    }
  }

  return renderContent()
}