# RTCMultiConnection Signaling Server – Especificación y Documentación

## 1. Visión general
Librería de **señalización WebRTC** que permite crear salas multipunto (rooms) y manejar la conexión entre pares (peers) sin necesidad de instalar servidores pesados.  
Está pensada para:

• Crear, unirse y gestionar salas de audio/video/datachannel.  
• Escalar de 1-N participantes con opciones “broadcast” o “oneway”.  
• Autenticarse por contraseña y exponer salas públicas.  
• Emitir eventos personalizados entre clientes.  

## 2. Arquitectura

```
┌─────────────┐                ┌──────────────────┐
│  Cliente A  │◄──────────────►│  Signaling Server│
└─────────────┘   WebSocket    │ (este paquete)  │
                               └──────┬───────────┘
                                      │
                               ┌──────┴───────────┐
                               │  Cliente B / N   │
                               └──────────────────┘
```

El servidor **no retransmite media**, solo coordina SDP, ICE-candidates y metadatos.

---

## 3. Instalación

```bash
npm install rtc-signaling-server
```

```ts
import http from 'http';
import { Server } from 'socket.io';
import signaling from 'rtc-signaling-server';

const httpServer = http.createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', socket => signaling(socket, {
  logs: true,          // escribir en consola y/o logger externo
  maxParticipantsAllowed: 50
}));

httpServer.listen(9001);
```

---

## 4. Flujo básico de vida de un peer

1. **Conexión**  
   El cliente abre un WebSocket.  
   El servidor le asigna `userid` si no se envía.

2. **Abrir sala**  
   Cliente → `socket.emit('open-room', {...})`  
   Servidor crea la sala y marca al peer como **owner**.

3. **Unirse a sala**  
   Cliente → `socket.emit('join-room', {...})`  
   Se validan: existencia, contraseña, cupo.

4. **Intercambio WebRTC**  
   La librería emite eventos internos (`RTCMultiConnection-Message` por defecto) para SDP/ICE.

5. **Desconexión**  
   Al cerrar el socket se notifica a los demás y se transfere la propiedad si era owner.

---

## 5. Interfaces de TypeScript
```ts
// Accesibles al importar 'rtc-signaling-server'
interface User {
  socket: CustomSocket;
  connectedWith: Record<string, CustomSocket>;
  extra: any;
  socketMessageEvent: string;
  socketCustomEvent: string;
  roomid?: string;
}

interface Room {
  maxParticipantsAllowed: number;
  owner: string;
  participants: string[];
  extra: any;
  socketMessageEvent: string;
  socketCustomEvent: string;
  identifier: string;        // para listar salas públicas
  session: {
    audio: boolean;
    video: boolean;
    oneway?: boolean;
    broadcast?: boolean;
    scalable?: boolean;
  };
  password?: string;
}
```

---

## 6. Eventos del lado cliente

| Evento cliente → servidor | Parámetros | Descripción |
|---------------------------|------------|-------------|
| `open-room` | `{ sessionid, session, extra?, identifier?, password? }` | Crea la sala. |
| `join-room` | `{ sessionid, extra?, password? }` | Se une a una sala existente. |
| `check-presence` | `roomid` | Consulta si la sala existe y su estado. |
| `get-public-rooms` | `identifier` | Devuelve todas las salas públicas con ese identificador. |
| `set-password` | `password` | Owner cambia o añade contraseña. |
| `is-valid-password` | `password, roomid` | Valida contraseña sin unirse. |
| `close-entire-session` | — | Owner cierra la sala y expulsa a todos. |
| `extra-data-updated` | `extra` | Actualiza datos extra del peer. |
| `get-remote-user-extra-data` | `remoteUserId, callback` | Lee datos extra de otro peer. |
| `changed-uuid` | `newUserId, callback` | Permite al cliente cambiar su ID. |
| `disconnect-with` | `remoteUserId, callback` | Elimina la conexión 1:1 sin salir de la sala. |
| **Evento interno WebRTC** | `RTCMultiConnection-Message` | Intercambia SDP/ICE (configurable). |
| `set-custom-socket-event-listener` | `eventName` | Registra un canal personalizado para broadcast. |

---

## 7. Eventos del servidor → cliente

| Evento | Payload | Uso |
|--------|---------|-----|
| `userid-already-taken` | `oldId, newId` | Se disparó cuando el userid estaba duplicado. |
| `user-connected` | `remoteUserId` | Se ha establecido la conexión con un peer. |
| `user-disconnected` | `remoteUserId` | Se ha perdido la conexión con un peer. |
| `extra-data-updated` | `userid, extra` | Alguien cambió sus metadatos. |
| `user-not-found` | `userid` | El peer destino no existe. |
| `set-isInitiator-true` | `roomid` | El peer se convierte en nuevo owner. |

---

## 8. Salas públicas vs privadas

• **Privada**: `identifier` vacío o no enviado.  
• **Pública**: se envía `identifier` durante `open-room`.  
Los clientes pueden listarlas con `get-public-rooms(identifier)`.

---

## 9. Seguridad y contraseñas

• Solo el **owner** puede cambiar la contraseña (`set-password`).  
• Los clientes validan antes de unirse con `is-valid-password`.  
• Las salas con contraseña marcan `isPasswordProtected: true`.

---

## 10. Escalado y límites

• `maxParticipantsAllowed` se puede definir globalmente (config) o por sala.  
• El flag `session.broadcast` o `session.oneway` fuerza **1-N** (solo el owner envía media).  
• Si owner se desconecta y `autoCloseEntireSession=false`, se elige un nuevo owner automáticamente.

---

## 11. Configuración del servidor

```ts
interface Config {
  logs?: boolean;            // mostrar trazas
  maxParticipantsAllowed?: number;
  pushLogs?: (type: string, error: any) => void;  // logger externo
}
```

---

## 12. Ejemplo mínimo de cliente

```html
<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io('http://localhost:9001');
const ROOM_ID = 'demo-room';

socket.on('connect', () => {
  // Unirse a la sala
  socket.emit('join-room', { sessionid: ROOM_ID, password: '' }, ok => {
    if (!ok) alert('No se pudo unir');
  });
});

// Escuchar cuando alguien se conecta
socket.on('user-connected', userId => console.log('Se unió', userId));
</script>
```

---

## 13. Errores estándar

Todos los callbacks devuelven `(success, error)` cuando corresponde.  
Los mensajes de error se encuentran en `CONST_STRINGS` y pueden ser sobre-escritos:

```ts
import { CONST_STRINGS } from 'rtc-signaling-server/constants';
CONST_STRINGS.ROOM_FULL = 'La sala está completa';
```

---

## 14. Contribuciones y tests

```bash
git clone <repo>
npm install
npm test        # suite de integración con socket.io-mock
npm run lint
```

---