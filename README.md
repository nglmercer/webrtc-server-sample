# Servidor de Señalización WebRTC

Este es un servidor de señalización para aplicaciones WebRTC, construido con Node.js, Express y Socket.IO. Está diseñado para ser una implementación simple pero robusta para manejar la lógica de señalización necesaria para establecer conexiones peer-to-peer.

## Características

-   **Gestión de Usuarios**: Maneja la conexión y desconexión de usuarios, asignando un ID único a cada uno.
-   **Gestión de Salas (Rooms)**: Permite a los usuarios crear y unirse a salas para la comunicación.
-   **Mensajería**: Facilita el intercambio de mensajes de señalización (como ofertas/respuestas SDP y candidatos ICE) entre los clientes.
-   **Configurable**: Permite pasar un objeto de configuración para personalizar su comportamiento.
-   **Basado en Eventos**: Utiliza un sistema de manejo de eventos para las diferentes acciones (salas, usuarios, mensajes).

## Cómo Empezar

### Prerrequisitos

-   Node.js (v14 o superior)
-   npm

### Instalación

1.  Clona el repositorio:
    ```bash
    git clone <URL-DEL-REPOSITORIO>
    cd <NOMBRE-DEL-DIRECTORIO>
    ```

2.  Instala las dependencias:
    ```bash
    npm install
    ```
    Asegúrate de tener `express`, `socket.io` y sus tipos (`@types/express`) en tu `package.json`.

### Ejecutando el Servidor

Para iniciar el servidor de señalización, ejecuta:

```bash
npm start
```

O si no tienes un script `start` configurado en tu `package.json`:

```bash
node dist/server.js
```
(Asumiendo que compilas tus archivos TypeScript a una carpeta `dist`)

El servidor se iniciará por defecto en el puerto `9001`.

## Uso en el Cliente

Para conectar un cliente a este servidor de señalización, puedes usar `socket.io-client`.

```javascript
const socket = io("http://localhost:9001", {
  query: {
    userid: "mi-id-de-usuario", // Opcional, el servidor generará uno si no se provee
    sessionid: "mi-id-de-sesion", // Opcional
    // ... otros parámetros que necesites
  },
});

socket.on("connect", () => {
  console.log("Conectado al servidor de señalización!");
});

// Escucha para eventos personalizados
socket.on("RTCMultiConnection-Message", (data) => {
  // Maneja los mensajes de señalización
  console.log("Mensaje recibido:", data);
});

// Ejemplo de cómo enviar un mensaje
function sendMessage(data) {
  socket.emit("RTCMultiConnection-Message", data);
}
```

## Estructura del Proyecto

El proyecto está estructurado de la siguiente manera:

```
├── public/         # Archivos estáticos para el cliente (HTML, JS, CSS)
├── src/            # Código fuente del servidor en TypeScript
│   ├── event-handlers/ # Manejadores para eventos de socket.io
│   ├── utils/          # Funciones de utilidad
│   ├── constants.ts
│   ├── server.ts       # Punto de entrada del servidor Express
│   ├── signaling_server.ts # Lógica principal del servidor de señalización
│   └── types.ts        # Definiciones de tipos de TypeScript
├── package.json
└── tsconfig.json
```

## Lógica del Servidor de Señalización (`signaling_server.ts`)

El archivo `signaling_server.ts` exporta una función que inicializa toda la lógica de señalización para un nuevo socket que se conecta.

-   **`onConnection(socket)`**: Esta función se ejecuta para cada nueva conexión.
    -   Procesa los parámetros de la query de la conexión (`userid`, `sessionid`, etc.).
    -   Verifica si un `userid` ya está en uso.
    -   Registra los manejadores de eventos para:
        -   **Salas (`roomHandlers`)**: Crear, unirse, salir de salas.
        -   **Usuarios (`userHandlers`)**: Manejo de información de usuarios.
        -   **Mensajes (`messageHandlers`)**: Intercambio de datos de señalización.
    -   Configura el manejador para el evento `disconnect`.

Este servidor está diseñado para ser modular, permitiendo añadir o modificar funcionalidades fácilmente a través de sus manejadores de eventos.