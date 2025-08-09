// index.ts - Punto de entrada del módulo de logging
export { Logger, LogLevel, getLogger, pushLogs } from './Logger.js';
export { LoggerConfigs, getConfigForEnvironment, createCustomConfig, validateConfig, DEFAULT_CONFIG } from './config.js';
// Exportar instancia por defecto configurada para el entorno actual
import { getLogger } from './Logger.js';
import { getConfigForEnvironment } from './config.js';
/**
 * Logger por defecto configurado automáticamente según el entorno
 */
export const defaultLogger = getLogger(getConfigForEnvironment());
/**
 * Funciones de conveniencia que usan el logger por defecto
 */
export const log = {
    debug: (event, message, data, context) => defaultLogger.debug(event, message, data, context),
    info: (event, message, data, context) => defaultLogger.info(event, message, data, context),
    warn: (event, message, data, context) => defaultLogger.warn(event, message, data, context),
    error: (event, message, data, context) => defaultLogger.error(event, message, data, context),
    fatal: (event, message, data, context) => defaultLogger.fatal(event, message, data, context)
};
export const logger = getLogger();
export default defaultLogger;
//# sourceMappingURL=index.js.map