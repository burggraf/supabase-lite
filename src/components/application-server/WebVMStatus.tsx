import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApplicationServer } from '@/hooks/useApplicationServer'

const statusLabels: Record<string, string> = {
  unloaded: 'Not Started',
  loading: 'Loading',
  booting: 'Booting',
  ready: 'Ready',
  hibernating: 'Sleeping',
  error: 'Error',
}

const statusTone: Record<string, string> = {
  unloaded: 'text-muted-foreground',
  loading: 'text-primary',
  booting: 'text-primary',
  ready: 'text-emerald-500',
  hibernating: 'text-amber-500',
  error: 'text-destructive',
}

export function WebVMStatusPanel() {
  const { state, initialize } = useApplicationServer()
  const { webvmStatus } = state

  const canStart = webvmStatus.state === 'unloaded' || webvmStatus.state === 'hibernating'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">WebVM</CardTitle>
        <span className={`text-sm font-medium ${statusTone[webvmStatus.state]}`}>
          {statusLabels[webvmStatus.state]}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Download Progress: {Math.round(webvmStatus.loadProgress)}%
          </div>
          {canStart && (
            <Button size="sm" onClick={initialize}>
              {webvmStatus.state === 'unloaded' ? 'Initialize' : 'Resume'}
            </Button>
          )}
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Installed runtimes</div>
            <div className="font-medium">{webvmStatus.installedRuntimes.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Running apps</div>
            <div className="font-medium">{webvmStatus.runningApps.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">CPU usage</div>
            <div className="font-medium">
              {webvmStatus.systemResources.cpuUsage != null
                ? `${webvmStatus.systemResources.cpuUsage.toFixed(1)}%`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Memory usage</div>
            <div className="font-medium">
              {webvmStatus.systemResources.memoryUsed != null
                ? `${Math.round(webvmStatus.systemResources.memoryUsed)} MB`
                : '—'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
