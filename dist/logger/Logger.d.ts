import { EventEmitter } from 'events';
import type { LoggerConfig, LogData } from './types.js';
import { LogLevel } from './types.js';
export declare class Logger extends EventEmitter {
    private formatter;
    private fileManager;
    private config;
    constructor(config?: Partial<LoggerConfig>);
    private log;
    private createLogEntry;
    private writeToConsole;
    debug(event: string, logData?: LogData, ...args: any[]): void;
    info(event: string, logData?: LogData, ...args: any[]): void;
    warn(event: string, logData?: LogData, ...args: any[]): void;
    error(event: string, logData?: LogData | unknown, ...args: any[]): void;
    fatal(event: string, logData?: LogData, ...args: any[]): void;
    updateConfig(newConfig: Partial<LoggerConfig>): void;
    getConfig(): LoggerConfig;
    silence(): void;
    unsilence(level?: LogLevel): void;
    enableConsoleOnly(): void;
    enableFileOnly(): void;
}
export declare function getLogger(config?: Partial<LoggerConfig>): Logger;
//# sourceMappingURL=Logger.d.ts.map