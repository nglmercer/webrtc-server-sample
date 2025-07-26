// ACRHIVO DE PRUEBA DE WEBRTC
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { defaultSignal,WebSocketAdapter } from './index';
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

    defaultSignal.handleConnection(socket);
    setInterval(() => {
        console.log('alldata', defaultSignal.getRooms());
        console.log('alldata', defaultSignal.getUsers());
    },10000)
    socket.on('disconnect', () => {
        console.log(`[Server] User with socket ID ${socket.id} has disconnected.`);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
});