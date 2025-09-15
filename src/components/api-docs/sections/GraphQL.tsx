import React from 'react'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'

interface GraphQLProps {
  codeLanguage: 'javascript' | 'bash'
}

export default function GraphQL({ codeLanguage }: GraphQLProps) {
  const getQueryExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { data, error } = await supabase
  .from('products')
  .select(\`
    id,
    name,
    price,
    category
  \`)
  .eq('category', 'Electronics')
  .limit(10)`
    } else {
      return `curl -X POST 'https://your-project.supabase.co/graphql/v1' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "query": "query { products(filter: {category: {eq: \\"Electronics\\"}}, first: 10) { id name price category } }"
}'`
    }
  }

  const getMutationExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { data, error } = await supabase
  .from('products')
  .insert([
    {
      name: 'New Product',
      price: 99.99,
      category: 'Electronics'
    }
  ])
  .select()`
    } else {
      return `curl -X POST 'https://your-project.supabase.co/graphql/v1' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "query": "mutation { insertProducts(objects: [{name: \\"New Product\\", price: 99.99, category: \\"Electronics\\"}]) { returning { id name price category } } }"
}'`
    }
  }

  const getSubscriptionExample = () => {
    if (codeLanguage === 'javascript') {
      return `const subscription = supabase
  .channel('products-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'products'
    },
    (payload) => {
      console.log('Change received!', payload)
    }
  )
  .subscribe()`
    } else {
      return `# WebSocket subscription for real-time updates
# Use JavaScript client for real-time functionality
# GraphQL subscriptions require WebSocket connection`
    }
  }

  const getGraphiQLExample = () => {
    return `# Navigate to GraphiQL playground
https://your-project.supabase.co/graphql/v1

# Example query to try in GraphiQL:
query GetProducts {
  products(first: 10, filter: { category: { eq: "Electronics" } }) {
    id
    name
    price
    category
    created_at
  }
}

# Example mutation:
mutation CreateProduct {
  insertProducts(objects: [{
    name: "New Laptop"
    price: 1299.99
    category: "Electronics"
  }]) {
    returning {
      id
      name
      price
      category
    }
  }
}`
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-6">GraphQL</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-6">
          Supabase provides a GraphQL API that auto-generates from your database schema.
          Use GraphQL for flexible queries, mutations, and real-time subscriptions.
        </p>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">GraphQL Features</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Auto-generated schema from your database tables</li>
            <li>• Type-safe queries with built-in validation</li>
            <li>• Flexible data fetching with nested relationships</li>
            <li>• Real-time subscriptions for live data updates</li>
            <li>• GraphiQL playground for interactive query building</li>
          </ul>
        </div>
      </div>

      {/* GraphQL Endpoint */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">GraphQL Endpoint</h2>
        <p className="text-muted-foreground mb-4">
          Your GraphQL API is available at the following endpoint:
        </p>
        <Card className="p-4">
          <code className="text-sm">https://your-project.supabase.co/graphql/v1</code>
        </Card>
      </div>

      {/* Queries */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Queries</h2>
        <p className="text-muted-foreground mb-4">
          Use GraphQL queries to fetch data from your database with precise field selection.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">GRAPHQL QUERY</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getQueryExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Mutations */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Mutations</h2>
        <p className="text-muted-foreground mb-4">
          Use GraphQL mutations to create, update, or delete data in your database.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">GRAPHQL MUTATION</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getMutationExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Subscriptions */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Subscriptions</h2>
        <p className="text-muted-foreground mb-4">
          Subscribe to real-time changes in your database using GraphQL subscriptions.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">REAL-TIME SUBSCRIPTION</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getSubscriptionExample()}</code>
          </pre>
        </Card>
      </div>

      {/* GraphiQL Playground */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">GraphiQL Playground</h2>
        <p className="text-muted-foreground mb-4">
          Use the interactive GraphiQL playground to explore your schema and test queries.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">GRAPHIQL PLAYGROUND</h3>
          <Badge variant="outline" className="text-xs">GraphQL</Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getGraphiQLExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Schema Features */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Schema Features</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Auto-Generated Types</h3>
            <p className="text-sm text-muted-foreground mb-3">
              GraphQL types are automatically generated from your database schema.
            </p>
            <div className="text-xs">
              <code className="bg-muted px-1 py-0.5 rounded">
                type Product &#123; id: Int! name: String &#125;
              </code>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Nested Relationships</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Query related data in a single request using foreign key relationships.
            </p>
            <div className="text-xs">
              <code className="bg-muted px-1 py-0.5 rounded">
                orders &#123; id user &#123; email &#125; &#125;
              </code>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Filtering & Sorting</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Advanced filtering and sorting options built into the schema.
            </p>
            <div className="text-xs">
              <code className="bg-muted px-1 py-0.5 rounded">
                filter: &#123; price: &#123; gt: 100 &#125; &#125;
              </code>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Pagination</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Built-in pagination with first, last, before, and after arguments.
            </p>
            <div className="text-xs">
              <code className="bg-muted px-1 py-0.5 rounded">
                products(first: 10, after: "cursor")
              </code>
            </div>
          </Card>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">GraphQL Best Practices</h3>
        <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
          <li>• Request only the fields you need to minimize data transfer</li>
          <li>• Use aliases to avoid naming conflicts in complex queries</li>
          <li>• Implement proper error handling for mutations</li>
          <li>• Use fragments to reuse common field selections</li>
          <li>• Test queries in GraphiQL before implementing in your application</li>
        </ul>
      </div>
    </div>
  )
}