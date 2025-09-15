import React, { useState, useEffect } from 'react'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { useDatabase } from '@/hooks/useDatabase'
import { convertTableSchemaToAPIColumns, type APIColumn } from '@/lib/utils/postgresqlTypeMapping'

interface DynamicTableDocsProps {
  tableName: string
  codeLanguage: 'javascript' | 'bash'
  schema?: string
}

export default function DynamicTableDocs({ tableName, codeLanguage, schema = 'public' }: DynamicTableDocsProps) {
  const { getTableSchema, isConnected } = useDatabase()
  const [columns, setColumns] = useState<APIColumn[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load table schema
  useEffect(() => {
    const loadSchema = async () => {
      if (!isConnected || !tableName) {
        setColumns([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const dbColumns = await getTableSchema(tableName, schema)
        const apiColumns = convertTableSchemaToAPIColumns(dbColumns)
        setColumns(apiColumns)
      } catch (err) {
        console.error(`Failed to load schema for table ${tableName}:`, err)
        setError(err instanceof Error ? err.message : 'Failed to load table schema')
        setColumns([])
      } finally {
        setIsLoading(false)
      }
    }

    loadSchema()
  }, [tableName, schema, getTableSchema, isConnected])

  const getSelectExample = (columnName: string) => {
    if (codeLanguage === 'javascript') {
      return `let { data: ${tableName}, error } = await supabase
  .from('${tableName}')
  .select('${columnName}')`
    } else {
      return `curl -X GET 'https://your-project.supabase.co/rest/v1/${tableName}?select=${columnName}' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`
    }
  }

  const getReadAllExample = () => {
    if (codeLanguage === 'javascript') {
      return `let { data: ${tableName}, error } = await supabase
  .from('${tableName}')
  .select('*')`
    } else {
      return `curl -X GET 'https://your-project.supabase.co/rest/v1/${tableName}' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`
    }
  }

  const getFilteringExample = () => {
    if (codeLanguage === 'javascript') {
      return `let { data: ${tableName}, error } = await supabase
  .from('${tableName}')
  .select("*")

  // Filters
  .eq('column', 'Equal to')
  .gt('column', 'Greater than')
  .lt('column', 'Less than')
  .gte('column', 'Greater than or equal to')
  .lte('column', 'Less than or equal to')
  .like('column', '%CaseSensitive%')
  .ilike('column', '%CaseInsensitive%')
  .is('column', null)
  .in('column', ['Array', 'Values'])
  .neq('column', 'Not equal to')

  // Arrays
  .contains('array_column', ['array', 'contains'])
  .containedBy('array_column', ['contained', 'by'])

  // Logical operators
  .not('column', 'like', 'Negate filter')
  .or('some_column.eq.Some value, other_column.eq.Other value')`
    } else {
      return `# Filtering examples
curl -X GET 'https://your-project.supabase.co/rest/v1/${tableName}?column=eq.value' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"

curl -X GET 'https://your-project.supabase.co/rest/v1/${tableName}?column=gt.100' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`
    }
  }

  const getInsertExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { data, error } = await supabase
  .from('${tableName}')
  .insert([
    { some_column: 'someValue', other_column: 'otherValue' },
  ])
  .select()`
    } else {
      return `curl -X POST 'https://your-project.supabase.co/rest/v1/${tableName}' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-H "Prefer: return=representation" \\
-d '{"some_column":"someValue","other_column":"otherValue"}'`
    }
  }

  const getUpdateExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { data, error } = await supabase
  .from('${tableName}')
  .update({ other_column: 'otherValue' })
  .eq('some_column', 'someValue')
  .select()`
    } else {
      return `curl -X PATCH 'https://your-project.supabase.co/rest/v1/${tableName}?some_column=eq.someValue' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-H "Prefer: return=representation" \\
-d '{"other_column":"otherValue"}'`
    }
  }

  const getDeleteExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { error } = await supabase
  .from('${tableName}')
  .delete()
  .eq('some_column', 'someValue')`
    } else {
      return `curl -X DELETE 'https://your-project.supabase.co/rest/v1/${tableName}?some_column=eq.someValue' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`
    }
  }

  const getRealtimeExample = () => {
    if (codeLanguage === 'javascript') {
      return `const ${tableName} = supabase.channel('custom-all-channel')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: '${tableName}' },
    (payload) => {
      console.log('Change received!', payload)
    }
  )
  .subscribe()`
    } else {
      return `# WebSocket connection for real-time updates
