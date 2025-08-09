/**
 * Ejemplo de integración de SocketIOLikeAdapter con Express
 * 
 * Este ejemplo muestra cómo usar el método attach() para integrar
 * SocketIOLikeServer con un servidor Express existente, compartiendo
 * el mismo puerto HTTP.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { SocketIOLikeSocket, SocketIOLikeServer } from '../dist/adapters/SocketIOLikeAdapter.js';
/* const path = require('path');
const http = require('http');
const { SocketIOLikeServer } = require('../dist/adapters/SocketIOLikeAdapter.js'); */

const app = express();

// 1. Servir archivos estáticos
app.use(express.static(path.join(path.resolve(), '../public')));

// 2. Rutas de Express
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Express + SocketIO-like Integration</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                #messages { border: 1px solid #ccc; height: 300px; overflow-y: scroll; padding: 10px; margin: 10px 0; }
                input, button { padding: 8px; margin: 5px; }
                .message { margin: 5px 0; padding: 5px; background: #f0f0f0; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>🚀 Express + SocketIO-like Integration</h1>
            <p>Servidor funcionando en puerto ${PORT}</p>
            
            <div>
                <input type="text" id="messageInput" placeholder="Escribe un mensaje..." style="width: 300px;">
                <button onclick="sendMessage()">Enviar Mensaje</button>
            </div>
            
            <div>
                <input type="text" id="roomInput" placeholder="Nombre de sala..." style="width: 200px;">
                <button onclick="joinRoom()">Unirse a Sala</button>
            </div>
            
            <div id="messages"></div>
            
            <script>
                const ws = new WebSocket('ws://localhost:${PORT}');
                const messages = document.getElementById('messages');
                let currentRoom = null;
                
                ws.onopen = function() {
                    console.log('✅ Conectado al servidor WebSocket');
                    addMessage('🔗 Conectado al servidor', 'system');
                };
                
                ws.onmessage = function(event) {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('📨 Mensaje recibido:', data);
                        
                        if (data.event === 'welcome') {
                            addMessage('🎉 ' + data.payload[0].message, 'welcome');
                        } else if (data.event === 'express-response') {
                            addMessage('📤 Respuesta: ' + data.payload[0].message, 'response');
                        } else if (data.event === 'joined-room') {
                            currentRoom = data.payload[0].room;
                            addMessage('🏠 Te uniste a la sala: ' + currentRoom, 'room');
                        } else if (data.event === 'room-message') {
                            const msg = data.payload[0];
                            addMessage('💬 [' + msg.room + '] ' + msg.username + ': ' + msg.message, 'room-msg');
                        } else {
                            addMessage('📨 ' + JSON.stringify(data), 'raw');
                        }
                    } catch (e) {
                        addMessage('❌ Error parseando mensaje: ' + event.data, 'error');
                    }
                };
                
                ws.onclose = function() {
                    addMessage('❌ Conexión cerrada', 'system');
                };
                
                ws.onerror = function(error) {
                    addMessage('❌ Error de conexión: ' + error, 'error');
                };
                
                function sendMessage() {
                    const input = document.getElementById('messageInput');
                    const message = input.value.trim();
                    if (!message) return;
                    
                    let eventData;
                    if (currentRoom) {
                        eventData = {
                            event: 'room-message',
                            payload: [{
                                room: currentRoom,
                                message: message,
                                username: 'Usuario-Web'
                            }]
                        };
                    } else {
                        eventData = {
                            event: 'express-test',
                            payload: [{ message: message }]
                        };
                    }
                    
                    ws.send(JSON.stringify(eventData));
                    addMessage('📤 Enviado: ' + message, 'sent');
                    input.value = '';
                }
                
                function joinRoom() {
                    const input = document.getElementById('roomInput');
                    const room = input.value.trim();
                    if (!room) return;
                    
                    const eventData = {
                        event: 'join-room',
                        payload: [{
                            room: room,
                            username: 'Usuario-Web'
                        }]
                    };
                    
                    ws.send(JSON.stringify(eventData));
                    input.value = '';
                }
                
                function addMessage(msg, type = 'default') {
                    const div = document.createElement('div');
                    div.className = 'message';
                    div.innerHTML = '<strong>' + new Date().toLocaleTimeString() + '</strong> - ' + msg;
                    
                    // Colores según el tipo
                    switch(type) {
                        case 'system': div.style.background = '#e3f2fd'; break;
                        case 'welcome': div.style.background = '#e8f5e8'; break;
                        case 'response': div.style.background = '#fff3e0'; break;
                        case 'room': div.style.background = '#f3e5f5'; break;
                        case 'room-msg': div.style.background = '#e0f2f1'; break;
                        case 'sent': div.style.background = '#e1f5fe'; break;
                        case 'error': div.style.background = '#ffebee'; break;
                    }
                    
                    messages.appendChild(div);
                    messages.scrollTop = messages.scrollHeight;
                }
                
                // Permitir envío con Enter
                document.getElementById('messageInput').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') sendMessage();
                });
                
                document.getElementById('roomInput').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') joinRoom();
                });
            </script>
        </body>
        </html>
    `);
});

app.get('/api/status', (req, res) => {
    const stats = io.getStats();
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        stats: stats
    });
});

// 3. Crear el servidor HTTP manualmente
const server = http.createServer(app);

// 4. Crear el servidor SocketIO-like usando el mismo servidor HTTP
const io = new SocketIOLikeServer();

// 5. Adjuntar SocketIO al servidor HTTP (¡Esta es la clave!)
io.attach(server, () => {
    console.log('🔗 SocketIO-like adjuntado al servidor HTTP');
});

// 6. Manejo de conexiones WebSocket
io.on('connection', (socket) => {
    console.log('🔌 Cliente WebSocket conectado:', socket.id);
    
    // Eventos básicos
    socket.on('express-test', (data) => {
        console.log('📨 Mensaje recibido:', data);
        socket.emit('express-response', {
            message: `Echo desde Express: ${data.message}`,
            timestamp: Date.now(),
            socketId: socket.id
        });
    });
    
    // Eventos de salas
    socket.on('join-room', ({ room, username }) => {
        socket.join(room);
        console.log(`🏠 ${socket.id} se unió a la sala ${room}`);
        
        socket.to(room).emit('user-joined', {
            username: username || `Usuario-${socket.id.slice(0, 6)}`,
            socketId: socket.id,
            room
        });
        
        socket.emit('joined-room', {
            room,
            message: `Te uniste a ${room}`,
            usersInRoom: io.getUsersInRoom(room).length
        });
    });
    
    socket.on('room-message', ({ room, message, username }) => {
        console.log(`💬 Mensaje en sala ${room}: ${message}`);
        io.broadcastToRoom(room, 'room-message', [{
            username: username || `Usuario-${socket.id.slice(0, 6)}`,
            message,
            room,
            timestamp: Date.now()
        }]);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Cliente WebSocket desconectado:', socket.id);
    });
    
    // Mensaje de bienvenida
    socket.emit('welcome', {
        message: 'Conectado al servidor Express + SocketIO-like',
        socketId: socket.id,
        timestamp: Date.now()
    });
});

// 7. Escuchar en un puerto
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP+WebSocket ejecutándose en http://localhost:${PORT}`);
    console.log(`📍 Página web: http://localhost:${PORT}`);
    console.log(`📍 API Status: http://localhost:${PORT}/api/status`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
});

// Estadísticas periódicas
setInterval(() => {
    const stats = io.getStats();
    if (stats.totalUsers > 0) {
        console.log('📊 Estadísticas:', {
            usuarios: stats.totalUsers,
            salas: stats.totalRooms,
            timestamp: new Date().toLocaleTimeString()
        });
    }
}, 30000);

// Manejo de cierre graceful
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor...');
    io.close(() => {
        server.close(() => {
            console.log('✅ Servidor cerrado correctamente');
            process.exit(0);
        });
    });
});