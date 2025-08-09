// index.ts - Punto de entrada del módulo de logging

export {
  Logger,
  LogLevel,
  type LoggerConfig,
  type LogEntry,
  getLogger,
  pushLogs
} from './Logger';

export {
  LoggerConfigs,
  getConfigForEnvironment,
  createCustomConfig,
  validateConfig,
  DEFAULT_CONFIG
} from './config';

// Re-exportar tipos para facilitar el uso
export type { LoggerConfig as ILoggerConfig, LogEntry as ILogEntry } from './Logger';

// Exportar instancia por defecto configurada para el entorno actual
import { getLogger } from './Logger';
import { getConfigForEnvironment } from './config';

/**
 * Logger por defecto configurado automáticamente según el entorno
 */
export const defaultLogger = getLogger(getConfigForEnvironment());

/**
 * Funciones de conveniencia que usan el logger por defecto
 */
export const log = {
  debug: (event: string, message: string, data?: any, context?: Record<string, any>) => 
    defaultLogger.debug(event, message, data, context),
  
  info: (event: string, message: string, data?: any, context?: Record<string, any>) => 
    defaultLogger.info(event, message, data, context),
  
  warn: (event: string, message: string, data?: any, context?: Record<string, any>) => 
    defaultLogger.warn(event, message, data, context),
  
  error: (event: string, message: string, data?: any, context?: Record<string, any>) => 
    defaultLogger.error(event, message, data, context),
  
  fatal: (event: string, message: string, data?: any, context?: Record<string, any>) => 
    defaultLogger.fatal(event, message, data, context)
};
export const logger = getLogger();

export default defaultLogger;