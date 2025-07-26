### ws example

```js
// ARCHIVO DE PRUEBA DE WEBRTC
import express from 'express';
import http from 'http';
// 1. Importa WebSocketServer desde la librería 'ws'
import { WebSocketServer } from 'ws'; 
import { defaultSignal, WebSocketAdapter } from './index';

const app = express();
const httpServer = http.createServer(app);

app.use(express.static('public'));
const PORT = process.env.PORT || 9001;

// 2. Crea una instancia del servidor de WebSockets (WSS)
//    y asócialo al servidor HTTP existente.
const wss = new WebSocketServer({ server: httpServer });

// 3. Escucha el evento 'connection' del servidor de WebSockets
wss.on('connection', (ws, request) => {
    // ws: es el socket nativo de la librería 'ws'
    // request: es la petición HTTP de upgrade a WebSocket

    console.log(`\n[Server] New WebSocket client connected.`);

    // 4. Aquí ocurre la "magia": creamos una instancia de tu adaptador.
    //    Le pasamos el socket nativo (ws) y la petición (request) para que
    //    pueda extraer el ID y los query params.
    const adaptedSocket = new WebSocketAdapter(ws, request);

    // 5. Ahora le pasamos el socket "adaptado" a tu lógica de señalización.
    //    Tu SignalingServer trabajará con `adaptedSocket` sin saber que por debajo
    //    hay un WebSocket nativo, porque el adaptador imita la API que necesita.
    defaultSignal.handleConnection(adaptedSocket);
    
    // El logging y el manejo de la desconexión ya están dentro de SignalingServer
    // y del WebSocketAdapter, por lo que no necesitas añadir más lógica aquí.
});

// El intervalo para depuración es útil, lo mantenemos
setInterval(() => {
    console.log('--- Server State ---');
    console.log('Active Rooms:', defaultSignal.getRooms());
    console.log('Connected Users:', defaultSignal.getUsers());
    console.log('--------------------');
}, 15000);


httpServer.listen(PORT, () => {
    console.log(`✅ Test server with ws running at http://localhost:${PORT}`);
});
```