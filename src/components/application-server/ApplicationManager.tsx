import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApplicationServer } from '@/hooks/useApplicationServer'

export function ApplicationManager() {
  const { state } = useApplicationServer()
  const installed = state.packages.filter((pkg) => pkg.status === 'installed')

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Application deployment coming soon</AlertTitle>
        <AlertDescription>
          The MVP focuses on preparing the runtime environment. Once nginx and Node.js runtimes are
          stable, we will enable application deployment, lifecycle management, and routing.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Installed runtimes</CardTitle>
        </CardHeader>
        <CardContent>
          {installed.length ? (
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {installed.map((pkg) => (
                <li key={pkg.id}>
                  <span className="font-medium">{pkg.name}</span> — {pkg.version}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Install the nginx and Node.js runtimes to prepare for app deployment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
