// custom-config.js - Ejemplo de configuraciones personalizadas del logger

const { 
  getLogger, 
  LogLevel, 
  LoggerConfigs, 
  getConfigForEnvironment,
  createCustomConfig,
  validateConfig 
} = require('../../src/logger');

console.log('=== Configuraciones Personalizadas del Logger ===\n');

// Ejemplo 1: Configuraciones predefinidas por entorno
console.log('1. Configuraciones por entorno:');

const environments = ['development', 'production', 'test', 'console', 'silent'];

environments.forEach(env => {
  const config = getConfigForEnvironment(env);
  console.log(`   ${env}:`, {
    level: LogLevel[config.level],
    console: config.enableConsole,
    file: config.enableFile,
    format: config.format
  });
});

// Ejemplo 2: Logger para desarrollo con configuración personalizada
console.log('\n2. Logger para desarrollo:');

const devLogger = getLogger(createCustomConfig('development', {
  logDirectory: './logs/dev',
  maxFileSize: 2 * 1024 * 1024, // 2MB
  maxFiles: 5,
  includeStackTrace: true
}));

devLogger.debug('DEV_START', 'Logger de desarrollo iniciado');
devLogger.info('DEV_CONFIG', 'Configuración aplicada', devLogger.getConfig());

// Ejemplo 3: Logger para producción
console.log('\n3. Logger para producción:');

const prodLogger = getLogger(createCustomConfig('production', {
  logDirectory: './logs/prod',
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 20,
  enableConsole: false, // Solo archivo en producción
  format: 'json'
}));

prodLogger.info('PROD_START', 'Sistema en producción iniciado');
prodLogger.warn('PROD_WARNING', 'Advertencia en producción', { 
  component: 'signaling-server',
  severity: 'medium'
});

// Ejemplo 4: Logger para debugging intensivo
console.log('\n4. Logger para debugging:');

const debugLogger = getLogger({
  level: LogLevel.DEBUG,
  enableConsole: true,
  enableFile: true,
  logDirectory: './logs/debug',
  format: 'text',
  enableColors: true,
  includeStackTrace: true,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 3
});

debugLogger.debug('DEBUG_TRACE', 'Información detallada de debugging', {
  function: 'custom-config.js',
  line: 65,
  variables: { x: 10, y: 20, result: 30 }
});

// Ejemplo 5: Logger para monitoreo de performance
console.log('\n5. Logger para performance:');

const perfLogger = getLogger({
  level: LogLevel.INFO,
  enableConsole: false,
  enableFile: true,
  logDirectory: './logs/performance',
  format: 'json', // JSON para análisis automatizado
  enableColors: false,
  includeStackTrace: false,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 10
});

// Simular métricas de performance
const performanceMetrics = {
  responseTime: 150,
  memoryUsage: process.memoryUsage(),
  activeConnections: 45,
  messagesPerSecond: 120
};

perfLogger.info('PERFORMANCE_METRICS', 'Métricas de rendimiento', performanceMetrics);

// Ejemplo 6: Logger con validación de configuración
console.log('\n6. Validación de configuración:');

const invalidConfig = {
  level: 10, // Inválido
  maxFileSize: -1, // Inválido
  format: 'xml', // Inválido
  enableFile: true,
  logDirectory: '' // Inválido cuando enableFile es true
};

const validationErrors = validateConfig(invalidConfig);
if (validationErrors.length > 0) {
  console.log('   ❌ Errores de configuración encontrados:');
  validationErrors.forEach(error => console.log(`      - ${error}`));
} else {
  console.log('   ✅ Configuración válida');
}

// Configuración corregida
const validConfig = {
  level: LogLevel.INFO,
  maxFileSize: 10 * 1024 * 1024,
  format: 'json',
  enableFile: true,
  logDirectory: './logs/valid'
};

const validationErrors2 = validateConfig(validConfig);
console.log('   ✅ Configuración corregida:', validationErrors2.length === 0 ? 'Válida' : 'Inválida');

// Ejemplo 7: Logger con rotación frecuente (para testing)
console.log('\n7. Logger con rotación frecuente:');

const rotationLogger = getLogger({
  level: LogLevel.DEBUG,
  enableConsole: true,
  enableFile: true,
  logDirectory: './logs/rotation-test',
  maxFileSize: 1024, // 1KB para forzar rotación rápida
  maxFiles: 3,
  format: 'text'
});

// Generar logs para forzar rotación
for (let i = 0; i < 10; i++) {
  rotationLogger.info('ROTATION_TEST', `Mensaje de prueba ${i + 1}`, {
    iteration: i + 1,
    timestamp: Date.now(),
    data: 'A'.repeat(100) // Datos para aumentar el tamaño
  });
}

console.log('   📁 Revisa ./logs/rotation-test/ para ver los archivos rotados');

// Ejemplo 8: Logger con eventos personalizados
console.log('\n8. Logger con eventos personalizados:');

const eventLogger = getLogger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false
});

// Contador de logs por nivel
const logCounts = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 };

eventLogger.on('log', (entry) => {
  logCounts[entry.level]++;
  
  if (entry.level === 'ERROR' || entry.level === 'FATAL') {
    console.log(`🚨 Alerta: ${entry.level} detectado - ${entry.event}`);
  }
});

// Generar diferentes tipos de logs
eventLogger.info('EVENT_TEST', 'Mensaje informativo');
eventLogger.warn('EVENT_TEST', 'Mensaje de advertencia');
eventLogger.error('EVENT_TEST', 'Mensaje de error');
eventLogger.info('EVENT_TEST', 'Otro mensaje informativo');

console.log('   📊 Conteo de logs:', logCounts);

// Ejemplo 9: Configuración dinámica
console.log('\n9. Configuración dinámica:');

const dynamicLogger = getLogger({ level: LogLevel.ERROR });

console.log('   Nivel inicial: ERROR');
dynamicLogger.info('DYNAMIC_TEST', 'Este mensaje NO se mostrará (nivel INFO < ERROR)');
dynamicLogger.error('DYNAMIC_TEST', 'Este mensaje SÍ se mostrará (nivel ERROR)');

// Cambiar configuración dinámicamente
dynamicLogger.updateConfig({ level: LogLevel.DEBUG });
console.log('   Nivel actualizado: DEBUG');

dynamicLogger.debug('DYNAMIC_TEST', 'Ahora este mensaje SÍ se mostrará (nivel DEBUG)');
dynamicLogger.info('DYNAMIC_TEST', 'Y este también (nivel INFO)');

console.log('\n✅ Ejemplos de configuración completados.');
console.log('📁 Revisa los directorios ./logs/ para ver los archivos generados.');