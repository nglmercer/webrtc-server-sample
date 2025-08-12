const COLORS = {
    DEBUG: '\x1b[36m',
    INFO: '\x1b[32m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
    FATAL: '\x1b[35m',
    RESET: '\x1b[0m'
};
export class LogFormatter {
    constructor(config) {
        this.config = config;
    }
    formatForConsole(entry) {
        const color = this.config.enableColors ? COLORS[entry.level] : '';
        const reset = this.config.enableColors ? COLORS.RESET : '';
        const timestamp = new Date(entry.timestamp).toLocaleString();
        let formatted = `${color}[${timestamp}] ${entry.level} [${entry.event}] ${entry.message}${reset}`;
        if (entry.data) {
            formatted += `\n${color}Data: ${this.stringifyData(entry.data)}${reset}`;
        }
        if (entry.stack) {
            formatted += `\n${color}Stack: ${entry.stack}${reset}`;
        }
        if (entry.context && Object.keys(entry.context).length > 0) {
            formatted += `\n${color}Context: ${JSON.stringify(entry.context, null, 2)}${reset}`;
        }
        return formatted;
    }
    formatForFile(entry) {
        if (this.config.format === 'json') {
            return JSON.stringify(entry) + '\n';
        }
        const timestamp = new Date(entry.timestamp).toLocaleString();
        let formatted = `[${timestamp}] ${entry.level} [${entry.event}] ${entry.message}`;
        if (entry.data) {
            formatted += ` | Data: ${this.stringifyData(entry.data)}`;
        }
        if (entry.stack) {
            formatted += ` | Stack: ${entry.stack.replace(/\n/g, ' ')}`;
        }
        if (entry.context && Object.keys(entry.context).length > 0) {
            formatted += ` | Context: ${JSON.stringify(entry.context)}`;
        }
        return formatted + '\n';
    }
    stringifyData(data) {
        try {
            return JSON.stringify(data, null, 2);
        }
        catch {
            return String(data);
        }
    }
}
//# sourceMappingURL=formatter.js.map