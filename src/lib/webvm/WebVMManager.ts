import { logger } from '@/lib/infrastructure';

type CheerpXModule = typeof import('@leaningtech/cheerpx');
type CheerpXLinux = Awaited<ReturnType<CheerpXModule['Linux']['create']>>;
type CheerpXIDBDevice = Awaited<ReturnType<CheerpXModule['IDBDevice']['create']>>;
type XtermTerminal = import('@xterm/xterm').Terminal;
type IDisposable = import('@xterm/xterm').IDisposable;
export type WebVMStatus = 'unloaded' | 'downloading' | 'initializing' | 'ready' | 'error';

export interface WebVMState {
  status: WebVMStatus;
  message: string;
  progress: number | null;
  error?: string;
}

export interface WebVMConfiguration {
  diskImageUrl: string;
  diskImageType: 'cloud' | 'bytes' | 'github';
  cacheId: string;
  command: string;
  args: string[];
  environment: string[];
  workingDirectory: string;
  userId: number;
  groupId: number;
  introLines: string[];
}

export interface WebVMInstance {
  attachTerminal(term: XtermTerminal): Promise<void>;
  shutdown(): Promise<void>;
}

type StateListener = (state: WebVMState) => void;

const DEFAULT_CONFIG: WebVMConfiguration = {
  diskImageUrl: '/webvm/v2/static-http.ext2',
  diskImageType: 'bytes',
  cacheId: 'supabase-lite-webvm-cache',
  command: '/bin/sh',
  args: ['-c', 'busybox httpd -p 8080 -h /home/user/www >/dev/null 2>&1 & exec /bin/sh'],
  environment: [
    'HOME=/home/user',
    'TERM=xterm-256color',
    'USER=user',
    'SHELL=/bin/sh',
    'PS1=static-webvm:\w$ ',
  ],
  workingDirectory: '/home/user',
  userId: 1000,
  groupId: 1000,
  introLines: [
    'Connected to Supabase Lite static server VM.',
    'Serving /home/user/www via busybox httpd on port 8080. Shell available below.',
  ],
};

const defaultState: WebVMState = {
  status: 'unloaded',
  message: 'WebVM runtime not yet loaded',
  progress: null,
};

export class WebVMManager {
  private state: WebVMState = { ...defaultState };
  private readonly listeners = new Set<StateListener>();
  private loaderPromise: Promise<WebVMInstance> | null = null;
  private instance: WebVMInstance | null = null;
  private runtimeModulePromise: Promise<CheerpXModule> | null = null;

