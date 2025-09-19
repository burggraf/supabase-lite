import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { ApplicationServerStore } from '@/lib/application-server/state/ApplicationServerStore'
import type { ApplicationServerState, InstallOptions, RemoveOptions } from '@/lib/application-server/types'

export function useApplicationServer(): {
  state: ApplicationServerState
  initialize: () => Promise<void>
  installRuntime: (id: string, options?: InstallOptions) => Promise<void>
  removeRuntime: (id: string, options?: RemoveOptions) => Promise<void>
  refreshCatalog: () => Promise<void>
} {
  const store = useMemo(() => ApplicationServerStore.getInstance(), [])

  const snapshot = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
  )

  useEffect(() => {
    void store.initialize()
  }, [store])

  return {
    state: snapshot,
    initialize: () => store.initialize(),
    installRuntime: (id, options) => store.installRuntime(id, options),
    removeRuntime: (id, options) => store.removeRuntime(id, options),
    refreshCatalog: () => store.refreshPackages({ force: true }),
  }
}
