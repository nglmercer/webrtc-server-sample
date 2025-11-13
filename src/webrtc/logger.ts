/**
 * Configurable Logger System for WebRTC
 * 
 * This module provides a flexible logging interface that allows users to implement
 * their own logger or use the built-in console logger.
 */

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements Logger {
  private enabled: boolean = true;
  private level: 'debug' | 'info' | 'warn' | 'error' = 'info';

  constructor(options?: { enabled?: boolean; level?: 'debug' | 'info' | 'warn' | 'error' }) {
    this.enabled = options?.enabled ?? true;
    this.level = options?.level ?? 'info';
  }

  debug(message: string, ...args: any[]): void {
    if (this.enabled && (this.level === 'debug')) {
      console.debug(`[WebRTC:DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.enabled && ['debug', 'info'].includes(this.level)) {
      console.info(`[WebRTC:INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.enabled && ['debug', 'info', 'warn'].includes(this.level)) {
      console.warn(`[WebRTC:WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.enabled && ['debug', 'info', 'warn', 'error'].includes(this.level)) {
      console.error(`[WebRTC:ERROR] ${message}`, ...args);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.level = level;
  }
}

/**
 * No-op logger for silent operation
 */
export class NoOpLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Global logger instance
 */
let globalLogger: Logger = new ConsoleLogger();

/**
 * Configure the global logger
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Get the current global logger
 */
export function getLogger(): Logger {
  return globalLogger;
}

/**
 * Create a logger with a specific prefix
 */
export function createPrefixedLogger(prefix: string): Logger {
  return {
    debug: (message: string, ...args: any[]) => globalLogger.debug(`[${prefix}] ${message}`, ...args),
    info: (message: string, ...args: any[]) => globalLogger.info(`[${prefix}] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => globalLogger.warn(`[${prefix}] ${message}`, ...args),
    error: (message: string, ...args: any[]) => globalLogger.error(`[${prefix}] ${message}`, ...args),
  };
}

/**
 * Enable/disable logging globally
 */
export function setLoggingEnabled(enabled: boolean): void {
  if (globalLogger instanceof ConsoleLogger) {
    globalLogger.setEnabled(enabled);
  }
}

/**
 * Set logging level globally
 */
export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
  if (globalLogger instanceof ConsoleLogger) {
    globalLogger.setLevel(level);
  }
}
