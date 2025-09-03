/**
 * Background Sync Queue
 * Queues operations when offline and processes them when connection is restored
 */

export interface QueuedOperation {
  id: string;
  type: 'database' | 'storage' | 'auth' | 'functions';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
}

export interface ExecuteResult {
  success: boolean;
  error?: Error;
  retryCount: number;
  abandoned?: boolean;
}

export interface QueueStats {
  totalOperations: number;
  pendingOperations: number;
  failedOperations: number;
  operationsByType: Record<string, number>;
}

/**
 * Singleton Background Sync Queue for offline operations
 */
export class SyncQueue {
  private static instance: SyncQueue | null = null;
  private queue: QueuedOperation[] = [];
  private readonly STORAGE_KEY = 'supabase-lite-sync-queue';
  private readonly MAX_RETRIES = 3;

  private constructor() {
    this.loadFromStorage();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SyncQueue {
    if (!SyncQueue.instance) {
      SyncQueue.instance = new SyncQueue();
    }
    return SyncQueue.instance;
  }

  /**
   * Add operation to queue or execute immediately if online
   */
  public async enqueue(
    operation: QueuedOperation,
    executeFunction?: (op: QueuedOperation) => Promise<any>
  ): Promise<void> {
    // If online and execute function provided, execute immediately
    if (navigator.onLine && executeFunction) {
      try {
        await executeFunction(operation);
        return;
      } catch (error) {
        // If immediate execution fails, add to queue
      }
    }

    // Remove existing operation with same ID (deduplication)
    this.dequeue(operation.id);
    
    // Add to queue
    this.queue.push(operation);
    this.saveToStorage();
  }

  /**
   * Remove operation from queue
   */
  public dequeue(operationId: string): void {
    this.queue = this.queue.filter(op => op.id !== operationId);
    this.saveToStorage();
  }

  /**
   * Clear all operations from queue
   */
  public clearQueue(): void {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Get all queued operations
   */
  public getQueuedOperations(): QueuedOperation[] {
    return [...this.queue];
  }

  /**
   * Process entire queue with provided execute function
   */
  public async processQueue(
    executeFunction: (op: QueuedOperation) => Promise<any>
  ): Promise<void> {
    if (!navigator.onLine) {
      return; // Don't process when offline
    }

    const operationsToProcess = [...this.queue];
    
    for (const operation of operationsToProcess) {
      try {
        await executeFunction(operation);
        this.dequeue(operation.id);
      } catch (error) {
        // Handle retry logic in executeWithRetry
        const result = await this.executeWithRetry(operation, executeFunction);
        if (result.success || result.abandoned) {
          this.dequeue(operation.id);
        } else {
          // Update retry count in queue
          const queuedOp = this.queue.find(op => op.id === operation.id);
          if (queuedOp) {
            queuedOp.retryCount = result.retryCount;
            this.saveToStorage();
          }
        }
      }
    }
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  public async executeWithRetry(
    operation: QueuedOperation,
    executeFunction: (op: QueuedOperation) => Promise<any>
  ): Promise<ExecuteResult> {
    // Check if already at max retries
    if (operation.retryCount >= this.MAX_RETRIES) {
      return {
        success: false,
        error: new Error('Maximum retry attempts reached'),
        retryCount: operation.retryCount,
        abandoned: true
      };
    }

    try {
      await executeFunction(operation);
      return {
        success: true,
        retryCount: operation.retryCount
      };
    } catch (error) {
      const newRetryCount = operation.retryCount + 1;
      
      // Exponential backoff delay
      const delay = Math.pow(2, newRetryCount) * 1000; // 2s, 4s, 8s...
      await new Promise(resolve => setTimeout(resolve, delay));

      return {
        success: false,
        error: error as Error,
        retryCount: newRetryCount
      };
    }
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): QueueStats {
    const operationsByType: Record<string, number> = {};
    let pendingOperations = 0;
    let failedOperations = 0;

    for (const operation of this.queue) {
      // Count by type
      operationsByType[operation.type] = (operationsByType[operation.type] || 0) + 1;
      
      // Count pending vs failed (operation with retryCount < MAX_RETRIES is still pending)
      if (operation.retryCount >= this.MAX_RETRIES) {
        failedOperations++;
      } else {
        pendingOperations++;
      }
    }

    return {
      totalOperations: this.queue.length,
      pendingOperations,
      failedOperations,
      operationsByType
    };
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      // Handle corrupted data gracefully
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      // Handle storage errors gracefully
      console.warn('Failed to save sync queue to localStorage:', error);
    }
  }
}