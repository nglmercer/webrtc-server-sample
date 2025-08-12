// types.ts - Tipos centralizados
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
    LogLevel[LogLevel["SILENT"] = 5] = "SILENT"; // Nuevo nivel para ocultar todos los logs
})(LogLevel || (LogLevel = {}));
//# sourceMappingURL=types.js.map