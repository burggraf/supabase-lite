/**
 * WebVMBridge - Interface for communication with WebVM instances
 * 
 * Provides a PostMessage-based communication layer between the main application
 * and WebVM instances running in iframes. Handles message serialization,
 * response tracking, and error handling.
 */

import { 
  WebVMMessage, 
  WebVMHttpRequest, 
  WebVMHttpResponse,
  ApplicationServerError 
} from '@/types/application-server';
import { logger } from '@/lib/infrastructure/Logger';

export interface WebVMBridgeConfig {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class WebVMBridge {
  private static instance: WebVMBridge;
  private iframe: HTMLIFrameElement | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private messageId = 0;
  private isConnected = false;
  private logger = logger;
  private config: WebVMBridgeConfig = {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000 // 1 second
  };

  private constructor() {
    this.setupMessageListener();
  }

  static getInstance(): WebVMBridge {
    if (!WebVMBridge.instance) {
      WebVMBridge.instance = new WebVMBridge();
    }
    return WebVMBridge.instance;
  }

  async initialize(webvmUrl: string): Promise<void> {
    try {
      if (this.iframe) {
        this.cleanup();
      }

      this.iframe = this.createWebVMIframe(webvmUrl);
      document.body.appendChild(this.iframe);

      // Wait for WebVM to be ready
      await this.waitForConnection();
      
      this.logger.info('WebVMBridge initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize WebVMBridge', error);
      throw new ApplicationServerError({
        code: 'WEBVM_INIT_FAILED',
        message: 'Failed to initialize WebVM bridge',
        details: error,
        timestamp: new Date()
      });
    }
  }

  private createWebVMIframe(url: string): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.display = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-downloads');
    
    return iframe;
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      // Validate origin for security
      if (!this.iframe || event.source !== this.iframe.contentWindow) {
        return;
      }

      try {
        const message: WebVMMessage = event.data;
        this.handleWebVMMessage(message);
      } catch (error) {
        this.logger.error('Failed to handle WebVM message', error);
      }
    });
  }

  private handleWebVMMessage(message: WebVMMessage): void {
    const { type, id, payload } = message;

    switch (type) {
      case 'response':
        this.handleResponse(id, payload);
        break;
      case 'error':
        this.handleError(id, payload);
        break;
      case 'ready':
        this.handleReady();
        break;
      case 'log':
        this.handleLog(payload);
        break;
      default:
        this.logger.warn(`Unknown WebVM message type: ${type}`);
    }
  }

  private handleResponse(id: string, payload: any): void {
    const request = this.pendingRequests.get(id);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(id);
      request.resolve(payload);
    }
  }

  private handleError(id: string, payload: any): void {
    const request = this.pendingRequests.get(id);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(id);
      request.reject(new Error(payload.message || 'WebVM error'));
    }
  }

  private handleReady(): void {
    this.isConnected = true;
    this.logger.info('WebVM connection established');
  }

  private handleLog(payload: any): void {
    // Forward WebVM logs to our logger
    const { level, message, ...details } = payload;
    this.logger.log(level, `[WebVM] ${message}`, details);
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebVM connection timeout'));
      }, this.config.timeout);

      const checkConnection = () => {
        if (this.isConnected) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  async sendMessage(type: string, payload: any): Promise<any> {
    if (!this.iframe || !this.isConnected) {
      throw new ApplicationServerError({
        code: 'WEBVM_NOT_CONNECTED',
        message: 'WebVM bridge is not connected',
        timestamp: new Date()
      });
    }

    const id = (++this.messageId).toString();
    const message: WebVMMessage = {
      type,
      id,
      payload
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new ApplicationServerError({
          code: 'WEBVM_TIMEOUT',
          message: `WebVM request timeout for message type: ${type}`,
          timestamp: new Date()
        }));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        this.iframe!.contentWindow!.postMessage(message, '*');
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(new ApplicationServerError({
          code: 'WEBVM_SEND_FAILED',
          message: 'Failed to send message to WebVM',
          details: error,
          timestamp: new Date()
        }));
      }
    });
  }

  async executeCommand(command: string, args: string[] = []): Promise<{ 
    stdout: string; 
    stderr: string; 
    exitCode: number; 
  }> {
    return this.sendMessage('execute', { command, args });
  }

  async writeFile(path: string, content: string | ArrayBuffer): Promise<void> {
    return this.sendMessage('writeFile', { path, content });
  }

  async readFile(path: string): Promise<string | ArrayBuffer> {
    return this.sendMessage('readFile', { path });
  }

  async installRuntime(runtimeId: string, config: any = {}): Promise<void> {
    return this.sendMessage('installRuntime', { runtimeId, config });
  }

  async startApplication(applicationId: string, config: any = {}): Promise<void> {
    return this.sendMessage('startApplication', { applicationId, config });
  }

  async stopApplication(applicationId: string): Promise<void> {
    return this.sendMessage('stopApplication', { applicationId });
  }

  async getStatus(): Promise<{
    runtimeIds: string[];
    activeApplicationId?: string;
    memoryUsage: number;
    uptime: number;
  }> {
    return this.sendMessage('getStatus', {});
  }

  async createSnapshot(): Promise<{ snapshotId: string; size: number }> {
    return this.sendMessage('createSnapshot', {});
  }

  async restoreSnapshot(snapshotId: string): Promise<void> {
    return this.sendMessage('restoreSnapshot', { snapshotId });
  }

  async reset(options: {
    clearRuntimes?: boolean;
    clearSnapshots?: boolean;
  } = {}): Promise<void> {
    return this.sendMessage('reset', options);
  }

  async forwardHttpRequest(request: WebVMHttpRequest): Promise<WebVMHttpResponse> {
    return this.sendMessage('httpRequest', request);
  }

  isReady(): boolean {
    return this.isConnected && this.iframe !== null;
  }

  cleanup(): void {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    // Clear all pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('WebVM bridge cleanup'));
    }
    this.pendingRequests.clear();

    this.isConnected = false;
    this.logger.info('WebVMBridge cleaned up');
  }
}

/**
 * WebVM PostMessage Protocol Specification
 * 
 * Messages sent to WebVM:
 * {
 *   type: 'execute' | 'writeFile' | 'readFile' | 'installRuntime' | 'startApplication' | 'stopApplication' | 'getStatus' | 'createSnapshot' | 'restoreSnapshot' | 'reset' | 'httpRequest',
 *   id: string,
 *   payload: any
 * }
 * 
 * Messages received from WebVM:
 * {
 *   type: 'response' | 'error' | 'ready' | 'log',
 *   id: string,
 *   payload: any
 * }
 * 
 * Error handling:
 * - Timeout errors for unresponsive WebVM
 * - Connection errors for failed initialization
 * - Command execution errors with exit codes
 * - File operation errors with descriptive messages
 */