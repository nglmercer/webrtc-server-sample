import { Logger, getLogger } from './Logger.js';
import type { LogLevel, LoggerConfig, LogEntry, LogData } from './types.js';
export { createConfig, ENVIRONMENT_CONFIGS } from './config.js';
export { Logger, LogLevel, getLogger, type LoggerConfig, type LogEntry, type LogData };
export declare const defaultLogger: Logger;
export declare const log: {
    debug: (event: string, logData?: LogData) => void;
    info: (event: string, logData?: LogData) => void;
    warn: (event: string, logData?: LogData) => void;
    error: (event: string, logData?: LogData) => void;
    fatal: (event: string, logData?: LogData) => void;
    silence: () => void;
    unsilence: (level?: LogLevel) => void;
    enableConsoleOnly: () => void;
    enableFileOnly: () => void;
};
export declare function pushLogs(config: any, log_event: string, log_data: any): void;
export default defaultLogger;
//# sourceMappingURL=index.d.ts.map