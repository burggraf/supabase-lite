import React, { useState, useEffect } from 'react'
import { APISection } from '../../../pages/APIDocs'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { useDatabase } from '@/hooks/useDatabase'
import { useDynamicFunctions } from '@/hooks/useDynamicFunctions'
import { parseArgumentTypes, type FunctionDetails } from '@/lib/utils/functionDiscovery'

interface DynamicStoredProceduresProps {
  activeSection: APISection
  codeLanguage: 'javascript' | 'bash'
}

export default function DynamicStoredProcedures({ activeSection, codeLanguage }: DynamicStoredProceduresProps) {
  const { getFunctionDetails, isConnected } = useDatabase()
  const { functions } = useDynamicFunctions('public')
  const [functionDetails, setFunctionDetails] = useState<FunctionDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extract function name from activeSection if it's a specific function
  const getFunctionName = (section: APISection): string | null => {
    if (typeof section === 'string' && section.startsWith('function-')) {
      return section.replace('function-', '')
    }
    return null
  }

  const currentFunctionName = getFunctionName(activeSection)

  // Load function details when activeSection changes
  useEffect(() => {
    if (currentFunctionName && isConnected) {
      const loadDetails = async () => {
        setIsLoading(true)
        setError(null)

        try {
          const details = await getFunctionDetails(currentFunctionName, 'public')
          setFunctionDetails(details)
        } catch (err) {
          console.error(`Failed to load details for function ${currentFunctionName}:`, err)
          setError(err instanceof Error ? err.message : 'Failed to load function details')
          setFunctionDetails(null)
        } finally {
          setIsLoading(false)
        }
      }

      loadDetails()
    } else {
      setFunctionDetails(null)
    }
  }, [currentFunctionName, getFunctionDetails, isConnected])

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

        {functions.length === 0 ? (
          <Card className="p-6">
            <div className="text-center text-muted-foreground">
              <h3 className="font-semibold mb-2">No Functions Found</h3>
              <p className="text-sm">No stored procedures are currently available in the public schema.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {functions.slice(0, 5).map((func) => {
              const args = parseArgumentTypes(func.argument_types)

              return (
                <Card key={func.name} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{func.name}</h3>
                    <Badge variant="outline">Function</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {func.description}
                  </p>
                  {args.length > 0 && (
                    <div className="text-xs text-muted-foreground mb-2">
                      <strong>Parameters:</strong> {args.map(arg =>
                        `${arg.name || 'unnamed'} (${arg.type})`
                      ).join(', ')}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    <strong>Returns:</strong> {func.return_type}
                  </div>
                </Card>
              )
            })}

            {functions.length > 5 && (
              <Card className="p-4 border-dashed">
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">
                    And {functions.length - 5} more function{functions.length - 5 !== 1 ? 's' : ''}...
                    Check the sidebar to view all functions.
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}
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

  const renderFunction = (details: FunctionDetails) => {
    const args = parseArgumentTypes(details.argument_types)
    const hasParameters = args.length > 0

    // Generate example parameters based on argument types
    const generateExampleParams = () => {
      const examples: Record<string, any> = {}
      args.forEach(arg => {
        if (arg.name) {
          const type = arg.type.toLowerCase()
          if (type.includes('text') || type.includes('varchar') || type.includes('char')) {
            examples[arg.name] = arg.name.includes('category') ? 'Electronics' : 'example_value'
          } else if (type.includes('numeric') || type.includes('decimal') || type.includes('float') || type.includes('real')) {
            examples[arg.name] = arg.name.includes('price') ? 100 : 42
          } else if (type.includes('int')) {
            examples[arg.name] = arg.name.includes('id') ? 1 : 10
          } else if (type.includes('bool')) {
            examples[arg.name] = true
          } else {
            examples[arg.name] = 'value'
          }
        }
      })
      return examples
    }

    const exampleParams = generateExampleParams()

    const getJavaScriptExample = () => {
      if (hasParameters) {
        return `const { data, error } = await supabase
  .rpc('${details.name}', ${JSON.stringify(exampleParams, null, 2).replace(/\n/g, '\n  ')})

// Example response based on return type:
// ${details.return_type.startsWith('TABLE') ? '[\n//   { /* row data */ }\n// ]' : '// Single value or object'}`
      } else {
        return `const { data, error } = await supabase
  .rpc('${details.name}')

// Example response based on return type:
// ${details.return_type.startsWith('TABLE') ? '[\n//   { /* row data */ }\n// ]' : '// Single value or object'}`
      }
    }

    const getBashExample = () => {
      const dataPayload = hasParameters ? JSON.stringify(exampleParams) : '{}'

      return `curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/${details.name}' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '${dataPayload}'`
    }

    return (
      <div className="max-w-4xl space-y-8">
        <h1 className="text-3xl font-bold mb-6">{details.name}</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-lg text-muted-foreground mb-6">
            {details.description || `Database function: ${details.name}`}
          </p>
        </div>

        {/* Parameters */}
        {hasParameters && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Parameters</h2>
            <div className="space-y-2">
              {args.map((arg, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-semibold">{arg.name || `param${index + 1}`}</code>
                    <Badge variant="outline" className="text-xs">{arg.type}</Badge>
                    {arg.hasDefault && <Badge variant="secondary" className="text-xs">Optional</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {arg.hasDefault ? 'Optional parameter with default value' : 'Required parameter'}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Returns */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Returns</h2>
          <Card className="p-3">
            <code className="text-sm">{details.return_type}</code>
          </Card>
        </div>

        {/* Example */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Example</h2>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold">CALL {details.name.toUpperCase()}</h3>
            <Badge variant="outline" className="text-xs">
              {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
            </Badge>
          </div>
          <Card className="p-4">
            <pre className="text-sm overflow-x-auto">
              <code>{codeLanguage === 'javascript' ? getJavaScriptExample() : getBashExample()}</code>
            </pre>
          </Card>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    if (activeSection === 'procedures-intro') {
      return renderIntroduction()
    }

    if (currentFunctionName) {
      if (isLoading) {
        return (
          <div className="max-w-4xl space-y-8">
            <h1 className="text-3xl font-bold mb-6">{currentFunctionName}</h1>
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          </div>
        )
      }

      if (error) {
        return (
          <div className="max-w-4xl space-y-8">
            <h1 className="text-3xl font-bold mb-6">{currentFunctionName}</h1>
            <div className="text-red-600 bg-red-50 border border-red-200 rounded p-4">
              <h3 className="font-semibold mb-2">Error Loading Function Details</h3>
              <p>{error}</p>
            </div>
          </div>
        )
      }

      if (!functionDetails) {
        return (
          <div className="max-w-4xl space-y-8">
            <h1 className="text-3xl font-bold mb-6">{currentFunctionName}</h1>
            <div className="text-muted-foreground bg-muted/50 border border-muted rounded p-4">
              <h3 className="font-semibold mb-2">Function Not Found</h3>
              <p>The function "{currentFunctionName}" does not exist or is not accessible.</p>
            </div>
          </div>
        )
      }

      return renderFunction(functionDetails)
    }

    // Default fallback
    return renderIntroduction()
  }

  return renderContent()
}