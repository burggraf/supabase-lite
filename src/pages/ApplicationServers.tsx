import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Terminal as XtermTerminal } from '@xterm/xterm';
import type { FitAddon as XtermFitAddon } from '@xterm/addon-fit';
import {
  WebVMInstance,
  WebVMManager,
  WebVMState,
  WebVMStatus,
} from '@/lib/webvm/WebVMManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { registerServiceWorker } from '@/sw-register';
import '@xterm/xterm/css/xterm.css';

const statusTimeline: WebVMStatus[] = ['unloaded', 'downloading', 'initializing', 'ready'];

const statusCopy: Record<WebVMStatus, { label: string; description: string }> = {
  unloaded: {
    label: 'Idle',
    description: 'WebVM runtime has not been downloaded yet.',
  },
  downloading: {
    label: 'Downloading runtime',
    description: 'Fetching the WebAssembly bundle and disk image.',
  },
  initializing: {
    label: 'Initializing VM',
    description: 'Booting the WebVM Linux environment with bundled tooling.',
  },
  ready: {
    label: 'Ready',
    description: 'WebVM shell is running. Use the terminal below to interact with it.',
  },
  error: {
    label: 'Error',
    description: 'WebVM failed to start. Review the error and retry.',
  },
};

const badgeVariant: Record<WebVMStatus, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  unloaded: 'secondary',
  downloading: 'warning',
  initializing: 'warning',
  ready: 'success',
  error: 'destructive',
};

function progressForStatus(status: WebVMStatus): number {
  switch (status) {
    case 'unloaded':
      return 0;
    case 'downloading':
      return 35;
    case 'initializing':
      return 70;
    case 'ready':
      return 100;
    case 'error':
      return 0;
    default:
      return 0;
  }
}

