// fileManager.ts - Gestión de archivos simplificada
import fs from 'fs';
import path from 'path';
export class LogFileManager {
    constructor(config) {
        this.config = config;
        this.currentLogFile = null;
        this.currentFileSize = 0;
        if (this.config.enableFile) {
            this.ensureLogDirectory();
        }
    }
    writeToFile(content) {
        if (!this.config.enableFile)
            return;
        try {
            const fileName = this.getCurrentLogFileName();
            if (this.currentLogFile !== fileName) {
                this.currentLogFile = fileName;
                this.currentFileSize = fs.existsSync(fileName) ? fs.statSync(fileName).size : 0;
            }
            if (this.shouldRotateFile()) {
                this.rotateLogFile();
            }
            fs.appendFileSync(this.currentLogFile, content);
            this.currentFileSize += Buffer.byteLength(content, 'utf8');
        }
        catch (error) {
            console.error('Error writing to log file:', error);
        }
    }
    ensureLogDirectory() {
        if (!fs.existsSync(this.config.logDirectory)) {
            fs.mkdirSync(this.config.logDirectory, { recursive: true });
        }
    }
    getCurrentLogFileName() {
        const date = new Date();
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return path.join(this.config.logDirectory, `webrtc-signaling-${dateStr}.log`);
    }
    shouldRotateFile() {
        if (!this.currentLogFile)
            return false;
        try {
            const stats = fs.statSync(this.currentLogFile);
            return stats.size >= this.config.maxFileSize;
        }
        catch {
            return false;
        }
    }
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
}
//# sourceMappingURL=fileManager.js.map