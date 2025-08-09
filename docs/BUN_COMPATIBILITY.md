# Compatibilidad con Bun

## Problema Identificado

El error que estás experimentando:

```
TypeError: undefined is not an object (evaluating 'http')
    at abortHandshake (ws:474:14)
```

Ocurre porque **Bun no es completamente compatible con la librería `ws` de Node.js**. <mcreference link="https://bun.sh/docs/api/websockets" index="1">1</mcreference>

### ¿Por qué sucede esto?

1. **Diferencias en la implementación**: Bun tiene su propia implementación nativa de WebSocket que es más eficiente que la librería `ws`
2. **APIs no implementadas**: Algunas funciones internas de la librería `ws` no están disponibles en Bun <mcreference link="https://github.com/oven-sh/bun/issues/3202" index="4">4</mcreference>
3. **Módulos internos**: La librería `ws` depende de módulos internos de Node.js que Bun maneja de manera diferente

## Solución: Usar WebSocket Nativo de Bun

### 1. Servidor Optimizado para Bun

Hemos creado `examples/server-bun.js` que utiliza la implementación nativa de WebSocket de Bun:

```javascript
// Usar Bun.serve en lugar de la librería 'ws'
const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const success = server.upgrade(req);
      if (success) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    return new Response('Use Socket.IO endpoint', { status: 404 });
  },
  websocket: {
    open(ws) { /* manejar conexión */ },
    message(ws, message) { /* manejar mensajes */ },
    close(ws, code, reason) { /* manejar cierre */ },
    error(ws, error) { /* manejar errores */ }
  }
});
```

### 2. Adaptador Específico para Bun

Creamos `BunWebSocketAdapter` que implementa la misma interfaz `ISocket` pero usando las APIs nativas de Bun:

```typescript
import { BunWebSocketAdapter } from '../src/adapters/BunWebSocketAdapter';

// En el handler de WebSocket
websocket: {
  open(ws) {
    const adapter = new BunWebSocketAdapter(ws);
    signalingServer.handleConnection(adapter);
  }
}
```

## Ventajas de Usar Bun Nativo

### Rendimiento Superior
- **7x más throughput**: Bun puede manejar 7x más requests por segundo que Node.js + "ws" <mcreference link="https://bun.sh/docs/api/websockets" index="1">1</mcreference>
- **Menor latencia**: Implementación nativa optimizada
- **Menos overhead**: Sin capas de abstracción adicionales

### Características Nativas
- **Pub/Sub integrado**: Sistema de publish-subscribe nativo
- **Compresión automática**: Compresión on-the-fly
- **Soporte TLS**: TLS nativo sin configuración adicional

## Cómo Migrar

### Paso 1: Usar el Servidor Optimizado

```bash
# En lugar de usar el servidor original
bun examples/server.js  # ❌ Causa el error

# Usar el servidor optimizado para Bun
bun examples/server-bun.js  # ✅ Funciona correctamente
```

### Paso 2: Actualizar Imports (si es necesario)

```typescript
// Cambiar de:
import { WebSocketAdapter } from '../src/adapters/WebSocketAdapter';

// A:
import { BunWebSocketAdapter } from '../src/adapters/BunWebSocketAdapter';
```

### Paso 3: Verificar Funcionalidad

Ambos adaptadores implementan la misma interfaz `ISocket`, por lo que toda la funcionalidad del servidor de señalización funciona igual:

- ✅ Manejo de salas
- ✅ Gestión de usuarios
- ✅ Heartbeat
- ✅ Logging
- ✅ Eventos de conexión/desconexión

## Compatibilidad Dual

El proyecto mantiene compatibilidad con ambos runtimes:

| Runtime | Servidor | Adaptador | Estado |
|---------|----------|-----------|--------|
| Node.js | `examples/server.js` | `WebSocketAdapter` | ✅ Funcional |
| Bun | `examples/server-bun.js` | `BunWebSocketAdapter` | ✅ Funcional |

## Endpoints Disponibles

Con el servidor optimizado para Bun:

```
🚀 Servidor WebRTC ejecutándose en puerto 3000
📡 Socket.IO: Puerto 3001
🔌 WebSocket nativo: Puerto 3000/ws
💓 Heartbeat: Habilitado

📋 Endpoints disponibles:
   • ws://localhost:3001/socket.io/ - Socket.IO
   • ws://localhost:3000/ws - WebSocket nativo
```

## Troubleshooting

### Error: "http is undefined"
**Causa**: Usando librería `ws` con Bun  
**Solución**: Usar `server-bun.js` en lugar de `server.js`

### Error: "WebSocket upgrade failed"
**Causa**: Configuración incorrecta del endpoint  
**Solución**: Verificar que la ruta sea `/ws` exactamente

### Error: "BunWebSocketAdapter not found"
**Causa**: Import incorrecto  
**Solución**: Verificar que el archivo esté compilado con `npm run build`

## Recomendaciones

1. **Para desarrollo con Bun**: Usar siempre `server-bun.js`
2. **Para producción**: Considerar Bun para mejor rendimiento
3. **Para compatibilidad**: Mantener ambas implementaciones
4. **Para testing**: Probar con ambos runtimes

## Referencias

- [Documentación oficial de WebSockets en Bun](https://bun.sh/docs/api/websockets)
- [Issues conocidos con la librería ws en Bun](https://github.com/oven-sh/bun/issues/3202)
- [Comparativa de rendimiento](https://bun.sh/docs/api/websockets#performance)