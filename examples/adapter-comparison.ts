/**
 * Ejemplo de comparación entre WebSocketAdapter y SocketIOLikeAdapter
 * 
 * Este archivo muestra las diferencias y similitudes entre ambos adaptadores,
 * y cómo migrar de uno al otro.
 */

import { WebSocketAdapter } from '../src/adapters/WebSocketAdapter.js';
import { wsio, SocketIOLikeSocket, SocketIOLikeServer } from '../src/adapters/SocketIOLikeAdapter.js';
import { WebSocketServer } from 'ws';
import { logger } from '../src/logger/index.js';

// ============================================================================
// EJEMPLO 1: WebSocketAdapter Básico (Adaptador Original)
// ============================================================================

export function startBasicWebSocketServer(port: number = 8081): void {
    const wss = new WebSocketServer({ port });
    
    console.log(`🔧 Servidor WebSocket básico iniciado en puerto ${port}`);
    
    wss.on('connection', (ws, request) => {
        const socket = new WebSocketAdapter(ws, request);
        
        logger.info(`Cliente conectado (Básico): ${socket.id}`,{});
        
        // Usar el emitter personalizado
        socket.on('mensaje', (data) => {
            logger.info(`Mensaje recibido (Básico): ${data}`,{});
            socket.emit('respuesta', `Echo: ${data}`);
        });
        
        socket.on('ping-test', () => {
            socket.emit('pong-test', { timestamp: Date.now(), socketId: socket.id });
        });
        
        socket.on('disconnect', ({code, reason}) => {
            logger.info(`Cliente desconectado (Básico): ${socket.id}`, { code, reason });
        });
        
        // Enviar bienvenida
        socket.emit('welcome', {
            message: 'Conectado al servidor WebSocket básico',
            socketId: socket.id,
            type: 'basic'
        });
    });
}

// ============================================================================
// EJEMPLO 2: SocketIOLikeAdapter Avanzado (Adaptador con Funcionalidades)
// ============================================================================

export function startAdvancedSocketIOServer(port: number = 8082): SocketIOLikeServer {
    const server = new SocketIOLikeServer();
    
    server.listen(port, () => {
        console.log(`🚀 Servidor SocketIO-like iniciado en puerto ${port}`);
    });
    
    server.on('connection', (socket: SocketIOLikeSocket) => {
        logger.info(`Cliente conectado (Avanzado): ${socket.id}`,{});
        
        // Funcionalidades básicas (igual que el básico)
        socket.on('mensaje', (data) => {
            logger.info(`Mensaje recibido (Avanzado): ${data}`,{});
            socket.emit('respuesta', `Echo avanzado: ${data}`);
        });
        
        // Funcionalidades avanzadas (solo en SocketIO-like)
        socket.on('join-room', ({ room, username }) => {
            socket.join(room);
            socket.to(room).emit('user-joined', {
                username: username || `Usuario-${socket.id.slice(0, 6)}`,
                socketId: socket.id,
                room
            });
            
            socket.emit('joined-room', {
                room,
                message: `Te uniste a ${room}`,
                usersInRoom: server.getUsersInRoom(room).length
            });
        });
        
        socket.on('room-message', ({ room, message, username }) => {
            server.broadcastToRoom(room, 'room-message', [{
                username: username || `Usuario-${socket.id.slice(0, 6)}`,
                message,
                room,
                timestamp: Date.now()
            }]);
        });
        
        socket.on('private-message', ({ targetId, message }) => {
            const target = server.getUser(targetId);
            if (target && target.socket.isAlive()) {
                target.socket.emit('private-message', {
                    from: socket.id,
                    message,
                    timestamp: Date.now()
                });
                socket.emit('private-sent', { to: targetId, message });
            } else {
                socket.emit('error', { message: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
            }
        });
        
        socket.on('get-server-stats', () => {
            const stats = server.getStats();
            socket.emit('server-stats', stats);
        });
        
        socket.on('broadcast-all', ({ message, adminKey }) => {
            if (adminKey === 'admin123') {
                server.emit('global-announcement', {
                    message,
                    from: socket.id,
                    timestamp: Date.now()
                });
            } else {
                socket.emit('error', { message: 'No autorizado', code: 'UNAUTHORIZED' });
            }
        });
        
        socket.on('disconnect', ({code, reason}) => {
            logger.info(`Cliente desconectado (Avanzado): ${socket.id}`, { code, reason });
        });
        
        // Enviar bienvenida con más información
        socket.emit('welcome', {
            message: 'Conectado al servidor SocketIO-like avanzado',
            socketId: socket.id,
            type: 'advanced',
            features: ['rooms', 'private-messages', 'broadcast', 'stats'],
            serverStats: server.getStats()
        });
    });
    
    return server;
}

// ============================================================================
// FUNCIÓN PRINCIPAL PARA EJECUTAR TODOS LOS EJEMPLOS
// ============================================================================

export function runAllExamples(): void {
    console.log('🎯 INICIANDO EJEMPLOS DE COMPARACIÓN DE ADAPTADORES\n');
    
        
    // Iniciar ambos servidores
    console.log('\n🚀 INICIANDO SERVIDORES...\n');
    
    startBasicWebSocketServer(8081);
    const advancedServer = startAdvancedSocketIOServer(8082);
    
    // Crear archivo de cliente de prueba
    console.log('\n📝 Cliente de prueba disponible en memoria');
    console.log('Usa createTestClient() para obtener el HTML del cliente');
    
    // Estadísticas periódicas del servidor avanzado
    setInterval(() => {
        if (advancedServer) {
            const stats = advancedServer.getStats();
            if (stats.totalUsers > 0) {
                console.log('📊 Estadísticas servidor avanzado:', {
                    usuarios: stats.totalUsers,
                    salas: stats.totalRooms
                });
            }
        }
    }, 30000);
    
    console.log('\n✅ Todos los ejemplos iniciados');
    console.log('📱 Conecta a:');
    console.log('   - Servidor Básico: ws://localhost:8081');
    console.log('   - Servidor Avanzado: ws://localhost:8082');
    console.log('🌐 Abre examples/socketio-client-example.html para probar');
}

runAllExamples();