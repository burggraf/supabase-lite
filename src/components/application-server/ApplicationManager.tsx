import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApplicationServer } from '@/hooks/useApplicationServer'

export function ApplicationManager() {
  const { state, deployStaticApplication, startApplication, stopApplication } = useApplicationServer()
  const [appName, setAppName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionAppId, setActionAppId] = useState<string | null>(null)

  const runtimesReady = useMemo(
    () => state.packages.some((pkg) => pkg.id === 'nginx' && pkg.status === 'installed'),
    [state.packages],
  )
  const bridgeAvailable = state.bridgeAvailable

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) {
      setSelectedFiles([])
      return
    }
    setSelectedFiles(Array.from(files))
  }

  const handleDeploy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFiles.length) {
      setError('Select at least one file to deploy')
      return
    }
    setError(null)
    setDeploying(true)
    try {
      await deployStaticApplication(appName.trim() || 'static-app', selectedFiles)
      setAppName('')
      setSelectedFiles([])
    } catch (deploymentError) {
      setError(deploymentError instanceof Error ? deploymentError.message : String(deploymentError))
    } finally {
      setDeploying(false)
    }
  }

  const handleStart = async (appId: string) => {
    setActionAppId(appId)
    try {
      await startApplication(appId)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : String(startError))
    } finally {
      setActionAppId(null)
    }
  }

  const handleStop = async (appId: string) => {
    setActionAppId(appId)
    try {
      await stopApplication(appId)
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : String(stopError))
    } finally {
      setActionAppId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deploy Static Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!runtimesReady && (
            <Alert variant="destructive">
              <AlertTitle>nginx runtime required</AlertTitle>
              <AlertDescription>
                Install the nginx runtime to serve static applications through the Application Server.
              </AlertDescription>
            </Alert>
          )}
          <form className="space-y-4" onSubmit={handleDeploy}>
            <div className="grid gap-2">
              <Label htmlFor="app-name">Application Name</Label>
              <Input
                id="app-name"
                value={appName}
                onChange={(event) => setAppName(event.target.value)}
                placeholder="my-static-app"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="app-files">Application Files</Label>
              <Input
                id="app-files"
                type="file"
                multiple
                webkitdirectory=""
                directory=""
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Drag a folder or select files (directories supported in Chromium-based browsers).
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={deploying || !runtimesReady}>
              {deploying ? 'Deploying…' : 'Deploy Application'}
            </Button>
          </form>
          {!bridgeAvailable && (
            <Alert>
              <AlertTitle>WebVM bridge inactive</AlertTitle>
              <AlertDescription>
                Start the WebVM runtime to enable server-side execution. Until then, deployed apps
                are accessible only via the static file fallback.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {state.applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Deploy a static application to see it listed here.
            </p>
          ) : (
            <div className="space-y-3">
              {state.applications.map((app) => {
                const isRunning = app.status === 'running'
                const isStarting = app.status === 'starting'
                const isStopping = app.status === 'stopping'
                return (
                  <div
                    key={app.id}
                    className="flex flex-col gap-2 rounded-md border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <h3 className="text-base font-semibold">{app.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {app.kind === 'static' ? 'Static application' : app.kind}
                        {app.port ? ` • Port ${app.port}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">Status: {app.status}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={!bridgeAvailable || isRunning || isStarting || actionAppId === app.id}
                        onClick={() => void handleStart(app.id)}
                      >
                        {actionAppId === app.id && !isRunning ? 'Starting…' : 'Start'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!isRunning || isStopping || actionAppId === app.id}
                        onClick={() => void handleStop(app.id)}
                      >
                        {actionAppId === app.id && isRunning ? 'Stopping…' : 'Stop'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
