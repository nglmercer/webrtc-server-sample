/**
 * Registra un evento o error en la consola del servidor.
 * @param {object} config - El objeto de configuración del servidor (actualmente no utilizado).
 * @param {string} log_event - Un identificador para el evento o la función donde se origina el log.
 * @param {any} log_data - Los datos a registrar, típicamente un objeto de error o un mensaje.
 */
declare function pushLogs(config: any, log_event: string, log_data: any): void;
export default pushLogs;
