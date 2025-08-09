import { EventEmitter } from 'events';
/**
 * Niveles de log disponibles
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
}
/**
 * Configuración del logger
 */
export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    logDirectory: string;
    maxFileSize: number;
    maxFiles: number;
    datePattern: string;
    format: 'json' | 'text';
    includeStackTrace: boolean;
    enableColors: boolean;
}
/**
 * Entrada de log
 */
export interface LogEntry {
    timestamp: string;
    level: string;
    event: string;
    message: string;
    data?: any;
    stack?: string;
    context?: Record<string, any>;
    [key: string]: any;
}
/**
 * Logger principal del sistema
 */
interface LogInfo {
    message?: string;
    data?: any;
    context?: Record<string, any>;
    [key: string]: any;
}
export declare class Logger extends EventEmitter {
    private config;
    private currentLogFile;
    private currentFileSize;
    constructor(config?: Partial<LoggerConfig>);
    /**
     * Asegurar que el directorio de logs existe
     */
    private ensureLogDirectory;
    /**
     * Obtener el nombre del archivo de log actual
     */
    private getCurrentLogFileName;
    /**
     * Formatear fecha según el patrón configurado
     */
    private formatDate;
    /**
     * Verificar si necesitamos rotar el archivo de log
     */
    private shouldRotateFile;
    /**
     * Rotar archivos de log
     */
    private rotateLogFile;
    /**
     * Limpiar archivos de log antiguos
     */
    private cleanOldLogFiles;
    /**
     * Crear entrada de log
     */
    private createLogEntry;
    /**
     * Formatear entrada de log para consola
     */
    private formatConsoleEntry;
    /**
     * Formatear entrada de log para archivo
     */
    private formatFileEntry;
    /**
     * Escribir entrada de log
     */
    private writeLog;
    /**
     * Escribir entrada a archivo
     */
    private writeToFile;
    /**
     * Métodos públicos de logging
     */
    debug(event: string, { message, data, context }: LogInfo | any, ...args: any[]): void;
    info(event: string, { message, data, context }: LogInfo | any, ...args: any[]): void;
    warn(event: string, { message, data, context }: LogInfo | any, ...args: any[]): void;
    error(event: string, { message, data, context }: LogInfo | any, ...args: any[]): void;
    fatal(event: string, { message, data, context }: LogInfo | any, ...args: any[]): void;
    /**
     * Método de compatibilidad con pushLogs original
     */
    log(event: string, { message, data, context }: LogInfo | any, ...args: any[]): void;
    /**
     * Actualizar configuración
     */
    updateConfig(newConfig: Partial<LoggerConfig>): void;
    /**
     * Obtener configuración actual
     */
    getConfig(): LoggerConfig;
    /**
     * Obtener estadísticas del logger
     */
    getStats(): Record<string, any>;
    /**
     * Cerrar el logger y limpiar recursos
     */
    close(): void;
}
/**
 * Obtener o crear la instancia global del logger
 */
export declare function getLogger(config?: Partial<LoggerConfig>): Logger;
/**
 * Función de compatibilidad con pushLogs original
 */
export declare function pushLogs(config: any, log_event: string, log_data: any): void;
export default Logger;
//# sourceMappingURL=Logger.d.ts.map