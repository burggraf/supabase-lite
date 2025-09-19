import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApplicationServer } from '@/hooks/useApplicationServer'
import { WebVMStatusPanel } from './WebVMStatus'
import { RuntimeBrowser } from './RuntimeBrowser'
import { ApplicationManager } from './ApplicationManager'
import { Loader2 } from 'lucide-react'

export function ApplicationServer() {
  const { state } = useApplicationServer()
  const loading = state.webvmStatus.state === 'loading' || state.webvmStatus.state === 'booting'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-1/2">
          <WebVMStatusPanel />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing WebVM environment…
        </div>
      )}

      <Tabs defaultValue="runtimes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runtimes">Runtimes</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>
        <TabsContent value="runtimes" className="space-y-4">
          <RuntimeBrowser />
        </TabsContent>
        <TabsContent value="applications" className="space-y-4">
          <ApplicationManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
