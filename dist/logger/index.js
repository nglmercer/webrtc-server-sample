// index.ts - Punto de entrada limpio
import { Logger, getLogger, } from './Logger.js';
export { createConfig, ENVIRONMENT_CONFIGS } from './config.js';
// Logger por defecto
export { Logger, getLogger };
export const defaultLogger = getLogger();
// Funciones de conveniencia
export const log = {
    debug: (event, logData) => defaultLogger.debug(event, logData),
    info: (event, logData) => defaultLogger.info(event, logData),
    warn: (event, logData) => defaultLogger.warn(event, logData),
    error: (event, logData) => defaultLogger.error(event, logData),
    fatal: (event, logData) => defaultLogger.fatal(event, logData),
    // Métodos de control
    silence: () => defaultLogger.silence(),
    unsilence: (level) => defaultLogger.unsilence(level),
    enableConsoleOnly: () => defaultLogger.enableConsoleOnly(),
    enableFileOnly: () => defaultLogger.enableFileOnly()
};
// Función de compatibilidad con pushLogs
export function pushLogs(config, log_event, log_data) {
    const logger = getLogger();
    if (log_data instanceof Error) {
        logger.error(log_event, { message: log_data.message, data: log_data });
    }
    else if (typeof log_data === 'string' && log_data.toLowerCase().includes('error')) {
        logger.error(log_event, { message: log_data });
    }
    else if (typeof log_data === 'string' && log_data.toLowerCase().includes('warn')) {
        logger.warn(log_event, { message: log_data });
    }
    else {
        logger.info(log_event, {
            message: typeof log_data === 'string' ? log_data : 'Event logged',
            data: typeof log_data !== 'string' ? log_data : undefined
        });
    }
}
export default defaultLogger;
//# sourceMappingURL=index.js.map