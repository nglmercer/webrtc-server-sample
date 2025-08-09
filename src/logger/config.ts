// config.ts - Configuración del sistema de logging

import { LogLevel,type LoggerConfig } from './Logger';
import path from 'path';

/**
 * Configuraciones predefinidas para diferentes entornos
 */
export const LoggerConfigs = {
  /**
   * Configuración para desarrollo
   */
  development: {
    level: LogLevel.DEBUG,
    enableConsole: true,
    enableFile: true,
    logDirectory: path.join(process.cwd(), 'logs'),
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 3,
    datePattern: 'YYYY-MM-DD',
    format: 'text' as const,
    includeStackTrace: true,
    enableColors: true
  } as LoggerConfig,

  /**
   * Configuración para producción
   */
  production: {
    level: LogLevel.INFO,
    enableConsole: false,
    enableFile: true,
    logDirectory: path.join(process.cwd(), 'logs'),
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    datePattern: 'YYYY-MM-DD',
    format: 'json' as const,
    includeStackTrace: false,
    enableColors: false
  } as LoggerConfig,

  /**
   * Configuración para testing
   */
  test: {
    level: LogLevel.WARN,
    enableConsole: false,
    enableFile: false,
    logDirectory: path.join(process.cwd(), 'test-logs'),
    maxFileSize: 1 * 1024 * 1024, // 1MB
    maxFiles: 2,
    datePattern: 'YYYY-MM-DD',
    format: 'text' as const,
    includeStackTrace: true,
    enableColors: false
  } as LoggerConfig,

  /**
   * Configuración solo para consola (útil para debugging)
   */
  console: {
    level: LogLevel.DEBUG,
    enableConsole: true,
    enableFile: false,
    logDirectory: '',
    maxFileSize: 0,
    maxFiles: 0,
    datePattern: 'YYYY-MM-DD',
    format: 'text' as const,
    includeStackTrace: true,
    enableColors: true
  } as LoggerConfig,

  /**
   * Configuración silenciosa (solo errores críticos)
   */
  silent: {
    level: LogLevel.FATAL,
    enableConsole: true,
    enableFile: false,
    logDirectory: '',
    maxFileSize: 0,
    maxFiles: 0,
    datePattern: 'YYYY-MM-DD',
    format: 'text' as const,
    includeStackTrace: true,
    enableColors: true
  } as LoggerConfig
};

/**
 * Obtener configuración basada en el entorno
 */
export function getConfigForEnvironment(env?: string): LoggerConfig {
  const environment = env || process.env.NODE_ENV || 'development';
  
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return LoggerConfigs.production;
    
    case 'test':
    case 'testing':
      return LoggerConfigs.test;
    
    case 'development':
    case 'dev':
    default:
      return LoggerConfigs.development;
  }
}

/**
 * Crear configuración personalizada mezclando una base con overrides
 */
export function createCustomConfig(
  baseConfig: keyof typeof LoggerConfigs | LoggerConfig,
  overrides: Partial<LoggerConfig> = {}
): LoggerConfig {
  const base = typeof baseConfig === 'string' 
    ? LoggerConfigs[baseConfig]
    : baseConfig;
  
  return {
    ...base,
    ...overrides
  };
}

/**
 * Validar configuración del logger
 */
export function validateConfig(config: Partial<LoggerConfig>): string[] {
  const errors: string[] = [];
  
  if (config.level !== undefined && (config.level < 0 || config.level > 4)) {
    errors.push('Log level must be between 0 (DEBUG) and 4 (FATAL)');
  }
  
  if (config.maxFileSize !== undefined && config.maxFileSize <= 0) {
    errors.push('Max file size must be greater than 0');
  }
  
  if (config.maxFiles !== undefined && config.maxFiles < 1) {
    errors.push('Max files must be at least 1');
  }
  
  if (config.format && !['json', 'text'].includes(config.format)) {
    errors.push('Format must be either "json" or "text"');
  }
  
  if (config.enableFile && !config.logDirectory) {
    errors.push('Log directory is required when file logging is enabled');
  }
  
  return errors;
}

/**
 * Configuración por defecto del sistema
 */
export const DEFAULT_CONFIG = LoggerConfigs.development;

export default {
  LoggerConfigs,
  getConfigForEnvironment,
  createCustomConfig,
  validateConfig,
  DEFAULT_CONFIG
};