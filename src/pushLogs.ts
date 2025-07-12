// pushLogs.js

/**
 * Registra un evento o error en la consola del servidor.
 * @param {object} config - El objeto de configuración del servidor (actualmente no utilizado).
 * @param {string} log_event - Un identificador para el evento o la función donde se origina el log.
 * @param {any} log_data - Los datos a registrar, típicamente un objeto de error o un mensaje.
 */
function pushLogs(config:any, log_event:string, log_data:any) {
    // Si no hay nada que registrar, no hace nada.
    if (!log_event && !log_data) {
        return;
    }

    const now = new Date();
    const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

    console.error('--------------------');
    console.error(`[${timestamp}]`);
    console.error(`Log Event: ${log_event}`);

    // Si log_data es un objeto de error, imprime su stack para un mejor debugging.
    if (log_data instanceof Error) {
        console.error('Error Details:', log_data.message);
        console.error('Stack Trace:', log_data.stack);
    } else {
        // Si no, simplemente imprime los datos.
        try {
            // Intenta imprimirlo como un objeto formateado si es posible.
            console.error('Log Data:', JSON.stringify(log_data, null, 2));
        } catch (e) {
            // Si no se puede serializar, lo imprime directamente.
            console.error('Log Data:', log_data);
        }
    }
    console.error('--------------------');
}

export default pushLogs;