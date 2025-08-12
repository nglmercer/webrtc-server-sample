// pushLogs.ts - Wrapper de compatibilidad para el nuevo sistema de logging
import { getLogger } from './index.js';
/**
 * Función de compatibilidad con la implementación anterior
 * Ahora utiliza el nuevo sistema de logging internamente
 *
 * @param config - Configuración (mantenido por compatibilidad, pero no se usa)
 * @param log_event - Identificador del evento
 * @param log_data - Datos a registrar
 */
export function pushLogs(config, log_event, log_data) {
    const logger = getLogger();
    // Determinar el nivel de log basado en el tipo de datos
    if (log_data instanceof Error) {
        logger.error(log_event, log_data.message, log_data);
    }
    else if (typeof log_data === 'string' && log_data.toLowerCase().includes('warn')) {
        logger.warn(log_event, { message: log_data });
    }
    else if (typeof log_data === 'string' && log_data.toLowerCase().includes('error')) {
        logger.error(log_event, { message: log_data });
    }
    else {
        logger.info(log_event, { message: log_data });
    }
}
/**
 * Función mejorada que permite especificar el nivel de log
 *
 * @param level - Nivel de log
 * @param event - Identificador del evento
 * @param message - Mensaje descriptivo
 * @param data - Datos adicionales
 * @param context - Contexto adicional
 */
export function pushLogsWithLevel(level, event, message, data, context) {
    const logger = getLogger();
    switch (level) {
        case 'debug':
            logger.debug(event, { message, data, context });
            break;
        case 'info':
            logger.info(event, { message, data, context });
            break;
        case 'warn':
            logger.warn(event, { message, data, context });
            break;
        case 'error':
            logger.error(event, { message, data, context });
            break;
        case 'fatal':
            logger.fatal(event, { message, data, context });
            break;
    }
}
// Exportar también el logger para uso directo
export { getLogger } from './index.js';
export default pushLogs;
//# sourceMappingURL=pushLogs.js.map