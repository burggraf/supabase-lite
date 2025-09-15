import React from 'react'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'

interface IntroductionProps {
  codeLanguage: 'javascript' | 'bash'
}

export default function Introduction({ codeLanguage }: IntroductionProps) {
  const jsCode = `import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://your-project.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)`

  const bashCode = `curl -X GET 'https://your-project.supabase.co/rest/v1/your-table' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer YOUR_SUPABASE_KEY"`

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Connect to your project</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-8">
          All projects have a RESTful endpoint that you can use with your project's API key to query and manage your database.
          These can be obtained from the <span className="text-primary underline">API settings</span>.
        </p>

        <p className="mb-8">
          You can initialize a new Supabase client using the <code className="text-sm bg-muted px-1 py-0.5 rounded">createClient()</code> method.
          The Supabase client is your entrypoint to the rest of the Supabase functionality and is the easiest way to interact with
          everything we offer within the Supabase ecosystem.
        </p>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold">Initializing</h2>
            <Badge variant="outline" className="text-xs">
              {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
            </Badge>
          </div>

          <Card className="p-4">
            <pre className="text-sm overflow-x-auto">
              <code className={codeLanguage === 'javascript' ? 'language-javascript' : 'language-bash'}>
                {codeLanguage === 'javascript' ? jsCode : bashCode}
              </code>
            </pre>
          </Card>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Quick Start Tips</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Store your API keys as environment variables</li>
            <li>• Use the anon key for client-side applications</li>
            <li>• Use the service_role key only on secure servers</li>
            <li>• All API requests require proper authentication headers</li>
          </ul>
        </div>
      </div>
    </div>
  )
}