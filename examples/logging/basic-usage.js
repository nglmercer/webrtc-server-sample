// basic-usage.js - Ejemplo básico del sistema de logging

const { getLogger, LogLevel, log } = require('../../src/logger');

// Ejemplo 1: Uso básico con logger por defecto
console.log('=== Ejemplo 1: Logger por defecto ===');

// Usar las funciones de conveniencia
log.info('SYSTEM_START', 'Sistema iniciado correctamente');
log.debug('CONFIG_LOADED', 'Configuración cargada', { 
  port: 3000, 
  environment: 'development' 
});
log.warn('HIGH_MEMORY', 'Uso de memoria alto detectado', { usage: '85%' });

// Simular un error
try {
  throw new Error('Error de ejemplo para demostración');
} catch (error) {
  log.error('DEMO_ERROR', 'Error capturado en el ejemplo', error);
}

// Ejemplo 2: Logger personalizado
console.log('\n=== Ejemplo 2: Logger personalizado ===');

const customLogger = getLogger({
  level: LogLevel.DEBUG,
  enableConsole: true,
  enableFile: true,
  logDirectory: './logs',
  format: 'json',
  enableColors: true
});

customLogger.info('CUSTOM_LOGGER', 'Logger personalizado creado');
customLogger.debug('DEBUG_INFO', 'Información de debugging', {
  timestamp: Date.now(),
  process: process.pid,
  memory: process.memoryUsage()
});

// Ejemplo 3: Logging con contexto
console.log('\n=== Ejemplo 3: Logging con contexto ===');

const sessionContext = {
  sessionId: 'sess_123456',
  userId: 'user_789',
  ip: '192.168.1.100'
};

customLogger.info(
  'USER_ACTION', 
  'Usuario realizó una acción', 
  { action: 'join_room', roomId: 'room_abc' },
  sessionContext
);

customLogger.warn(
  'RATE_LIMIT', 
  'Usuario cerca del límite de rate limiting',
  { requests: 95, limit: 100 },
  sessionContext
);

// Ejemplo 4: Diferentes niveles de log
console.log('\n=== Ejemplo 4: Diferentes niveles ===');

const messages = [
  { level: 'debug', event: 'WEBSOCKET_FRAME', message: 'Frame WebSocket recibido', data: { size: 1024 } },
  { level: 'info', event: 'ROOM_CREATED', message: 'Nueva sala creada', data: { roomId: 'room_123', creator: 'user_456' } },
  { level: 'warn', event: 'SLOW_RESPONSE', message: 'Respuesta lenta detectada', data: { duration: 5000 } },
  { level: 'error', event: 'DB_CONNECTION', message: 'Error de conexión a base de datos', data: new Error('Connection timeout') },
  { level: 'fatal', event: 'SYSTEM_CRASH', message: 'Error crítico del sistema', data: { code: 'FATAL_001' } }
];

messages.forEach(({ level, event, message, data }) => {
  customLogger[level](event, message, data);
});

// Ejemplo 5: Monitoreo de eventos del logger
console.log('\n=== Ejemplo 5: Monitoreo de eventos ===');

const monitorLogger = getLogger({
  level: LogLevel.INFO,
  enableConsole: false, // Solo para demostrar el evento
  enableFile: false
});

// Escuchar eventos de log
monitorLogger.on('log', (entry) => {
  console.log(`📊 Log capturado: [${entry.level}] ${entry.event} - ${entry.message}`);
});

monitorLogger.info('MONITORED_EVENT', 'Este evento será capturado por el listener');
monitorLogger.error('MONITORED_ERROR', 'Este error también será capturado', new Error('Error monitoreado'));

// Ejemplo 6: Estadísticas del logger
console.log('\n=== Ejemplo 6: Estadísticas del logger ===');

const stats = customLogger.getStats();
console.log('📈 Estadísticas del logger:', JSON.stringify(stats, null, 2));

// Ejemplo 7: Compatibilidad con pushLogs
console.log('\n=== Ejemplo 7: Compatibilidad con pushLogs ===');

const { pushLogs, pushLogsWithLevel } = require('../../src/pushLogs');

// Función original (mantiene compatibilidad)
pushLogs({}, 'LEGACY_EVENT', 'Mensaje usando la función original');
pushLogs({}, 'LEGACY_ERROR', new Error('Error usando función original'));

// Nueva función con nivel específico
pushLogsWithLevel('warn', 'NEW_WARNING', 'Advertencia usando nueva función', { detail: 'información adicional' });
pushLogsWithLevel('error', 'NEW_ERROR', 'Error usando nueva función', new Error('Error específico'));

console.log('\n✅ Ejemplos completados. Revisa los archivos de log en ./logs/ si habilitaste el logging a archivo.');