  constructor(private readonly config: WebVMConfiguration = DEFAULT_CONFIG) { }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): WebVMState {
    return this.state;
  }

  async ensureStarted(): Promise<WebVMInstance> {
    if (this.instance) {
      return this.instance;
    }

    if (this.loaderPromise) {
      return this.loaderPromise;
    }

    this.setState({
      status: 'downloading',
      message: 'Fetching WebVM runtime…',
      progress: 0,
    });

    this.loaderPromise = this.initializeInstance()
      .then((instance) => {
        this.instance = instance;
        return instance;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to initialize WebVM runtime', error as Error);
        this.setState({
          status: 'error',
          message,
          progress: null,
          error: message,
        });
        this.loaderPromise = null;
        this.instance = null;
        throw error;
      });

    return this.loaderPromise;
  }

  async shutdown(): Promise<void> {
    if (!this.instance) {
      this.setState({ ...defaultState });
      return;
    }

    try {
      await this.instance.shutdown();
    } catch (error) {
      logger.warn('Error shutting down WebVM instance', error as Error);
    } finally {
      this.instance = null;
      this.loaderPromise = null;
      this.setState({ ...defaultState });
    }
  }

  private async initializeInstance(): Promise<WebVMInstance> {
    this.setState({
      status: 'initializing',
      message: 'Booting WebVM environment…',
      progress: 0.5,
    });

    const module = await this.loadRuntimeModule();

    const blockDevice = await this.createBlockDevice(module, this.config.diskImageUrl, this.config.diskImageType);
    const cacheDevice = await module.IDBDevice.create(this.config.cacheId);
    const overlayDevice = await module.OverlayDevice.create(blockDevice, cacheDevice);
    const webDevice = await module.WebDevice.create('');
    const dataDevice = await module.DataDevice.create();

    const mounts = [
      { type: 'ext2', dev: overlayDevice, path: '/' },
      { type: 'dir', dev: webDevice, path: '/web' },
      { type: 'dir', dev: dataDevice, path: '/data' },
      { type: 'devs', path: '/dev' },
      { type: 'devpts', path: '/dev/pts' },
      { type: 'proc', path: '/proc' },
      { type: 'sys', path: '/sys' },
    ];

    const linux = await module.Linux.create({ mounts });

    return new CheerpXWebVMInstance(
      module,
      linux,
      cacheDevice,
      this.config,
      () => {
        this.setState({
          status: 'ready',
          message: 'WebVM is ready. Use the terminal to interact with the VM.',
          progress: 1,
        });
      },
      (error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setState({
          status: 'error',
          message,
          progress: null,
          error: message,
        });
      }
    );
  }

  private async loadRuntimeModule(): Promise<CheerpXModule> {
    if (typeof window !== 'undefined' && !window.crossOriginIsolated) {
      throw new Error(
        'WebVM requires cross-origin isolation (COOP/COEP headers) so SharedArrayBuffer is available. Configure your dev server or deploy with proper headers to run the VM.'
      );
    }

    if (!this.runtimeModulePromise) {
      this.runtimeModulePromise = import('@leaningtech/cheerpx');
    }

    return this.runtimeModulePromise;
  }

  private async createBlockDevice(module: CheerpXModule, url: string, type: WebVMConfiguration['diskImageType']) {
    try {
      switch (type) {
        case 'cloud': {
          try {
            return await module.CloudDevice.create(url);
          } catch (error) {
            const wssPrefix = 'wss://';
            if (url.startsWith(wssPrefix)) {
              logger.warn('WebSocket disk fetch failed, retrying via HTTPS', error as Error);
              const fallback = `https://${url.slice(wssPrefix.length)}`;
              return await module.CloudDevice.create(fallback);
            }
            throw error;
          }
        }
        case 'bytes':
          return await module.HttpBytesDevice.create(url);
        case 'github':
          return await module.GitHubDevice.create(url);
        default:
          throw new Error(`Unsupported disk image type: ${type}`);
      }
    } catch (error) {
      logger.error('Failed to create WebVM block device', error as Error);
      throw error;
    }
  }

  private setState(partial: Partial<WebVMState>) {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

class CheerpXWebVMInstance implements WebVMInstance {
  private terminal: XtermTerminal | null = null;
  private terminalDataSubscription: IDisposable | null = null;
  private resizeSubscription: IDisposable | null = null;
  private consoleReader: ((code: number) => void) | null = null;
  private running = false;
  private runLoopPromise: Promise<void> | null = null;

  constructor(
    private readonly module: CheerpXModule,
    private readonly linux: CheerpXLinux,
    private readonly cacheDevice: CheerpXIDBDevice,
    private readonly config: WebVMConfiguration,
    private readonly onReady: () => void,
    private readonly onError: (error: unknown) => void
  ) { }

  async attachTerminal(term: XtermTerminal): Promise<void> {
    if (this.terminal === term) {
      if (!this.running && !this.runLoopPromise) {
        this.startShellLoop();
      }
      return;
    }

    this.detachTerminal();

    this.terminal = term;
    this.initializeConsole(term);
    this.startShellLoop();
  }

  async shutdown(): Promise<void> {
    this.running = false;

    if (this.consoleReader) {
      for (const char of 'exit\n') {
        this.consoleReader(char.charCodeAt(0));
      }
    }

    try {
      await this.runLoopPromise;
    } catch (error) {
      logger.warn('WebVM shell loop exited with error during shutdown', error as Error);
    }

    this.detachTerminal();

    try {
      if (typeof (this.cacheDevice as { reset?: () => Promise<void> }).reset === 'function') {
        await (this.cacheDevice as { reset: () => Promise<void> }).reset();
      }
    } catch (error) {
      logger.warn('Failed to reset WebVM cache device', error as Error);
    }
  }

  private initializeConsole(term: XtermTerminal) {
    term.reset();
    for (const line of this.config.introLines) {
      term.writeln(line);
    }

    const outputHandler = (buffer: ArrayBuffer, vt: number) => {
      if (vt !== 1 || !this.terminal) {
        return;
      }
      const data = new Uint8Array(buffer);
      this.terminal.write(data);
    };

    this.consoleReader = this.linux.setCustomConsole(outputHandler, term.cols, term.rows);

    this.terminalDataSubscription = term.onData((chunk) => {
      if (!this.consoleReader) {
        return;
      }
      for (let index = 0; index < chunk.length; index += 1) {
        this.consoleReader(chunk.charCodeAt(index));
      }
    });

    this.resizeSubscription = term.onResize(({ cols, rows }) => {
      this.consoleReader = this.linux.setCustomConsole(outputHandler, cols, rows);
    });

    term.focus();
  }

  private detachTerminal() {
    this.terminalDataSubscription?.dispose();
    this.terminalDataSubscription = null;
    this.resizeSubscription?.dispose();
    this.resizeSubscription = null;
    this.terminal = null;
    this.consoleReader = null;
  }

  private startShellLoop() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.runLoopPromise = this.runShellLoop().finally(() => {
      this.running = false;
    });
  }

  private async runShellLoop(): Promise<void> {
    this.onReady();

    const options = {
      env: this.config.environment,
      cwd: this.config.workingDirectory,
      uid: this.config.userId,
      gid: this.config.groupId,
    } as const;

    while (this.running) {
      try {
        await this.linux.run(this.config.command, this.config.args, options);
      } catch (error) {
        this.onError(error);
        return;
      }
    }
  }
}
