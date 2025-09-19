import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApplicationServer } from '@/hooks/useApplicationServer'
import { Loader2 } from 'lucide-react'

const categoryLabels: Record<string, string> = {
  'web-server': 'Web Server',
  runtime: 'Runtime',
  framework: 'Framework',
  tool: 'Tool',
}

export function RuntimeBrowser() {
  const { state, installRuntime, removeRuntime, refreshCatalog } = useApplicationServer()
  const { packages, isBusy, manifestError, isLoading } = state

  const handleRefresh = () => refreshCatalog().catch((error) => {
    console.error('[ApplicationServer] Failed to refresh runtime manifest', error)
  })

  return (
    <div className="space-y-4">
      {manifestError && (
        <Alert variant="destructive" className="flex flex-col gap-3">
          <div>
            <AlertTitle>Runtime catalog unavailable</AlertTitle>
            <AlertDescription>{manifestError}</AlertDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={isLoading} onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={isLoading} onClick={handleRefresh}>
          Refresh catalog
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading runtime catalog…
        </div>
      )}

      {packages.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{pkg.name}</CardTitle>
                  <Badge variant={pkg.status === 'installed' ? 'default' : 'secondary'}>
                    {pkg.status}
                  </Badge>
                </div>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Category</span>
                    <span className="font-medium text-foreground">{categoryLabels[pkg.category]}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Version</span>
                    <span className="font-medium text-foreground">{pkg.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Size</span>
                    <span className="font-medium text-foreground">{pkg.size} MB</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {pkg.status === 'installed' ? (
                    <Button
                      variant="outline"
                      className="flex-1"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void removeRuntime(pkg.id)}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      size="sm"
                      disabled={isBusy || pkg.status === 'installing'}
                      onClick={() => void installRuntime(pkg.id)}
                    >
                      Install
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isLoading ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No runtimes available yet. Runtime metadata is loaded from <code>/public/runtime-packages</code>.
        </div>
      ) : null}
    </div>
  )
}
