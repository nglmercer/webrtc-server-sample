# Sistema de Logging Mejorado

Este directorio contiene ejemplos de uso del nuevo sistema de logging implementado para el servidor de señalización WebRTC.

## Características del Sistema

### Niveles de Log
- **DEBUG**: Información detallada para debugging
- **INFO**: Información general del funcionamiento
- **WARN**: Advertencias que no afectan el funcionamiento
- **ERROR**: Errores que pueden afectar funcionalidades
- **FATAL**: Errores críticos que pueden detener el sistema

### Funcionalidades
- ✅ Logging a consola con colores configurables
- ✅ Logging a archivos con rotación automática
- ✅ Múltiples formatos de salida (texto y JSON)
- ✅ Configuraciones predefinidas por entorno
- ✅ Limpieza automática de archivos antiguos
- ✅ Contexto adicional para cada log
- ✅ Compatibilidad con la función `pushLogs` original

## Archivos de Ejemplo

### `basic-usage.js`
Ejemplo básico de uso del sistema de logging con diferentes niveles y configuraciones.

### `custom-config.js`
Ejemplo de configuración personalizada del logger para diferentes entornos.

### `integration-example.js`
Ejemplo de integración del nuevo sistema con el servidor de señalización existente.

### `monitoring-example.js`
Ejemplo de monitoreo y análisis de logs en tiempo real.

## Uso Rápido

```javascript
// Importar el logger
import { getLogger, LogLevel } from '../src/logger';

// Crear instancia con configuración por defecto
const logger = getLogger();

// Usar diferentes niveles
logger.info('USER_CONNECTED', 'Usuario conectado exitosamente', { userId: '123', room: 'sala1' });
logger.warn('HIGH_MEMORY_USAGE', 'Uso de memoria alto detectado', { usage: '85%' });
logger.error('CONNECTION_FAILED', 'Error al conectar con cliente', error);
```

## Configuración por Entorno

```javascript
import { getConfigForEnvironment } from '../src/logger';

// Desarrollo: logs detallados a consola y archivo
const devLogger = getLogger(getConfigForEnvironment('development'));

// Producción: logs optimizados solo a archivo
const prodLogger = getLogger(getConfigForEnvironment('production'));
```

## Migración desde pushLogs

El sistema mantiene compatibilidad completa con la función `pushLogs` original:

```javascript
// Código existente sigue funcionando
pushLogs(config, 'EVENT_NAME', data);

// Pero ahora también puedes usar la versión mejorada
pushLogsWithLevel('error', 'EVENT_NAME', 'Descripción del error', data, context);
```