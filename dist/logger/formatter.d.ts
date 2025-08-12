import { LogEntry, LoggerConfig } from './types.js';
export declare class LogFormatter {
    private config;
    constructor(config: LoggerConfig);
    formatForConsole(entry: LogEntry): string;
    formatForFile(entry: LogEntry): string;
    private stringifyData;
}
//# sourceMappingURL=formatter.d.ts.map