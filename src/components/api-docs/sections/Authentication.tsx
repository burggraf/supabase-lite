import React from 'react'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Alert, AlertDescription } from '../../ui/alert'
import { AlertTriangle } from 'lucide-react'

interface AuthenticationProps {
  codeLanguage: 'javascript' | 'bash'
}

export default function Authentication({ codeLanguage }: AuthenticationProps) {
  const clientKeyJs = `const SUPABASE_KEY = 'SUPABASE_CLIENT_API_KEY'`
  const clientUsageJs = `const SUPABASE_URL = "https://your-project.supabase.co"
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_KEY);`

  const serviceKeyJs = `const SERVICE_KEY = 'SUPABASE_SERVICE_KEY'`
  const serviceUsageJs = `const SUPABASE_URL = "https://your-project.supabase.co"
const supabase = createClient(SUPABASE_URL, process.env.SERVICE_KEY);`

  const clientKeyBash = `SUPABASE_KEY="SUPABASE_CLIENT_API_KEY"`
  const clientUsageBash = `curl -X GET 'https://your-project.supabase.co/rest/v1/your-table' \\
-H "apikey: $SUPABASE_KEY" \\
-H "Authorization: Bearer $SUPABASE_KEY"`

  const serviceKeyBash = `SERVICE_KEY="SUPABASE_SERVICE_KEY"`
  const serviceUsageBash = `curl -X GET 'https://your-project.supabase.co/rest/v1/your-table' \\
-H "apikey: $SERVICE_KEY" \\
-H "Authorization: Bearer $SERVICE_KEY"`

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Authentication</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-6">
          Supabase works through a mixture of JWT and Key auth.
        </p>

        <p className="mb-4">
          If no Authorization header is included, the API will assume that you are making a request with an anonymous user.
        </p>

        <p className="mb-6">
          If an Authorization header is included, the API will "switch" to the role of the user making the request.
          See the User Management section for more details.
        </p>

        <p className="mb-8 font-medium">
          We recommend setting your keys as Environment Variables.
        </p>

        {/* Client API Keys Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Client API Keys</h2>

          <p className="mb-4">
            Client keys allow "anonymous access" to your database, until the user has logged in.
            After logging in the keys will switch to the user's own login token.
          </p>

          <p className="mb-4">
            In this documentation, we will refer to the key using the name SUPABASE_KEY.
          </p>

          <p className="mb-6">
            We have provided you a Client Key to get started. You will soon be able to add as many keys as you like.
            You can find the anon key in the API Settings page.
          </p>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold">CLIENT API KEY</h3>
                <Badge variant="outline" className="text-xs">
                  {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
                </Badge>
              </div>
              <Card className="p-4">
                <pre className="text-sm overflow-x-auto">
                  <code>
                    {codeLanguage === 'javascript' ? clientKeyJs : clientKeyBash}
                  </code>
                </pre>
              </Card>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold">EXAMPLE USAGE</h3>
                <Badge variant="outline" className="text-xs">
                  {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
                </Badge>
              </div>
              <Card className="p-4">
                <pre className="text-sm overflow-x-auto">
                  <code>
                    {codeLanguage === 'javascript' ? clientUsageJs : clientUsageBash}
                  </code>
                </pre>
              </Card>
            </div>
          </div>
        </div>

        {/* Service Keys Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Service Keys</h2>

          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Service keys have FULL access to your data</strong>, bypassing any security policies.
              Be VERY careful where you expose these keys. They should only be used on a server and never on a client or browser.
            </AlertDescription>
          </Alert>

          <p className="mb-4">
            In this documentation, we will refer to the key using the name SERVICE_KEY.
          </p>

          <p className="mb-6">
            We have provided you with a Service Key to get started. Soon you will be able to add as many keys as you like.
            You can find the service_role in the API Settings page.
          </p>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold">SERVICE KEY</h3>
                <Badge variant="outline" className="text-xs">
                  {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
                </Badge>
              </div>
              <Card className="p-4">
                <pre className="text-sm overflow-x-auto">
                  <code>
                    {codeLanguage === 'javascript' ? serviceKeyJs : serviceKeyBash}
                  </code>
                </pre>
              </Card>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold">EXAMPLE USAGE</h3>
                <Badge variant="outline" className="text-xs">
                  {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
                </Badge>
              </div>
              <Card className="p-4">
                <pre className="text-sm overflow-x-auto">
                  <code>
                    {codeLanguage === 'javascript' ? serviceUsageJs : serviceUsageBash}
                  </code>
                </pre>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}