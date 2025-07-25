# webrtc-socket-api

> A lightweight **WebRTC signaling server** built with **Node.js, Express & Socket.IO**.  
> Handles room management, user presence and SDP/ICE forwarding so you can focus on the front-end.
> documentation in Spanish [here](https://github.com/nglmercer/webrtc-server-sample/blob/main/README.ES.md)
---

## ✨ Features

- **User management** – auto-generated or custom `userid`.
- **Rooms** – create/join/leave, max-participants, password protection.
- **Public room list** – discover open rooms by identifier.
- **Presence checks** – detect if a user or room exists.
- **Custom events** – hook your own Socket.IO events on top.
- **Auto-failover** – owner leaves? another participant becomes host.
- **TypeScript** – fully typed interfaces included.

---

## 📦 Installation

```bash
npm install webrtc-socket-api
```

### Peer dependencies (install once in your project):

```bash
npm i express socket.io
# If you compile TS:
npm i -D @types/express @types/node
```

---

## 🚀 Quick Start (Server)

```ts
// server.ts
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import signaling_server from "webrtc-socket-api";

const app = express();
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  signaling_server(socket, {
    // optional global config
    logToFile: true,
  });
});

http.listen(9001, () => console.log("Signaling server on :9001"));
```

---

## 🧑‍💻 Client Usage

```bash
npm i socket.io-client
```

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:9001", {
  query: {
    userid: "alice",              // optional
    sessionid: "room-123",        // optional
    maxParticipantsAllowed: "10", // optional
    extra: JSON.stringify({ avatar: "👩‍💻" }),
  },
});

// 1. Create / join a room
socket.emit("open-room", {
  sessionid: "room-123",
  session: { audio: true, video: true },
  identifier: "public-chat", // optional: for public listing
  password: "secret",        // optional
});

// 2. Listen for incoming WebRTC signaling
socket.on("RTCMultiConnection-Message", (payload) => {
  // payload = { remoteUserId, message: { sdp, ice }, ... }
  handleSignaling(payload); // your WebRTC logic
});

// 3. Send signaling to another peer
socket.emit("RTCMultiConnection-Message", {
  remoteUserId: "bob",
  message: { sdp: offer },
});

// 4. Extra data (avatar, nick, …)
socket.emit("extra-data-updated", { avatar: "🎅" });

// 5. Discover public rooms
socket.emit("get-public-rooms", "public-chat", (rooms) => {
  console.log("Available rooms:", rooms);
});
```

---

## 📡 Events Reference (Client ⇄ Server)

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `open-room` | ⬆️ | `{ sessionid, session, extra?, password?, identifier? }` | Create & enter a room. |
| `join-room` | ⬆️ | `{ sessionid, extra?, password? }` | Join existing room. |
| `check-presence` | ⬆️ | `roomid` | Ask if a room exists. |
| `get-public-rooms` | ⬆️ | `identifier` | List all open rooms with that identifier. |
| `set-password` | ⬆️ | `password` | Owner sets/changes room password. |
| `is-valid-password` | ⬆️ | `password, roomid` | Validate before joining. |
| `close-entire-session` | ⬆️ | — | Owner closes the room. |
| `extra-data-updated` | ⬆️ | `extra` | Update your own metadata. |
| `get-remote-user-extra-data` | ⬆️ | `remoteUserId` | Fetch another user’s metadata. |
| `changed-uuid` | ⬆️ | `newUserId` | Change your userid on the fly. |
| `disconnect-with` | ⬆️ | `remoteUserId` | Stop peering with a specific user. |
| `RTCMultiConnection-Message` | ⬆️⬇️ | `{ remoteUserId, message }` | SDP / ICE / custom signaling. |
| `set-custom-socket-event-listener` | ⬆️ | `eventName` | Register an additional event to broadcast. |

---

## 📁 Project Structure

```
src/
 ├── server.ts                // Express + Socket.IO bootstrap
 ├── signaling_server.ts      // Main export
 ├── types.ts                 // Room, User, CustomSocket …
 ├── constants.ts             // Error strings
 ├── event-handlers/
 │   ├── roomHandlers.ts      // open-room, join-room …
 │   ├── userHandlers.ts      // extra-data-updated, uuid change …
 │   └── messageHandlers.ts   // SDP/ICE relaying
 └── utils/
     ├── roomUtils.ts
     ├── userUtils.ts
     └── socketUtils.ts
```

---

## ⚙️ Configuration

Pass an optional config object as the **second argument** to `signaling_server(socket, config)`:

```ts
interface Config {
  logToFile?: boolean;   // default false
  logPath?: string;      // default "./logs"
}
```

---

## 🛠️ Development

```bash
git clone <repo>
cd webrtc-socket-api
npm install
npm run dev      # ts-node + nodemon
```

---

## 📄 License

MIT – feel free to use in open-source or commercial projects.

---