function ApplicationServersComponent() {
  const manager = useMemo(() => new WebVMManager(), []);
  const [state, setState] = useState<WebVMState>(manager.getState());
  const [vmInstance, setVmInstance] = useState<WebVMInstance | null>(null);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [isCrossOriginIsolated, setIsCrossOriginIsolated] = useState(() =>
    typeof window === 'undefined' ? true : window.crossOriginIsolated
  );
  const [isSettingUpIsolation, setIsSettingUpIsolation] = useState(() =>
    typeof window === 'undefined' ? false : !window.crossOriginIsolated
  );

  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<XtermFitAddon | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.crossOriginIsolated) {
      setIsCrossOriginIsolated(true);
      setIsSettingUpIsolation(false);
      return;
    }

    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
      setTerminalError(
        'WebVM requires a secure context with service workers enabled. Please serve Supabase Lite over HTTPS.'
      );
      setIsSettingUpIsolation(false);
      return;
    }

    setIsCrossOriginIsolated(false);
    setIsSettingUpIsolation(true);

    let controllerChangeHandler: (() => void) | null = null;
    let isolationCheck: number | null = null;

    controllerChangeHandler = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);

    registerServiceWorker(true).catch((error) => {
      console.error('Failed to register service worker for cross-origin isolation', error);
      setTerminalError('Unable to enable WebVM. Service worker registration failed; see console for details.');
      setIsSettingUpIsolation(false);
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
      }
      if (isolationCheck) {
        clearInterval(isolationCheck);
        isolationCheck = null;
      }
    });

    isolationCheck = window.setInterval(() => {
      if (window.crossOriginIsolated) {
        setIsCrossOriginIsolated(true);
        setIsSettingUpIsolation(false);
        if (controllerChangeHandler) {
          navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
        }
        if (isolationCheck) {
          clearInterval(isolationCheck);
          isolationCheck = null;
        }
      }
    }, 500);

    return () => {
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
      }
      if (isolationCheck) {
        clearInterval(isolationCheck);
        isolationCheck = null;
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = manager.subscribe((nextState) => {
      setState(nextState);
      if (nextState.status === 'error' && nextState.error) {
        setTerminalError(nextState.error);
      }
    });

    return () => {
      unsubscribe();
      void manager.shutdown();
    };
  }, [manager]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    const initializeTerminal = async () => {
      try {
        const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
          import('@xterm/addon-web-links'),
        ]);

        if (disposed || !terminalContainerRef.current) {
          return;
        }

        const term = new Terminal({
          convertEol: true,
          cursorBlink: true,
          scrollback: 2000,
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.open(terminalContainerRef.current);
        fitAddon.fit();
        term.focus();

        terminalRef.current = term;
        fitAddonRef.current = fitAddon;
        setIsTerminalReady(true);

        resizeObserver = new ResizeObserver(() => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
          }
        });
        resizeObserver.observe(terminalContainerRef.current);
      } catch (error) {
        console.error('Failed to initialize terminal', error);
        setTerminalError('Failed to initialize terminal emulator. See console for details.');
      }
    };

    initializeTerminal();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      fitAddonRef.current?.dispose();
      fitAddonRef.current = null;
      terminalRef.current?.dispose();
      terminalRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleWindowResize = () => {
      fitAddonRef.current?.fit();
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  const handleBoot = useCallback(async () => {
    if (!terminalRef.current) {
      setTerminalError('Terminal is still loading. Please try again in a moment.');
      return;
    }

    if (!isCrossOriginIsolated) {
      setTerminalError('WebVM is preparing a secure, cross-origin isolated environment. The page will reload automatically once ready.');
      return;
    }

    setIsBusy(true);
    setTerminalError(null);

    try {
      const instance = await manager.ensureStarted();
      await instance.attachTerminal(terminalRef.current);
      setVmInstance(instance);
    } catch (error) {
      console.error('Failed to boot WebVM', error);
      setTerminalError('Failed to boot WebVM. Check the browser console for details.');
    } finally {
      setIsBusy(false);
    }
  }, [isCrossOriginIsolated, manager]);

  const handleShutdown = useCallback(async () => {
    setIsBusy(true);
    setTerminalError(null);

    try {
      await manager.shutdown();
      setVmInstance(null);
      if (terminalRef.current) {
        terminalRef.current.reset();
        terminalRef.current.writeln('WebVM session terminated.');
      }
    } catch (error) {
      console.error('Failed to shut down WebVM', error);
      setTerminalError('Failed to shut down WebVM cleanly.');
    } finally {
      setIsBusy(false);
    }
  }, [manager]);

  const isLoading = state.status === 'downloading' || state.status === 'initializing';
  const showRetry = state.status === 'error';
  const isBootDisabled =
    isBusy ||
    isLoading ||
    !isTerminalReady ||
    !isCrossOriginIsolated ||
    isSettingUpIsolation;

  const bootButtonLabel = !isCrossOriginIsolated
    ? isSettingUpIsolation
      ? 'Preparing secure context…'
      : 'Enable isolation'
    : isLoading
    ? 'Starting…'
    : showRetry
    ? 'Retry Boot'
    : 'Boot WebVM';

  return (
    <div className="flex-1 p-6 overflow-y-auto min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Application Servers</h1>
          <p className="text-muted-foreground">
            Boot a WebVM 2.0 virtual machine to run application servers entirely in your browser. The VM
            runs a lightweight Linux environment with common tooling preloaded.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">WebVM Status</CardTitle>
                <Badge variant={badgeVariant[state.status]}>{statusCopy[state.status].label}</Badge>
              </div>
              <CardDescription>
                {!isCrossOriginIsolated
                  ? 'Setting up cross-origin isolation (COOP/COEP) so WebVM can access SharedArrayBuffer…'
                  : state.message || statusCopy[state.status].description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progressForStatus(state.status)} />
              <ul className="space-y-3 text-sm text-muted-foreground">
                {statusTimeline.map((statusKey) => (
                  <li key={statusKey} className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        state.status === statusKey
                          ? 'bg-primary'
                          : statusTimeline.indexOf(state.status) > statusTimeline.indexOf(statusKey)
                          ? 'bg-primary/40'
                          : 'bg-border'
                      }`}
                    />
                    <div>
                      <p className="font-medium text-foreground">{statusCopy[statusKey].label}</p>
                      <p>{statusCopy[statusKey].description}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {showRetry && state.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {state.error}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">WebVM Terminal</CardTitle>
                <CardDescription>
                  An interactive terminal connected to the WebVM environment. Use it to manage servers running inside the VM.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {state.status !== 'ready' && (
                  <Button onClick={handleBoot} disabled={isBootDisabled}>
                    {bootButtonLabel}
                  </Button>
                )}
                {state.status === 'ready' && (
                  <Button variant="outline" onClick={handleShutdown} disabled={isBusy || !vmInstance}>
                    Shutdown VM
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-3">
              <div
                ref={terminalContainerRef}
                className="h-72 w-full overflow-hidden rounded-md border border-border bg-black font-mono text-sm text-muted-foreground"
              />
              {!isTerminalReady && !terminalError && (
                <p className="text-xs text-muted-foreground">
                  Initializing terminal emulator…
                </p>
              )}
              {!isCrossOriginIsolated && !terminalError && (
                <p className="text-xs text-muted-foreground">
                  WebVM needs a cross-origin isolated context. A service worker is being registered to add the required COOP/COEP headers.
                </p>
              )}
              {terminalError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {terminalError}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const ApplicationServers = ApplicationServersComponent;

export default ApplicationServers;
