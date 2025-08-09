/**
 * Función de compatibilidad con la implementación anterior
 * Ahora utiliza el nuevo sistema de logging internamente
 *
 * @param config - Configuración (mantenido por compatibilidad, pero no se usa)
 * @param log_event - Identificador del evento
 * @param log_data - Datos a registrar
 */
export declare function pushLogs(config: any, log_event: string, log_data: any): void;
/**
 * Función mejorada que permite especificar el nivel de log
 *
 * @param level - Nivel de log
 * @param event - Identificador del evento
 * @param message - Mensaje descriptivo
 * @param data - Datos adicionales
 * @param context - Contexto adicional
 */
export declare function pushLogsWithLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal', event: string, message: string, data?: any, context?: Record<string, any>): void;
export { getLogger, LogLevel } from './index.js';
export type { LogEntry } from './index.js';
export default pushLogs;
//# sourceMappingURL=pushLogs.d.ts.map