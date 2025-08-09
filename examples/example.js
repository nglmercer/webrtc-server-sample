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
    socket.on('disconnect', () => {
        console.log(`[Server] User with socket ID ${socket.id} has disconnected.`);
    });
});
function SocketLogs(){
        setInterval(() => {
        const rooms = defaultSignal.getRooms();
        const users = defaultSignal.getUsers();
        
        // Imprimir solo información resumida de las salas
        const roomsSummary = Object.keys(rooms).map(roomId => ({
            roomId,
            owner: rooms[roomId].owner,
            participants: rooms[roomId].participants,
            participantCount: rooms[roomId].participants.length
        }));
        
        // Imprimir solo información resumida de los usuarios
        const usersSummary = Object.keys(users).map(userId => ({
            userId,
            socketId: users[userId].socket?.id,
            connectedWithCount: Object.keys(users[userId].connectedWith || {}).length
        }));
        
        console.log('Rooms summary:', roomsSummary);
        console.log('Users summary:', usersSummary);
    },10000)
}
SocketLogs();
httpServer.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
});