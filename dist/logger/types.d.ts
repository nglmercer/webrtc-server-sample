export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4,
    SILENT = 5
}
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
export interface LogEntry {
    timestamp: string;
    level: string;
    event: string;
    message: string;
    data?: any;
    stack?: string;
    context?: Record<string, any>;
}
export interface LogData {
    message?: string;
    data?: any;
    context?: Record<string, any>;
    [key: string]: any;
}
//# sourceMappingURL=types.d.ts.map