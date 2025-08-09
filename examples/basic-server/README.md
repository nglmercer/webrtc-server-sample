# Ejemplo: Servidor Básico

Este ejemplo muestra cómo configurar un servidor de señalización WebRTC básico con configuración mínima.

## Características

- Configuración simple del servidor
- Soporte para Socket.IO y WebSocket nativo
- Logging básico
- Gestión de salas y usuarios

## Instalación

```bash
npm install
```

## Uso

### Con Socket.IO

```bash
npm run start:socketio
```

### Con WebSocket Nativo

```bash
npm run start:websocket
```

## Configuración

Edita `config.js` para personalizar:

- Puerto del servidor
- Configuración de CORS
- Opciones de logging
- Límites de salas y usuarios

## Archivos

- `server-socketio.js` - Servidor con Socket.IO
- `server-websocket.js` - Servidor con WebSocket nativo
- `config.js` - Configuración del servidor
- `package.json` - Dependencias y scripts

## Pruebas

Abre `http://localhost:3000` en tu navegador para probar la conexión.