# Use JavaScript client for real-time functionality`
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-8">
        <h1 className="text-3xl font-bold mb-6">{tableName}</h1>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl space-y-8">
        <h1 className="text-3xl font-bold mb-6">{tableName}</h1>
        <div className="text-red-600 bg-red-50 border border-red-200 rounded p-4">
          <h3 className="font-semibold mb-2">Error Loading Table Schema</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  // No columns found
  if (columns.length === 0) {
    return (
      <div className="max-w-4xl space-y-8">
        <h1 className="text-3xl font-bold mb-6">{tableName}</h1>
        <div className="text-muted-foreground bg-muted/50 border border-muted rounded p-4">
          <h3 className="font-semibold mb-2">No Columns Found</h3>
          <p>The table "{tableName}" does not exist or has no accessible columns.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-6">{tableName}</h1>

      {/* Columns Documentation */}
      <div className="space-y-6">
        {columns.map((column) => (
          <div key={column.name} className="border-l-4 border-muted pl-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold">COLUMN</h3>
              <Badge variant="outline">{column.name}</Badge>
              <Badge variant={column.required ? "destructive" : "secondary"}>
                {column.required ? "Required" : "Optional"}
              </Badge>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">TYPE:</span>
                <Badge variant="outline">{column.type}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">FORMAT:</span>
                <Badge variant="outline">{column.format}</Badge>
              </div>
              {column.description && (
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium">DESCRIPTION:</span>
                  <span className="text-sm text-muted-foreground">{column.description}</span>
                </div>
              )}
            </div>
            <div className="mb-3">
              <h4 className="text-sm font-semibold mb-2">SELECT {column.name.toUpperCase()}</h4>
              <Card className="p-3">
                <pre className="text-xs overflow-x-auto">
                  <code>{getSelectExample(column.name)}</code>
                </pre>
              </Card>
            </div>
          </div>
        ))}
      </div>

      {/* Read rows */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Read rows</h2>
        <p className="text-muted-foreground mb-4">
          To read rows in {tableName}, use the select method.
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">READ ALL ROWS</h3>
            <Card className="p-4">
              <pre className="text-sm overflow-x-auto">
                <code>{getReadAllExample()}</code>
              </pre>
            </Card>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">READ SPECIFIC COLUMNS</h3>
            <Card className="p-4">
              <pre className="text-sm overflow-x-auto">
                <code>{codeLanguage === 'javascript'
                  ? `let { data: ${tableName}, error } = await supabase
  .from('${tableName}')
  .select('some_column,other_column')`
                  : `curl -X GET 'https://your-project.supabase.co/rest/v1/${tableName}?select=some_column,other_column' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`}</code>
              </pre>
            </Card>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">WITH PAGINATION</h3>
            <Card className="p-4">
              <pre className="text-sm overflow-x-auto">
                <code>{codeLanguage === 'javascript'
                  ? `let { data: ${tableName}, error } = await supabase
  .from('${tableName}')
  .select('*')
  .range(0, 9)`
                  : `curl -X GET 'https://your-project.supabase.co/rest/v1/${tableName}?offset=0&limit=10' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`}</code>
              </pre>
            </Card>
          </div>
        </div>
      </div>

      {/* Filtering */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Filtering</h2>
        <p className="text-muted-foreground mb-4">
          Supabase provides a wide range of filters.
        </p>

        <div>
          <h3 className="text-lg font-semibold mb-2">WITH FILTERING</h3>
          <Card className="p-4">
            <pre className="text-sm overflow-x-auto">
              <code>{getFilteringExample()}</code>
            </pre>
          </Card>
        </div>
      </div>

      {/* Insert rows */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Insert rows</h2>
        <p className="text-muted-foreground mb-4">
          insert lets you insert into your tables. You can also insert in bulk and do UPSERT.
        </p>

        <div>
          <h3 className="text-lg font-semibold mb-2">INSERT A ROW</h3>
          <Card className="p-4">
            <pre className="text-sm overflow-x-auto">
              <code>{getInsertExample()}</code>
            </pre>
          </Card>
        </div>
      </div>

      {/* Update rows */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Update rows</h2>
        <p className="text-muted-foreground mb-4">
          update lets you update rows. update will match all rows by default. You can update specific rows using horizontal filters.
        </p>

        <div>
          <h3 className="text-lg font-semibold mb-2">UPDATE MATCHING ROWS</h3>
          <Card className="p-4">
            <pre className="text-sm overflow-x-auto">
              <code>{getUpdateExample()}</code>
            </pre>
          </Card>
        </div>
      </div>

      {/* Delete rows */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Delete rows</h2>
        <p className="text-muted-foreground mb-4">
          delete lets you delete rows. delete will match all rows by default, so remember to specify your filters!
        </p>

        <div>
          <h3 className="text-lg font-semibold mb-2">DELETE MATCHING ROWS</h3>
          <Card className="p-4">
            <pre className="text-sm overflow-x-auto">
              <code>{getDeleteExample()}</code>
            </pre>
          </Card>
        </div>
      </div>

      {/* Subscribe to changes */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Subscribe to changes</h2>
        <p className="text-muted-foreground mb-4">
          Supabase provides realtime functionality and broadcasts database changes to authorized users depending on Row Level Security (RLS) policies.
        </p>

        <div>
          <h3 className="text-lg font-semibold mb-2">SUBSCRIBE TO ALL EVENTS</h3>
          <Card className="p-4">
            <pre className="text-sm overflow-x-auto">
              <code>{getRealtimeExample()}</code>
            </pre>
          </Card>
        </div>
      </div>
    </div>
  )
}