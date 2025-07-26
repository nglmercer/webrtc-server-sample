// ACRHIVO DE PRUEBA DE WEBRTC
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { signaling_server } from 'webrtc-socket-api';
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    }
});
app.use(express.static('public'));
const PORT = process.env.PORT || 9001


io.on('connection', (socket) => {
    console.log(`\n[Server] New user connected with socket ID: ${socket.id}`);

    signaling_server(socket, {});

    socket.on('disconnect', () => {
        console.log(`[Server] User with socket ID ${socket.id} has disconnected.`);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
});