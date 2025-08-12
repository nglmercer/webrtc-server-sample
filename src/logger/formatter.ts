// formatter.ts - Formatters centralizados
import { LogEntry, LoggerConfig } from './types.js';

const COLORS = {
  DEBUG: '\x1b[36m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  FATAL: '\x1b[35m',
  RESET: '\x1b[0m'
};

export class LogFormatter {
  constructor(private config: LoggerConfig) {}

  formatForConsole(entry: LogEntry): string {
    const color = this.config.enableColors ? COLORS[entry.level as keyof typeof COLORS] : '';
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

  formatForFile(entry: LogEntry): string {
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

  private stringifyData(data: any): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }
}
