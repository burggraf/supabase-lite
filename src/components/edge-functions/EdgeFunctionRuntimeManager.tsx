import { useCallback, useEffect, useRef, useState } from 'react';
import type { Terminal as XtermTerminal } from '@xterm/xterm';
import type { FitAddon as XtermFitAddon } from '@xterm/addon-fit';
import type { WebVMInstance, WebVMState, WebVMStatus } from '@/lib/webvm/WebVMManager';
import { edgeFunctionsWebvmManager } from '@/lib/webvm';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { registerServiceWorker } from '@/sw-register';
import '@xterm/xterm/css/xterm.css';

const statusLabels: Record<WebVMStatus, string> = {
  unloaded: 'Idle',
  downloading: 'Downloading runtime',
  initializing: 'Booting runtime',
  ready: 'Ready',
  error: 'Error',
};

const badgeVariants: Record<WebVMStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  unloaded: 'secondary',
  downloading: 'default',
  initializing: 'default',
  ready: 'outline',
  error: 'destructive',
};

function progressForState(state: WebVMState): number {
  if (typeof state.progress === 'number') {
    return Math.max(0, Math.min(100, Math.round(state.progress * 100)));
  }

  switch (state.status) {
    case 'ready':
      return 100;
    case 'initializing':
      return 65;
    case 'downloading':
      return 35;
    default:
      return 0;
  }
}

export function EdgeFunctionRuntimeManager() {
  const manager = edgeFunctionsWebvmManager;
  const [state, setState] = useState<WebVMState>(manager.getState());
  const [isBusy, setIsBusy] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [isCrossOriginIsolated, setIsCrossOriginIsolated] = useState(() =>
    typeof window === 'undefined' ? true : window.crossOriginIsolated
  );
  const [isSettingUpIsolation, setIsSettingUpIsolation] = useState(() =>
    typeof window === 'undefined' ? false : !window.crossOriginIsolated
  );
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<XtermFitAddon | null>(null);
  const instanceRef = useRef<WebVMInstance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.crossOriginIsolated) {
      setIsCrossOriginIsolated(true);
      setIsSettingUpIsolation(false);
      setTerminalError(null);
      return;
    }

    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
      setIsCrossOriginIsolated(false);
      setIsSettingUpIsolation(false);
      setTerminalError('Edge runtime requires HTTPS with Service Worker support. Serve Supabase Lite over a secure context.');
      return;
    }

    setIsCrossOriginIsolated(false);
    setIsSettingUpIsolation(true);
    setTerminalError('Preparing secure context for Edge runtime. The page will reload once isolation is enabled.');

    let controllerChangeHandler: (() => void) | null = null;
    let isolationCheck: number | null = null;

    controllerChangeHandler = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);

    registerServiceWorker(true).catch((error) => {
      console.error('Failed to register service worker for Edge runtime isolation', error);
      setTerminalError('Unable to enable Edge runtime. Service worker registration failed; see console for details.');
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
        setTerminalError(null);
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

    const setupTerminal = async () => {
      try {
        const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
          import('@xterm/addon-web-links'),
        ]);

        if (disposed || !terminalContainerRef.current) {
          return;
        }

        const terminal = new Terminal({
          convertEol: true,
          cursorBlink: true,
          scrollback: 2000,
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(new WebLinksAddon());
        terminal.open(terminalContainerRef.current);
        fitAddon.fit();

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;
        setIsTerminalReady(true);

        resizeObserver = new ResizeObserver(() => {
          fitAddonRef.current?.fit();
        });

        resizeObserver.observe(terminalContainerRef.current);
      } catch (error) {
        console.error('Failed to initialize terminal', error);
        setTerminalError('Failed to initialize terminal. Check the console for details.');
      }
    };

    setupTerminal();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      fitAddonRef.current?.dispose();
      fitAddonRef.current = null;
      terminalRef.current?.dispose();
      terminalRef.current = null;
      setIsTerminalReady(false);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      fitAddonRef.current?.fit();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleBoot = useCallback(async () => {
    if (!isTerminalReady) {
      setTerminalError('Terminal is still loading. Please wait a moment and try again.');
      return;
    }

    if (!isCrossOriginIsolated) {
      if (!isSettingUpIsolation) {
        setTerminalError('Edge runtime requires cross-origin isolation. Use the secure preview to continue.');
      }
      return;
    }

    setIsBusy(true);
    setTerminalError(null);

    try {
      const instance = await manager.ensureStarted();
      instanceRef.current = instance;

      if (terminalRef.current) {
        await instance.attachTerminal(terminalRef.current);
      }
    } catch (error) {
      console.error('Failed to boot Edge Functions WebVM', error);
      setTerminalError('Failed to boot the Edge Functions runtime. Check the console for details.');
    } finally {
      setIsBusy(false);
    }
  }, [isTerminalReady, manager]);

  const handleShutdown = useCallback(async () => {
    setIsBusy(true);
    setTerminalError(null);

    try {
      await manager.shutdown();
      instanceRef.current = null;

      if (terminalRef.current) {
        terminalRef.current.reset();
        terminalRef.current.writeln('Edge Functions runtime stopped.');
      }
    } catch (error) {
      console.error('Failed to shut down Edge Functions WebVM', error);
      setTerminalError('Failed to shut down the Edge Functions runtime cleanly.');
    } finally {
      setIsBusy(false);
    }
  }, [manager]);

  const statusDescription = (() => {
    if (!isCrossOriginIsolated) {
      return isSettingUpIsolation
        ? 'Enabling cross-origin isolation so the Edge runtime can start. The page will reload automatically when ready.'
        : 'Edge runtime requires cross-origin isolation (COOP/COEP). Open Supabase Lite via the secure preview to continue.';
    }

    switch (state.status) {
      case 'ready':
        return 'Edge Functions runtime is ready. Use the terminal below to interact with the VM.';
      case 'downloading':
        return 'Fetching runtime image…';
      case 'initializing':
        return 'Booting WebVM environment…';
      case 'error':
        return state.error ?? 'Runtime encountered an error.';
      default:
        return 'Runtime is idle.';
    }
  })();

  const canBoot = !isBusy && state.status !== 'ready' && isCrossOriginIsolated;
  const canShutdown = !isBusy && state.status === 'ready';

  const bootLabel = !isCrossOriginIsolated
    ? isSettingUpIsolation
      ? 'Preparing secure context…'
      : 'Enable isolation'
    : state.status === 'ready'
    ? 'Reboot'
    : 'Boot runtime';

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-xl">Edge Functions Runtime</CardTitle>
          <CardDescription>{statusDescription}</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={badgeVariants[state.status]}>{statusLabels[state.status]}</Badge>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleBoot} disabled={!canBoot}>
              {bootLabel}
            </Button>
            <Button size="sm" variant="outline" onClick={handleShutdown} disabled={!canShutdown}>
              Stop runtime
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progressForState(state)} />
        {terminalError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {terminalError}
          </div>
        ) : null}
        <div
          ref={terminalContainerRef}
          className="h-64 w-full overflow-hidden rounded-md border border-border bg-black"
        />
      </CardContent>
    </Card>
  );
}
