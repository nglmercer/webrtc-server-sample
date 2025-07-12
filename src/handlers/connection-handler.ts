import { CustomSocket, User } from '../types';
import { StateManager } from '../state-manager';
import pushLogs from '../pushLogs';

export function handleConnection(socket: CustomSocket, stateManager: StateManager, config: any) {
    let params = socket.handshake.query as any;

    if (!params.userid) {
        params.userid = (Math.random() * 100).toString().replace('.', '');
    }

    if (stateManager.getUser(params.userid)) {
        const useridAlreadyTaken = params.userid;
        params.userid = (Math.random() * 1000).toString().replace('.', '');
        socket.emit('userid-already-taken', useridAlreadyTaken, params.userid);
    }

    socket.userid = params.userid;

    const user: User = {
        socket: socket,
        connectedWith: {},
        extra: params.extra || {},
        socketMessageEvent: params.socketMessageEvent || 'RTCMultiConnection-Message',
        socketCustomEvent: params.socketCustomEvent || '',
    };
    stateManager.addUser(user);

    const autoCloseEntireSession = params.autoCloseEntireSession === 'true';

    return { params, autoCloseEntireSession };
}

export function handleDisconnect(socket: CustomSocket, stateManager: StateManager, config: any, autoCloseEntireSession: boolean) {
    try {
        // Lógica de closeOrShiftRoom (idealmente como un método en StateManager)
        // Ejemplo: stateManager.transferRoomOwnershipOrClose(socket.userid, autoCloseEntireSession);

        // Limpiar al usuario del estado
        stateManager.removeUser(socket.userid);

        if (socket.ondisconnect) {
            socket.ondisconnect();
        }
    } catch (e) {
        pushLogs(config, 'disconnect', e);
    }
}