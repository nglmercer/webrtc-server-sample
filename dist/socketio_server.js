import { wsio } from './adapters/SocketIOLikeAdapter.js';
import { defaultLogger as logger } from './logger/index.js';
// Configurar eventos del servidor
wsio.on('connection', (socket) => {
    logger.info(`Cliente conectado: ${socket.id}`, {});
    // Enviar mensaje de bienvenida
    socket.emit('welcome', {
        message: 'Bienvenido al servidor WebSocket',
        socketId: socket.id,
        timestamp: Date.now()
    });
    // Manejar evento de unirse a sala
    socket.on('join-room', (data) => {
        const { room, username } = data;
        // Unirse a la sala
        socket.join(room);
        // Notificar a otros usuarios en la sala
        socket.to(room).emit('user-joined', {
            socketId: socket.id,
            username: username || `Usuario-${socket.id.slice(0, 6)}`,
            room,
            timestamp: Date.now()
        });
        // Confirmar al usuario que se unió
        socket.emit('joined-room', {
            room,
            message: `Te has unido a la sala ${room}`,
            usersInRoom: wsio.getUsersInRoom(room).length
        });
        logger.info(`Socket ${socket.id} se unió a la sala ${room}`, {});
    });
    // Manejar evento de salir de sala
    socket.on('leave-room', (data) => {
        const { room } = data;
        // Notificar a otros usuarios antes de salir
        socket.to(room).emit('user-left', {
            socketId: socket.id,
            room,
            timestamp: Date.now()
        });
        // Salir de la sala
        socket.leave(room);
        socket.emit('left-room', {
            room,
            message: `Has salido de la sala ${room}`
        });
        logger.info(`Socket ${socket.id} salió de la sala ${room}`, {});
    });
    // Manejar mensajes de chat
    socket.on('chat-message', (data) => {
        const { room, message, username } = data;
        const chatData = {
            socketId: socket.id,
            username: username || `Usuario-${socket.id.slice(0, 6)}`,
            message,
            room,
            timestamp: Date.now()
        };
        // Enviar mensaje a todos en la sala (incluyendo al remitente)
        wsio.broadcastToRoom(room, 'chat-message', [chatData]);
        logger.info(`Mensaje de chat en sala ${room} de ${socket.id}: ${message}`, {});
    });
    // Manejar mensajes privados
    socket.on('private-message', (data) => {
        const { targetSocketId, message, username } = data;
        const targetUser = wsio.getUser(targetSocketId);
        if (targetUser && targetUser.socket.isAlive()) {
            targetUser.socket.emit('private-message', {
                fromSocketId: socket.id,
                fromUsername: username || `Usuario-${socket.id.slice(0, 6)}`,
                message,
                timestamp: Date.now()
            });
            // Confirmar al remitente
            socket.emit('private-message-sent', {
                toSocketId: targetSocketId,
                message,
                timestamp: Date.now()
            });
            logger.info(`Mensaje privado de ${socket.id} a ${targetSocketId}: ${message}`, {});
        }
        else {
            socket.emit('error', {
                message: 'Usuario objetivo no encontrado o desconectado',
                code: 'USER_NOT_FOUND'
            });
        }
    });
    // Manejar solicitud de estadísticas
    socket.on('get-stats', () => {
        const stats = wsio.getStats();
        socket.emit('stats', stats);
    });
    // Manejar solicitud de usuarios en sala
    socket.on('get-room-users', (data) => {
        const { room } = data;
        const users = wsio.getUsersInRoom(room);
        socket.emit('room-users', {
            room,
            users: users.map(user => ({
                socketId: user.id,
                joinedAt: user.joinedAt,
                isAlive: user.socket.isAlive()
            }))
        });
    });
    // Manejar broadcast global (solo para administradores)
    socket.on('global-broadcast', (data) => {
        const { message, adminKey } = data;
        // Verificación simple de admin (en producción usar autenticación real)
        if (adminKey === 'admin123') {
            wsio.emit('global-announcement', {
                message,
                timestamp: Date.now(),
                from: 'Administrador'
            });
            logger.info(`Broadcast global enviado por ${socket.id}: ${message}`, {});
        }
        else {
            socket.emit('error', {
                message: 'No tienes permisos para enviar broadcasts globales',
                code: 'UNAUTHORIZED'
            });
        }
    });
    // Manejar ping personalizado
    socket.on('ping', () => {
        socket.emit('pong', {
            timestamp: Date.now(),
            socketId: socket.id
        });
    });
    // Manejar desconexión
    socket.on('disconnect', (code, reason) => {
        logger.info(`Cliente desconectado: ${socket.id}`, { code, reason });
        // Notificar a todas las salas donde estaba el usuario
        const rooms = socket.getRooms();
        rooms.forEach(room => {
            socket.to(room).emit('user-disconnected', {
                socketId: socket.id,
                room,
                timestamp: Date.now()
            });
        });
    });
    // Manejar errores
    socket.on('error', (error) => {
        logger.error(`Error en socket ${socket.id}:`, error);
    });
});
// Función para iniciar el servidor
export function startSocketIOServer(port = 8080) {
    wsio.listen(port, () => {
        logger.info(`Servidor SocketIO-like iniciado en puerto ${port}`, {});
        console.log(`🚀 Servidor WebSocket corriendo en ws://localhost:${port}`);
    });
    // Estadísticas periódicas
    setInterval(() => {
        const stats = wsio.getStats();
        logger.info('Estadísticas del servidor:', {
            usuarios: stats.totalUsers,
            salas: stats.totalRooms,
            salasDetalle: stats.rooms
        });
    }, 60000); // Cada minuto
}
// Función para cerrar el servidor
export function stopSocketIOServer() {
    wsio.close(() => {
        logger.info('Servidor SocketIO-like cerrado', {});
    });
}
// Exportar la instancia del servidor para uso externo
export { wsio };
// Si este archivo se ejecuta directamente, iniciar el servidor
if (import.meta.url === `file://${process.argv[1]}`) {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
    startSocketIOServer(port);
    // Manejar cierre graceful
    process.on('SIGINT', () => {
        console.log('\n🛑 Cerrando servidor...');
        stopSocketIOServer();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        console.log('\n🛑 Cerrando servidor...');
        stopSocketIOServer();
        process.exit(0);
    });
}
//# sourceMappingURL=socketio_server.js.map