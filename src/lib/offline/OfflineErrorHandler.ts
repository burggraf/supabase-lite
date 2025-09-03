/**
 * Enhanced Offline Error Handler
 * Provides graceful error handling and user-friendly messaging for offline scenarios
 */

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export interface ErrorContext {
  operation: string;
  component: string;
  userAction: string;
}

export interface OfflineError {
  originalError: Error;
  isOffline: boolean;
  context: ErrorContext;
  userFriendlyMessage: string;
  suggestedActions: string[];
  timestamp: number;
}

export interface ErrorStats {
  totalOfflineErrors: number;
  errorsByOperation: Record<string, number>;
  errorsByComponent: Record<string, number>;
}

/**
 * Singleton Offline Error Handler for enhanced error handling
 */
export class OfflineErrorHandler {
  private static instance: OfflineErrorHandler | null = null;
  private retryQueue: Map<string, { error: Error, context: ErrorContext, retryFn: Function }> = new Map();
  private errorStats: ErrorStats = {
    totalOfflineErrors: 0,
    errorsByOperation: {},
    errorsByComponent: {}
  };

  // Common offline error patterns
  private readonly OFFLINE_ERROR_PATTERNS = [
    /failed to fetch/i,
    /network error/i,
    /request timeout/i,
    /connection refused/i,
    /no internet connection/i,
    /offline/i,
    /net::/i,
    /err_network_changed/i,
    /err_internet_disconnected/i
  ];

  private constructor() {
    this.setupOnlineEventListener();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OfflineErrorHandler {
    if (!OfflineErrorHandler.instance) {
      OfflineErrorHandler.instance = new OfflineErrorHandler();
    }
    return OfflineErrorHandler.instance;
  }

  /**
   * Detect if an error is related to offline/network issues
   */
  public isOfflineError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    return this.OFFLINE_ERROR_PATTERNS.some(pattern => 
      pattern.test(errorMessage)
    );
  }

  /**
   * Enrich error with offline context and user-friendly information
   */
  public enrichError(error: Error, context: ErrorContext): OfflineError {
    const isOffline = this.isOfflineError(error);
    
    if (isOffline) {
      this.updateErrorStats(context);
    }

    return {
      originalError: error,
      isOffline,
      context,
      userFriendlyMessage: this.generateUserFriendlyMessage(error, context),
      suggestedActions: this.generateSuggestedActions(error, context),
      timestamp: Date.now()
    };
  }

  /**
   * Generate user-friendly error messages
   */
  public generateUserFriendlyMessage(error: Error, context: ErrorContext): string {
    if (!this.isOfflineError(error)) {
      return error.message;
    }

    const { operation, userAction } = context;

    if (operation.includes('database')) {
      return `Unable to ${userAction.toLowerCase()} while offline. Your database operations are stored locally and will work without an internet connection.`;
    }

    if (operation.includes('file') || operation.includes('upload')) {
      return `Unable to ${userAction.toLowerCase()} due to connection issues. Your files are stored locally until your connection is restored.`;
    }

    if (operation.includes('auth') || operation.includes('login')) {
      return `Unable to ${userAction.toLowerCase()} while offline. Your authentication is managed locally when disconnected.`;
    }

    return `Unable to ${userAction.toLowerCase()} due to connection issues. Please check your internet connection and try again.`;
  }

  /**
   * Generate suggested actions for users
   */
  public generateSuggestedActions(error: Error, context: ErrorContext): string[] {
    if (!this.isOfflineError(error)) {
      return [];
    }

    return [
      'Check your internet connection',
      'Try again when your connection is restored',
      'Continue working offline - your data is stored locally'
    ];
  }

  /**
   * Schedule automatic retry when connection is restored
   */
  public scheduleRetry(
    error: Error, 
    context: ErrorContext, 
    retryFunction: (error: Error, context: ErrorContext) => void
  ): boolean {
    if (!this.isOfflineError(error)) {
      return false;
    }

    const retryKey = `${context.operation}-${context.component}-${Date.now()}`;
    
    // Avoid duplicating same retry
    const existingRetry = Array.from(this.retryQueue.values()).find(
      retry => retry.context.operation === context.operation && 
               retry.context.component === context.component
    );

    if (existingRetry) {
      return true; // Already scheduled
    }

    this.retryQueue.set(retryKey, {
      error,
      context,
      retryFn: retryFunction
    });

    return true;
  }

  /**
   * Get number of pending retries
   */
  public getPendingRetryCount(): number {
    return this.retryQueue.size;
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): ErrorStats {
    return { ...this.errorStats };
  }

  /**
   * Update error statistics
   */
  private updateErrorStats(context: ErrorContext): void {
    this.errorStats.totalOfflineErrors++;
    
    // Track by operation
    this.errorStats.errorsByOperation[context.operation] = 
      (this.errorStats.errorsByOperation[context.operation] || 0) + 1;
      
    // Track by component
    this.errorStats.errorsByComponent[context.component] = 
      (this.errorStats.errorsByComponent[context.component] || 0) + 1;
  }

  /**
   * Setup online event listener for automatic retries
   */
  private setupOnlineEventListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', () => {
      this.processRetryQueue();
    });
  }

  /**
   * Process retry queue when coming back online
   */
  private async processRetryQueue(): Promise<void> {
    const retries = Array.from(this.retryQueue.entries());
    this.retryQueue.clear();

    for (const [key, { error, context, retryFn }] of retries) {
      try {
        await retryFn(error, context);
      } catch (retryError) {
        // If retry fails, don't re-queue to avoid infinite loops
        console.warn('Retry failed for operation:', context.operation, retryError);
      }
    }
  }
}