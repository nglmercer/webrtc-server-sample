// index.ts - Punto de entrada limpio
import { Logger, getLogger } from "./Logger.js";
import { LogLevel } from "./types.js";
import type { LoggerConfig, LogEntry, LogData } from "./types.js";
export { createConfig, ENVIRONMENT_CONFIGS } from "./config.js";

// Logger por defecto
export {
  Logger,
  LogLevel,
  getLogger,
  type LoggerConfig,
  type LogEntry,
  type LogData,
};

export const defaultLogger = getLogger();

// Funciones de conveniencia
export const log = {
  debug: (event: string, logData?: LogData) =>
    defaultLogger.debug(event, logData),
  info: (event: string, logData?: LogData) =>
    defaultLogger.info(event, logData),
  warn: (event: string, logData?: LogData) =>
    defaultLogger.warn(event, logData),
  error: (event: string, logData?: LogData) =>
    defaultLogger.error(event, logData),
  fatal: (event: string, logData?: LogData) =>
    defaultLogger.fatal(event, logData),

  // Métodos de control
  silence: () => defaultLogger.silence(),
  unsilence: (level?: LogLevel) => defaultLogger.unsilence(level),
  enableConsoleOnly: () => defaultLogger.enableConsoleOnly(),
  enableFileOnly: () => defaultLogger.enableFileOnly(),
};

// Función de compatibilidad con pushLogs
export function pushLogs(config: any, log_event: string, log_data: any): void {
  const logger = getLogger();

  if (log_data instanceof Error) {
    logger.error(log_event, { message: log_data.message, data: log_data });
  } else if (
    typeof log_data === "string" &&
    log_data.toLowerCase().includes("error")
  ) {
    logger.error(log_event, { message: log_data });
  } else if (
    typeof log_data === "string" &&
    log_data.toLowerCase().includes("warn")
  ) {
    logger.warn(log_event, { message: log_data });
  } else {
    logger.info(log_event, {
      message: typeof log_data === "string" ? log_data : "Event logged",
      data: typeof log_data !== "string" ? log_data : undefined,
    });
  }
}

export default defaultLogger;
