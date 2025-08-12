// config.ts - Configuraciones simplificadas
import { LogLevel,type LoggerConfig } from './types.js';
import path from 'path';

const BASE_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false,
  logDirectory: path.join(process.cwd(), 'logs'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  datePattern: 'YYYY-MM-DD',
  format: 'text',
  includeStackTrace: true,
  enableColors: true
};

export const ENVIRONMENT_CONFIGS: Record<string, Partial<LoggerConfig>> = {
  development: {
    level: LogLevel.DEBUG,
    enableFile: true,
    maxFileSize: 5 * 1024 * 1024,
    maxFiles: 3
  },
  production: {
    level: LogLevel.INFO,
    enableConsole: false,
    enableFile: true,
    maxFileSize: 50 * 1024 * 1024,
    maxFiles: 10,
    format: 'json',
    includeStackTrace: false,
    enableColors: false
  },
  test: {
    level: LogLevel.WARN,
    enableConsole: false,
    enableFile: false
  },
  silent: {
    level: LogLevel.SILENT,
    enableConsole: false,
    enableFile: false
  }
};

export function createConfig(env?: string, overrides: Partial<LoggerConfig> = {}): LoggerConfig {
  const environment = env || process.env.NODE_ENV || 'development';
  const envConfig = ENVIRONMENT_CONFIGS[environment.toLowerCase()] || {};
  
  return {
    ...BASE_CONFIG,
    ...envConfig,
    ...overrides
  };
}