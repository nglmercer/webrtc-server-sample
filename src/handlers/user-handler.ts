import { CustomSocket } from '../types';
import { StateManager } from '../state-manager';
import CONST_STRINGS from '../constants';
import pushLogs from '../pushLogs';

export function registerUserEventHandlers(socket: CustomSocket, stateManager: StateManager, config: any) {
    socket.on('extra-data-updated', (extra: any) => {
        try {
            const user = stateManager.getUser(socket.userid);
            if (!user) return;

            user.extra = extra;

            // Notificar a usuarios conectados
            for (let connectedUserId in user.connectedWith) {
                const connectedUser = stateManager.getUser(connectedUserId);
                connectedUser?.socket.emit('extra-data-updated', socket.userid, extra);
            }

            // Notificar a participantes de la sala si es el dueño
            if (socket.admininfo) {
                const roomid = socket.admininfo.sessionid;
                const room = stateManager.getRoom(roomid);
                if (room) {
                    if (socket.userid === room.owner) {
                        room.extra = extra;
                    }
                    room.participants.forEach((pid) => {
                        stateManager.getUser(pid)?.socket.emit('extra-data-updated', socket.userid, extra);
                    });
                }
            }
        } catch (e) {
            pushLogs(config, 'extra-data-updated', e);
        }
    });

    socket.on('get-remote-user-extra-data', (remoteUserId: string, callback: (extra: any) => void) => {
        callback = callback || function () {};
        const remoteUser = stateManager.getUser(remoteUserId);
        if (!remoteUser) {
            return callback(CONST_STRINGS.USERID_NOT_AVAILABLE);
        }
        callback(remoteUser.extra);
    });
    
    socket.on('changed-uuid', (newUserId: string, callback: () => void) => {
        callback = callback || function () {};
        const oldUserId = socket.userid;
        const user = stateManager.getUser(oldUserId);

        if (user && user.socket.userid === oldUserId) {
            if (newUserId === oldUserId) return;

            // Reasignar el usuario al nuevo ID
            const oldUserObject = { ...user };
            oldUserObject.socket.userid = newUserId;
            stateManager.removeUser(oldUserId); // Usa el método para limpiar conexiones
            stateManager.addUser(oldUserObject);
            socket.userid = newUserId;

            callback();
        }
    });
    
    socket.on('disconnect-with', (remoteUserId: string, callback: () => void) => {
        try {
            const currentUser = stateManager.getUser(socket.userid);
            const remoteUser = stateManager.getUser(remoteUserId);

            if (currentUser && currentUser.connectedWith[remoteUserId]) {
                delete currentUser.connectedWith[remoteUserId];
                socket.emit('user-disconnected', remoteUserId);
            }

            if (remoteUser && remoteUser.connectedWith[socket.userid]) {
                delete remoteUser.connectedWith[socket.userid];
                remoteUser.socket.emit('user-disconnected', socket.userid);
            }
            callback();
        } catch (e) {
            pushLogs(config, 'disconnect-with', e);
        }
    });
}