import type { Logger, LogEntry, LogLevel } from '@/types/infrastructure';

export class InfrastructureLogger implements Logger {
  private entries: LogEntry[] = [];
  private maxEntries: number;
  private currentLogLevel: LogLevel;

  constructor(maxEntries: number = 1000, logLevel: LogLevel = 'info') {
    this.maxEntries = maxEntries;
    this.currentLogLevel = logLevel;
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      this.addEntry('debug', message, context);
    }
  }

  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      this.addEntry('info', message, context);
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      this.addEntry('warn', message, context);
    }
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      const errorContext = error ? {
        ...context,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      } : context;
      
      this.addEntry('error', message, errorContext);
    }
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  // Performance logging utility
  time<T>(label: string, fn: () => T): T;
  time<T>(label: string, fn: () => Promise<T>): Promise<T>;
  time<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now();
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = performance.now() - start;
          this.debug(`${label} completed`, { duration });
        });
      } else {
        const duration = performance.now() - start;
        this.debug(`${label} completed`, { duration });
        return result;
      }
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${label} failed`, error as Error, { duration });
      throw error;
    }
  }

  // Async timing utility
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.debug(`${label} completed`, { duration });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${label} failed`, error as Error, { duration });
      throw error;
    }
  }

  // Export logs as JSON
  export(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  // Import logs from JSON
  import(data: string): void {
    try {
      const imported = JSON.parse(data) as LogEntry[];
      this.entries = imported.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
      this.trimEntries();
    } catch (error) {
      this.error('Failed to import logs', error as Error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.currentLogLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private addEntry(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
    };

    this.entries.push(entry);
    this.trimEntries();

    // Also log to console in development
    if (import.meta.env.DEV) {
      this.logToConsole(entry);
    }
  }

  private trimEntries(): void {
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const contextStr = entry.context ? JSON.stringify(entry.context) : '';
    const message = `[${timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr ? ' ' + contextStr : ''}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message);
        break;
      case 'info':
        console.info(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
    }
  }
}

// Singleton instance
export const logger = new InfrastructureLogger();

// Convenience functions for common logging patterns
export const logQuery = (sql: string, duration: number, rowCount?: number) => {
  logger.debug('Database query executed', {
    sql: sql.slice(0, 200) + (sql.length > 200 ? '...' : ''),
    duration,
    rowCount,
  });
};

export const logError = (operation: string, error: Error, context?: Record<string, any>) => {
  logger.error(`${operation} failed`, error, context);
};

export const logPerformance = (operation: string, duration: number, metadata?: Record<string, any>) => {
  logger.info(`Performance: ${operation}`, {
    duration,
    ...metadata,
  });
};