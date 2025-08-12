import { LoggerConfig } from './types.js';
export declare class LogFileManager {
    private config;
    private currentLogFile;
    private currentFileSize;
    constructor(config: LoggerConfig);
    writeToFile(content: string): void;
    private ensureLogDirectory;
    private getCurrentLogFileName;
    private shouldRotateFile;
    private rotateLogFile;
    private cleanOldLogFiles;
}
//# sourceMappingURL=fileManager.d.ts.map