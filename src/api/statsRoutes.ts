import { Router, Request, Response } from 'express';
import signalingServer from '../signal_server';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/stats/connections
 * Obtiene estadísticas de todas las conexiones activas
 */
router.get('/connections', (req: Request, res: Response) => {
  try {
    const stats = signalingServer.getConnectionStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas de conexión:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * GET /api/stats/heartbeat
 * Obtiene el estado del sistema de heartbeat
 */
router.get('/heartbeat', (req: Request, res: Response) => {
  try {
    const heartbeatStatus = signalingServer.getHeartbeatStatus();
    res.json({
      success: true,
      data: heartbeatStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo estado del heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * GET /api/stats/rooms
 * Obtiene información de todas las salas activas
 */
router.get('/rooms', (req: Request, res: Response) => {
  try {
    const rooms = signalingServer.getRooms();
    const users = signalingServer.getUsers();
    const roomStats = Object.entries(rooms).map(([roomId, room]) => {
      // Obtener usuarios basándose en los participants
      const roomUsers = room.participants.map(participantId => {
        const user = users[participantId];
        return user ? {
          userid: user.userid || participantId,
          socketId: user.socket?.id,
          isConnected: user.socket ? true : false
        } : {
          userid: participantId,
          socketId: null,
          isConnected: false
        };
      });
      
      return {
        roomId,
        userCount: room.participants.length,
        users: roomUsers,
        createdAt: room.createdAt || null,
        maxUsers: room.maxParticipantsAllowed || null,
        owner: room.owner,
        identifier: room.identifier,
        hasPassword: !!room.password
      };
    });
    
    res.json({
      success: true,
      data: {
        totalRooms: roomStats.length,
        rooms: roomStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas de salas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * GET /api/stats/users
 * Obtiene información de todos los usuarios conectados
 */
router.get('/users', (req: Request, res: Response) => {
  try {
    const users = signalingServer.getUsers();
    const userStats = Object.entries(users).map(([userId, user]) => ({
      userid: user.userid,
      socketId: user.socket?.id,
      roomId: user.roomid,
      isConnected: user.socket ? true : false,
      connectedAt: user.connectedAt || null
    }));
    
    res.json({
      success: true,
      data: {
        totalUsers: userStats.length,
        users: userStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas de usuarios:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * POST /api/stats/heartbeat/restart
 * Reinicia el sistema de heartbeat
 */
router.post('/heartbeat/restart', (req: Request, res: Response) => {
  try {
    signalingServer.restartHeartbeat();
    res.json({
      success: true,
      message: 'Heartbeat reiniciado exitosamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error reiniciando heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * POST /api/stats/heartbeat/stop
 * Detiene el sistema de heartbeat
 */
router.post('/heartbeat/stop', (req: Request, res: Response) => {
  try {
    signalingServer.stopHeartbeat();
    res.json({
      success: true,
      message: 'Heartbeat detenido exitosamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error deteniendo heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * GET /api/stats/summary
 * Obtiene un resumen general de todas las estadísticas
 */
router.get('/summary', (req: Request, res: Response) => {
  try {
    const connectionStats = signalingServer.getConnectionStats();
    const heartbeatStatus = signalingServer.getHeartbeatStatus();
    const rooms = signalingServer.getRooms();
    const users = signalingServer.getUsers();
    
    const summary = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      },
      connections: {
        total: connectionStats.totalUsers,
        active: connectionStats.connections.filter((c: any) => c.isConnected).length,
        heartbeatEnabled: connectionStats.heartbeatEnabled
      },
      rooms: {
        total: Object.keys(rooms).length,
        withUsers: Object.values(rooms).filter(room => room.participants.length > 0).length
      },
      heartbeat: heartbeatStatus
    };
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo resumen de estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;