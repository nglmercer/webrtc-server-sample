import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import signaling_server from './signaling_server';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    }
});

const PORT = process.env.PORT || 9001

app.use(express.static('public'));

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