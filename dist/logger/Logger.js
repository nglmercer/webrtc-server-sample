// logger.ts - Logger principal simplificado
import { EventEmitter } from 'events';
import { LogLevel } from './types.js';
import { LogFormatter } from './formatter.js';
import { LogFileManager } from './fileManager.js';
import { createConfig } from './config.js';
export class Logger extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = createConfig(process.env.NODE_ENV, config);
        this.formatter = new LogFormatter(this.config);
        this.fileManager = new LogFileManager(this.config);
    }
    // Método principal de logging - elimina duplicación
    log(level, event, logData = {}, ...args) {
        // Si el logger está en modo silencioso o el nivel no permite el log, no hacer nada
        if (this.config.level === LogLevel.SILENT || level < this.config.level) {
            return;
        }
        const entry = this.createLogEntry(level, event, logData);
        // Emitir evento para listeners externos
        this.emit('log', entry, ...args);
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
    createLogEntry(level, event, logData = {}) {
        const { message = '', data, context } = logData;
        const entry = {
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
            }
            else {
                entry.data = data;
            }
        }
        return entry;
    }
    writeToConsole(entry) {
        const formatted = this.formatter.formatForConsole(entry);
        const level = LogLevel[entry.level];
        if (level >= LogLevel.ERROR) {
            console.error(formatted);
        }
        else {
            console.log(formatted);
        }
    }
    // Métodos públicos - todos usan el método log privado
    debug(event, logData, ...args) {
        this.log(LogLevel.DEBUG, event, logData, ...args);
    }
    info(event, logData, ...args) {
        this.log(LogLevel.INFO, event, logData, ...args);
    }
    warn(event, logData, ...args) {
        this.log(LogLevel.WARN, event, logData, ...args);
    }
    error(event, logData, ...args) {
        this.log(LogLevel.ERROR, event, logData, ...args);
    }
    fatal(event, logData, ...args) {
        this.log(LogLevel.FATAL, event, logData, ...args);
    }
    // Métodos de configuración
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.formatter = new LogFormatter(this.config);
        this.fileManager = new LogFileManager(this.config);
    }
    getConfig() {
        return { ...this.config };
    }
    // Métodos de utilidad
    silence() {
        this.updateConfig({ level: LogLevel.SILENT, enableConsole: false });
    }
    unsilence(level = LogLevel.INFO) {
        this.updateConfig({ level, enableConsole: true });
    }
    enableConsoleOnly() {
        this.updateConfig({ enableConsole: true, enableFile: false });
    }
    enableFileOnly() {
        this.updateConfig({ enableConsole: false, enableFile: true });
    }
}
// Instancia singleton
let globalLogger = null;
export function getLogger(config) {
    if (!globalLogger) {
        globalLogger = new Logger(config);
    }
    else if (config) {
        globalLogger.updateConfig(config);
    }
    return globalLogger;
}
//# sourceMappingURL=Logger.js.map