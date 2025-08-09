// Logger.ts - Sistema de logging mejorado
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
/**
 * Niveles de log disponibles
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
})(LogLevel || (LogLevel = {}));
/**
 * Colores para la consola
 */
const COLORS = {
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m', // Green
    WARN: '\x1b[33m', // Yellow
    ERROR: '\x1b[31m', // Red
    FATAL: '\x1b[35m', // Magenta
    RESET: '\x1b[0m'
};
export class Logger extends EventEmitter {
    constructor(config = {}) {
        super();
        this.currentLogFile = null;
        this.currentFileSize = 0;
        // Configuración por defecto
        this.config = {
            level: LogLevel.INFO,
            enableConsole: true,
            enableFile: false,
            logDirectory: './logs',
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            datePattern: 'YYYY-MM-DD',
            format: 'text',
            includeStackTrace: true,
            enableColors: true,
            ...config
        };
        // Crear directorio de logs si no existe
        if (this.config.enableFile) {
            this.ensureLogDirectory();
        }
    }
    /**
     * Asegurar que el directorio de logs existe
     */
    ensureLogDirectory() {
        if (!fs.existsSync(this.config.logDirectory)) {
            fs.mkdirSync(this.config.logDirectory, { recursive: true });
        }
    }
    /**
     * Obtener el nombre del archivo de log actual
     */
    getCurrentLogFileName() {
        const date = new Date();
        const dateStr = this.formatDate(date);
        return path.join(this.config.logDirectory, `webrtc-signaling-${dateStr}.log`);
    }
    /**
     * Formatear fecha según el patrón configurado
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * Verificar si necesitamos rotar el archivo de log
     */
    shouldRotateFile() {
        if (!this.currentLogFile)
            return false;
        try {
            const stats = fs.statSync(this.currentLogFile);
            return stats.size >= this.config.maxFileSize;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Rotar archivos de log
     */
    rotateLogFile() {
        if (!this.currentLogFile)
            return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedName = this.currentLogFile.replace('.log', `-${timestamp}.log`);
        try {
            fs.renameSync(this.currentLogFile, rotatedName);
            this.cleanOldLogFiles();
            this.currentFileSize = 0;
        }
        catch (error) {
            console.error('Error rotating log file:', error);
        }
    }
    /**
     * Limpiar archivos de log antiguos
     */
    cleanOldLogFiles() {
        try {
            const files = fs.readdirSync(this.config.logDirectory)
                .filter(file => file.startsWith('webrtc-signaling-') && file.endsWith('.log'))
                .map(file => ({
                name: file,
                path: path.join(this.config.logDirectory, file),
                stats: fs.statSync(path.join(this.config.logDirectory, file))
            }))
                .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
            // Eliminar archivos que excedan el límite
            if (files.length > this.config.maxFiles) {
                const filesToDelete = files.slice(this.config.maxFiles);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                    }
                    catch (error) {
                        console.error(`Error deleting old log file ${file.name}:`, error);
                    }
                });
            }
        }
        catch (error) {
            console.error('Error cleaning old log files:', error);
        }
    }
    /**
     * Crear entrada de log
     */
    createLogEntry(level, event, { message, data, context }, ...args) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: LogLevel[level],
            event,
            message: message || '',
            context,
            ...args
        };
        if (data !== undefined) {
            if (data instanceof Error) {
                entry.message = data.message;
                if (this.config.includeStackTrace) {
                    entry.stack = data.stack;
                }
            }
            else {
                entry.data = data;
            }
        }
        return entry;
    }
    /**
     * Formatear entrada de log para consola
     */
    formatConsoleEntry(entry) {
        const color = this.config.enableColors ? COLORS[entry.level] : '';
        const reset = this.config.enableColors ? COLORS.RESET : '';
        const timestamp = new Date(entry.timestamp).toLocaleString();
        let formatted = `${color}[${timestamp}] ${entry.level} [${entry.event}] ${entry.message}${reset}`;
        if (entry.data) {
            try {
                formatted += `\n${color}Data: ${JSON.stringify(entry.data, null, 2)}${reset}`;
            }
            catch (error) {
                formatted += `\n${color}Data: ${entry.data}${reset}`;
            }
        }
        if (entry.stack) {
            formatted += `\n${color}Stack: ${entry.stack}${reset}`;
        }
        if (entry.context && Object.keys(entry.context).length > 0) {
            formatted += `\n${color}Context: ${JSON.stringify(entry.context, null, 2)}${reset}`;
        }
        return formatted;
    }
    /**
     * Formatear entrada de log para archivo
     */
    formatFileEntry(entry) {
        if (this.config.format === 'json') {
            return JSON.stringify(entry) + '\n';
        }
        else {
            const timestamp = new Date(entry.timestamp).toLocaleString();
            let formatted = `[${timestamp}] ${entry.level} [${entry.event}] ${entry.message}`;
            if (entry.data) {
                try {
                    formatted += ` | Data: ${JSON.stringify(entry.data)}`;
                }
                catch (error) {
                    formatted += ` | Data: ${entry.data}`;
                }
            }
            if (entry.stack) {
                formatted += ` | Stack: ${entry.stack.replace(/\n/g, ' ')}`;
            }
            if (entry.context && Object.keys(entry.context).length > 0) {
                formatted += ` | Context: ${JSON.stringify(entry.context)}`;
            }
            return formatted + '\n';
        }
    }
    /**
     * Escribir entrada de log
     */
    writeLog(level, event, { message, data, context }, ...args) {
        // Verificar si el nivel de log está habilitado
        if (level < this.config.level) {
            return;
        }
        const entry = this.createLogEntry(level, event, { message, data, context }, ...args);
        // Emitir evento para listeners externos
        this.emit('log', entry);
        // Log a consola
        if (this.config.enableConsole) {
            const formatted = this.formatConsoleEntry(entry);
            if (level >= LogLevel.ERROR) {
                console.error(formatted);
            }
            else {
                console.log(formatted);
            }
        }
        // Log a archivo
        if (this.config.enableFile) {
            this.writeToFile(entry);
        }
    }
    /**
     * Escribir entrada a archivo
     */
    writeToFile(entry) {
        try {
            const fileName = this.getCurrentLogFileName();
            // Verificar si necesitamos cambiar de archivo o rotar
            if (this.currentLogFile !== fileName) {
                this.currentLogFile = fileName;
                this.currentFileSize = fs.existsSync(fileName) ? fs.statSync(fileName).size : 0;
            }
            // Verificar si necesitamos rotar
            if (this.shouldRotateFile()) {
                this.rotateLogFile();
                this.currentLogFile = fileName;
            }
            const formatted = this.formatFileEntry(entry);
            fs.appendFileSync(this.currentLogFile, formatted);
            this.currentFileSize += Buffer.byteLength(formatted, 'utf8');
        }
        catch (error) {
            console.error('Error writing to log file:', error);
        }
    }
    /**
     * Métodos públicos de logging
     */
    debug(event, { message, data, context }, ...args) {
        this.writeLog(LogLevel.DEBUG, event, { message, data, context }, ...args);
    }
    info(event, { message, data, context }, ...args) {
        this.writeLog(LogLevel.INFO, event, { message, data, context }, ...args);
    }
    warn(event, { message, data, context }, ...args) {
        this.writeLog(LogLevel.WARN, event, { message, data, context }, ...args);
    }
    error(event, { message, data, context }, ...args) {
        this.writeLog(LogLevel.ERROR, event, { message, data, context }, ...args);
    }
    fatal(event, { message, data, context }, ...args) {
        this.writeLog(LogLevel.FATAL, event, { message, data, context }, ...args);
    }
    /**
     * Método de compatibilidad con pushLogs original
     */
    log(event, { message, data, context }, ...args) {
        if (data instanceof Error) {
            this.error(event, { message: data.message }, data);
        }
        else {
            this.info(event, { message, data, context }, ...args);
        }
    }
    /**
     * Actualizar configuración
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.config.enableFile) {
            this.ensureLogDirectory();
        }
    }
    /**
     * Obtener configuración actual
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Obtener estadísticas del logger
     */
    getStats() {
        const stats = {
            config: this.getConfig(),
            currentLogFile: this.currentLogFile,
            currentFileSize: this.currentFileSize
        };
        if (this.config.enableFile && this.config.logDirectory) {
            try {
                const files = fs.readdirSync(this.config.logDirectory)
                    .filter(file => file.startsWith('webrtc-signaling-') && file.endsWith('.log'));
                stats.logFiles = files.length;
                stats.totalLogSize = files.reduce((total, file) => {
                    try {
                        const filePath = path.join(this.config.logDirectory, file);
                        return total + fs.statSync(filePath).size;
                    }
                    catch {
                        return total;
                    }
                }, 0);
            }
            catch (error) {
                stats.error = 'Could not read log directory';
            }
        }
        return stats;
    }
    /**
     * Cerrar el logger y limpiar recursos
     */
    close() {
        this.removeAllListeners();
    }
}
// Instancia global del logger
let globalLogger = null;
/**
 * Obtener o crear la instancia global del logger
 */
export function getLogger(config) {
    if (!globalLogger) {
        globalLogger = new Logger(config);
    }
    else if (config) {
        globalLogger.updateConfig(config);
    }
    return globalLogger;
}
/**
 * Función de compatibilidad con pushLogs original
 */
export function pushLogs(config, log_event, log_data) {
    const logger = getLogger();
    logger.log(log_event, log_data);
}
export default Logger;
//# sourceMappingURL=Logger.js.map