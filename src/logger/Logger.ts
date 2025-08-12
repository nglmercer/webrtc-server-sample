// logger.ts - Logger principal simplificado
import { EventEmitter } from 'events';
import type{  LoggerConfig, LogEntry, LogData } from './types.js';
import { LogLevel } from './types.js';
import { LogFormatter } from './formatter.js';
import { LogFileManager } from './fileManager.js';
import { createConfig } from './config.js';

export class Logger extends EventEmitter {
  private formatter: LogFormatter;
  private fileManager: LogFileManager;
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    super();
    this.config = createConfig(process.env.NODE_ENV, config);
    this.formatter = new LogFormatter(this.config);
    this.fileManager = new LogFileManager(this.config);
  }

  // Método principal de logging - elimina duplicación
  private log(level: LogLevel, event: string, logData: LogData | any = {},...args:any[]): void {
    // Si el logger está en modo silencioso o el nivel no permite el log, no hacer nada
    if (this.config.level === LogLevel.SILENT || level < this.config.level) {
      return;
    }

    const entry = this.createLogEntry(level, event, logData);
    
    // Emitir evento para listeners externos
    this.emit('log', entry,...args);

    // Output a consola
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    // Output a archivo
    if (this.config.enableFile) {
      const formatted = this.formatter.formatForFile(entry);
      this.fileManager.writeToFile(formatted);
    }
  }

  private createLogEntry(level: LogLevel, event: string, logData: LogData | any = {}): LogEntry {
    const { message = '', data, context } = logData;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      event,
      message,
      context
    };

    if (data !== undefined) {
      if (data instanceof Error) {
        entry.message = entry.message || data.message;
        if (this.config.includeStackTrace) {
          entry.stack = data.stack;
        }
      } else {
        entry.data = data;
      }
    }

    return entry;
  }

  private writeToConsole(entry: LogEntry): void {
    const formatted = this.formatter.formatForConsole(entry);
    const level = LogLevel[entry.level as keyof typeof LogLevel] as number;
    
    if (level >= LogLevel.ERROR) {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }

  // Métodos públicos - todos usan el método log privado
  debug(event: string, logData?: LogData,...args: any[]): void {
    this.log(LogLevel.DEBUG, event, logData,...args);
  }

  info(event: string, logData?: LogData,...args: any[]): void {
    this.log(LogLevel.INFO, event, logData,...args);
  }

  warn(event: string, logData?: LogData,...args: any[]): void {
    this.log(LogLevel.WARN, event, logData,...args);
  }

  error(event: string, logData?: LogData | unknown,...args: any[]): void {
    this.log(LogLevel.ERROR, event, logData,...args);
  }

  fatal(event: string, logData?: LogData,...args: any[]): void {
    this.log(LogLevel.FATAL, event, logData,...args);
  }

  // Métodos de configuración
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.formatter = new LogFormatter(this.config);
    this.fileManager = new LogFileManager(this.config);
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  // Métodos de utilidad
  silence(): void {
    this.updateConfig({ level: LogLevel.SILENT, enableConsole: false });
  }

  unsilence(level: LogLevel = LogLevel.INFO): void {
    this.updateConfig({ level, enableConsole: true });
  }

  enableConsoleOnly(): void {
    this.updateConfig({ enableConsole: true, enableFile: false });
  }

  enableFileOnly(): void {
    this.updateConfig({ enableConsole: false, enableFile: true });
  }
}

// Instancia singleton
let globalLogger: Logger | null = null;

export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(config);
  } else if (config) {
    globalLogger.updateConfig(config);
  }
  return globalLogger;
}

