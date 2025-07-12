import { ParsedUrlQuery } from 'querystring';
import pushLogs from './pushLogs';
import CONST_STRINGS from './const_strings';

let ScalableBroadcast: any;

// Definimos una interfaz genérica para el socket
interface ISocket {
    id: string;
    handshake: {
        query: ParsedUrlQuery;
    };
    on(event: string, callback: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    broadcast: {
        emit(event: string, ...args: any[]): void;
    };
    disconnect(close?: boolean): this;
    nsp?: any;
}


interface User {
    socket: CustomSocket;
    connectedWith: { [key: string]: CustomSocket };
    extra: any;
    socketMessageEvent: string;
    socketCustomEvent: string;
    roomid?: string;
}

interface Room {
    maxParticipantsAllowed: number;
    owner: string;
    participants: string[];
    extra: any;
    socketMessageEvent: string;
    socketCustomEvent: string;
    identifier: string;
    session: {
        audio: boolean;
        video: boolean;
        oneway?: boolean;
        broadcast?: boolean;
        scalable?: boolean;
    };
    password?: string;
}

interface CustomSocket extends ISocket {
    userid: string;
    admininfo?: {
        sessionid: string;
        session: any;
        mediaConstraints: any;
        sdpConstraints: any;
        streams: any;
        extra: any;
    };
    ondisconnect?: () => void;
}

let listOfUsers: { [key: string]: User } = {};
let listOfRooms: { [key: string]: Room } = {};

export default function signaling_server(socket: ISocket, config: any = {}) {
    const customSocket = socket as CustomSocket;
    onConnection(customSocket);

    function appendUser(socket: CustomSocket, params: any) {
        try {
            let extra = params.extra;

            if (params.extra) {
                try {
                    if (typeof params.extra === 'string') {
                        params.extra = JSON.parse(params.extra);
                    }
                    extra = params.extra;
                } catch (e) {
                    extra = params.extra;
                }
            }

            listOfUsers[socket.userid] = {
                socket: socket,
                connectedWith: {},
                extra: extra || {},
                socketMessageEvent: params.socketMessageEvent || '',
                socketCustomEvent: params.socketCustomEvent || ''
            };
        } catch (e) {
            pushLogs(config, 'appendUser', e);
        }
    }

            function onConnection(socket: CustomSocket) {
        let params = socket.handshake.query as any;

        if (!params.userid) {
            params.userid = (Math.random() * 100).toString().replace('.', '');
        }

        if (!params.sessionid) {
            params.sessionid = (Math.random() * 100).toString().replace('.', '');
        }

        if (params.extra) {
            try {
                params.extra = JSON.parse(params.extra as string);
            } catch (e) {
                params.extra = {};
            }
        } else {
            params.extra = {}; 
        }

                const socketMessageEvent = (params.msgEvent as string) || 'RTCMultiConnection-Message';
        (params as any).socketMessageEvent = socketMessageEvent;

                let autoCloseEntireSession = params.autoCloseEntireSession === 'true';
                const maxParticipantsAllowed = parseInt(params.maxParticipantsAllowed as string || '1000') || 1000;
        const enableScalableBroadcast = params.enableScalableBroadcast === 'true';

                if (enableScalableBroadcast) {
            try {
                if (!ScalableBroadcast) {
                                        ScalableBroadcast = (require('./Scalable-Broadcast') as any).default || require('./Scalable-Broadcast');
                }
                ScalableBroadcast._ = ScalableBroadcast(config, socket, params.maxRelayLimitPerUser);
            } catch (e) {
                pushLogs(config, 'ScalableBroadcast', e);
            }
        }

                if (!!listOfUsers[params.userid]) {
            const useridAlreadyTaken = params.userid;
            params.userid = (Math.random() * 1000).toString().replace('.', '');
            socket.emit('userid-already-taken', useridAlreadyTaken, params.userid);
            return;
        }

                socket.userid = params.userid;
        appendUser(socket, params);

        socket.on('extra-data-updated', (extra: any) => {
            try {
                if (!listOfUsers[socket.userid]) return;

                listOfUsers[socket.userid].extra = extra;

                try {
                    for (let user in listOfUsers[socket.userid].connectedWith) {
                        try {
                            listOfUsers[user].socket.emit('extra-data-updated', socket.userid, extra);
                        } catch (e) {
                            pushLogs(config, 'extra-data-updated.connectedWith', e);
                        }
                    }
                } catch (e) {
                    pushLogs(config, 'extra-data-updated.connectedWith', e);
                }

                if (!socket.admininfo) {
                    return;
                }

                                const roomid = socket.admininfo!.sessionid;
                if (roomid && listOfRooms[roomid]) {
                    if (socket.userid == listOfRooms[roomid].owner) {
                        listOfRooms[roomid].extra = extra;
                    }
                    listOfRooms[roomid].participants.forEach((pid) => {
                        try {
                            const user = listOfUsers[pid];
                            if (!user) {
                                return;
                            }
                            user.socket.emit('extra-data-updated', socket.userid, extra);
                        } catch (e) {
                            pushLogs(config, 'extra-data-updated.participants', e);
                        }
                    });
                }
            } catch (e) {
                pushLogs(config, 'extra-data-updated', e);
            }
        });

        socket.on('get-remote-user-extra-data', (remoteUserId: string, callback: (extra: any) => void) => {
            callback = callback || function () {};
            if (!remoteUserId || !listOfUsers[remoteUserId]) {
                callback(CONST_STRINGS.USERID_NOT_AVAILABLE);
                return;
            }
            callback(listOfUsers[remoteUserId].extra);
        });

        const dontDuplicateListeners: { [key: string]: string } = {};
        socket.on('set-custom-socket-event-listener', (customEvent: string) => {
            if (dontDuplicateListeners[customEvent]) return;
            dontDuplicateListeners[customEvent] = customEvent;

            socket.on(customEvent, (message: any) => {
                try {
                    socket.broadcast.emit(customEvent, message);
                } catch (e) {}
            });
        });

        socket.on('changed-uuid', (newUserId: string, callback: () => void) => {
            callback = callback || function () {};

            try {
                                if (listOfUsers[socket.userid] && listOfUsers[socket.userid].socket.userid === socket.userid) {
                    if (newUserId === socket.userid) return;

                    const oldUserId = socket.userid;
                    listOfUsers[newUserId] = listOfUsers[oldUserId];
                    listOfUsers[newUserId].socket.userid = socket.userid = newUserId;
                    delete listOfUsers[oldUserId];

                    callback();
                    return;
                }

                socket.userid = newUserId;
                appendUser(socket, params);

                callback();
            } catch (e) {
                pushLogs(config, 'changed-uuid', e);
            }
        });

        socket.on('set-password', (password: string, callback: (success: boolean, roomid: string | null, error: string | null) => void) => {
            try {
                callback = callback || function () {};

                if (!socket.admininfo) {
                    callback(false, null, CONST_STRINGS.DID_NOT_JOIN_ANY_ROOM);
                    return;
                }

                const roomid = socket.admininfo.sessionid;

                                if (listOfRooms[roomid] && listOfRooms[roomid].owner === socket.userid) {
                    listOfRooms[roomid].password = password;
                    callback(true, roomid, null);
                } else {
                    callback(false, roomid, CONST_STRINGS.ROOM_PERMISSION_DENIED);
                }
            } catch (e) {
                pushLogs(config, 'set-password', e);
            }
        });

        socket.on('disconnect-with', (remoteUserId: string, callback: () => void) => {
            try {
                if (listOfUsers[socket.userid] && listOfUsers[socket.userid].connectedWith[remoteUserId]) {
                    delete listOfUsers[socket.userid].connectedWith[remoteUserId];
                    socket.emit('user-disconnected', remoteUserId);
                }

                if (!listOfUsers[remoteUserId]) return callback();

                if (listOfUsers[remoteUserId].connectedWith[socket.userid]) {
                    delete listOfUsers[remoteUserId].connectedWith[socket.userid];
                    listOfUsers[remoteUserId].socket.emit('user-disconnected', socket.userid);
                }
                callback();
            } catch (e) {
                pushLogs(config, 'disconnect-with', e);
            }
        });

        socket.on('close-entire-session', (callback: (success: boolean, error?: string) => void) => {
            try {
                if (!callback || typeof callback !== 'function') {
                    callback = function () {};
                }

                const user = listOfUsers[socket.userid];

                if (!user) return callback(false, CONST_STRINGS.USERID_NOT_AVAILABLE);
                if (!user.roomid) return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
                if (!socket.admininfo) return callback(false, CONST_STRINGS.INVALID_SOCKET);

                const room = listOfRooms[user.roomid];
                if (!room) return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
                if (room.owner !== user.socket.userid) return callback(false, CONST_STRINGS.ROOM_PERMISSION_DENIED);

                autoCloseEntireSession = true;
                closeOrShiftRoom();

                callback(true);
            } catch (e) {
                pushLogs(config, 'close-entire-session', e);
            }
        });

        socket.on('check-presence', (roomid: string, callback: (isPresent: boolean, roomid: string, extra: any) => void) => {
            try {
                if (!listOfRooms[roomid] || !listOfRooms[roomid].participants.length) {
                    callback(false, roomid, {
                        _room: {
                            isFull: false,
                            isPasswordProtected: false
                        }
                    });
                } else {
                    let extra = listOfRooms[roomid].extra;
                    if (typeof extra !== 'object' || !extra) {
                        extra = {
                            value: extra
                        };
                    }
                    extra._room = {
                        isFull: listOfRooms[roomid].participants.length >= listOfRooms[roomid].maxParticipantsAllowed,
                        isPasswordProtected: !!listOfRooms[roomid].password && listOfRooms[roomid].password.toString().replace(/ /g, '').length > 0
                    };
                    callback(true, roomid, extra);
                }
            } catch (e) {
                pushLogs(config, 'check-presence', e);
            }
        });

        function onMessageCallback(message: any) {
            try {
                if (!listOfUsers[message.sender]) {
                    socket.emit('user-not-found', message.sender);
                    return;
                }

                if (!message.message.userLeft && !listOfUsers[message.sender].connectedWith[message.remoteUserId] && !!listOfUsers[message.remoteUserId]) {
                    listOfUsers[message.sender].connectedWith[message.remoteUserId] = listOfUsers[message.remoteUserId].socket;
                    listOfUsers[message.sender].socket.emit('user-connected', message.remoteUserId);

                    if (!listOfUsers[message.remoteUserId]) {
                        // This seems incorrect, as socket would be null.
                        // Consider refactoring this part based on expected behavior.
                        listOfUsers[message.remoteUserId] = {
                            socket: null as any, // Or handle this case more gracefully
                            connectedWith: {},
                            extra: {},
                            socketMessageEvent: '',
                            socketCustomEvent: ''
                        };
                    }

                    listOfUsers[message.remoteUserId].connectedWith[message.sender] = socket;

                    if (listOfUsers[message.remoteUserId].socket) {
                        listOfUsers[message.remoteUserId].socket.emit('user-connected', message.sender);
                    }
                }

                if (listOfUsers[message.sender] && listOfUsers[message.sender].connectedWith[message.remoteUserId] && listOfUsers[socket.userid]) {
                    message.extra = listOfUsers[socket.userid].extra;
                    listOfUsers[message.sender].connectedWith[message.remoteUserId].emit(socketMessageEvent, message);
                }
            } catch (e) {
                pushLogs(config, 'onMessageCallback', e);
            }
        }

        function joinARoom(message: any) {
            try {
                if (!socket.admininfo || !socket.admininfo.sessionid) return;

                const roomid = socket.admininfo.sessionid;

                if (!listOfRooms[roomid]) return;

                if (listOfRooms[roomid].participants.length >= listOfRooms[roomid].maxParticipantsAllowed && listOfRooms[roomid].participants.indexOf(socket.userid) === -1) {
                    return;
                }

                if (listOfRooms[roomid].session && (listOfRooms[roomid].session.oneway === true || listOfRooms[roomid].session.broadcast === true)) {
                    const owner = listOfRooms[roomid].owner;
                    if (listOfUsers[owner]) {
                        message.remoteUserId = owner;

                        if (enableScalableBroadcast === false) {
                            listOfUsers[owner].socket.emit(socketMessageEvent, message);
                        }
                    }
                    return;
                }

                if (enableScalableBroadcast === false) {
                    listOfRooms[roomid].participants.forEach((pid) => {
                        if (pid === socket.userid || !listOfUsers[pid]) return;

                        const user = listOfUsers[pid];
                        message.remoteUserId = pid;
                        user.socket.emit(socketMessageEvent, message);
                    });
                }
            } catch (e) {
                pushLogs(config, 'joinARoom', e);
            }
        }

        function appendToRoom(roomid: string, userid: string) {
            try {
                if (!listOfRooms[roomid]) {
                    listOfRooms[roomid] = {
                        maxParticipantsAllowed: parseInt(params.maxParticipantsAllowed as string || '1000') || 1000,
                        owner: userid,
                        participants: [userid],
                        extra: {},
                        socketMessageEvent: '',
                        socketCustomEvent: '',
                        identifier: '',
                        session: {
                            audio: true,
                            video: true
                        }
                    };
                }

                if (listOfRooms[roomid].participants.indexOf(userid) !== -1) return;
                listOfRooms[roomid].participants.push(userid);
            } catch (e) {
                pushLogs(config, 'appendToRoom', e);
            }
        }

        function closeOrShiftRoom() {
            try {
                if (!socket.admininfo) {
                    return;
                }

                const roomid = socket.admininfo.sessionid;

                if (roomid && listOfRooms[roomid]) {
                                        if (socket.userid === listOfRooms[roomid].owner) {
                        if (autoCloseEntireSession === false && listOfRooms[roomid].participants.length > 1) {
                            let firstParticipant: User | undefined;
                            listOfRooms[roomid].participants.forEach((pid) => {
                                if (firstParticipant || pid === socket.userid) return;
                                if (!listOfUsers[pid]) return;
                                firstParticipant = listOfUsers[pid];
                            });

                            if (firstParticipant) {
                                listOfRooms[roomid].owner = firstParticipant.socket.userid;
                                firstParticipant.socket.emit('set-isInitiator-true', roomid);

                                const newParticipantsList = listOfRooms[roomid].participants.filter(pid => pid !== socket.userid);
                                listOfRooms[roomid].participants = newParticipantsList;
                            } else {
                                delete listOfRooms[roomid];
                            }
                        } else {
                            delete listOfRooms[roomid];
                        }
                    } else {
                                                const newParticipantsList = listOfRooms[roomid].participants.filter(pid => pid && pid !== socket.userid && listOfUsers[pid]);
                        listOfRooms[roomid].participants = newParticipantsList;
                    }
                }
            } catch (e) {
                pushLogs(config, 'closeOrShiftRoom', e);
            }
        }

        socket.on(socketMessageEvent, (message: any, callback: (isPresent: boolean, userid: string) => void) => {
            if (message.remoteUserId && message.remoteUserId === socket.userid) {
                return;
            }

            try {
                                        if (message.remoteUserId && message.remoteUserId !== 'system' && message.message.newParticipationRequest) {
                if (enableScalableBroadcast) {
                        const user = listOfUsers[message.remoteUserId];
                        if (user) {
                            user.socket.emit(socketMessageEvent, message);
                        }

                        if (listOfUsers[socket.userid] && listOfUsers[socket.userid].extra.broadcastId) {
                            appendToRoom(listOfUsers[socket.userid].extra.broadcastId, socket.userid);
                        }
                    } else if (listOfRooms[message.remoteUserId]) {
                        joinARoom(message);
                        return;
                    }
                }

                                if (message.remoteUserId === 'system') {
                    if (message.message.detectPresence) {
                        if (message.message.userid === socket.userid) {
                            callback(false, socket.userid);
                            return;
                        }

                        callback(!!listOfUsers[message.message.userid], message.message.userid);
                        return;
                    }
                }

                if (!listOfUsers[message.sender]) {
                    listOfUsers[message.sender] = {
                        socket: socket,
                        connectedWith: {},
                        extra: {},
                        socketMessageEvent: '',
                        socketCustomEvent: ''
                    };
                }

                onMessageCallback(message);
            } catch (e) {
                pushLogs(config, 'on-socketMessageEvent', e);
            }
        });

        socket.on('is-valid-password', (password: string, roomid: string, callback: (isValid: boolean, roomid: string, error: string) => void) => {
            try {
                callback = callback || function () {};

                if (!password || !password.toString().replace(/ /g, '').length) {
                    callback(false, roomid, 'You did not enter the password.');
                    return;
                }

                if (!roomid || !roomid.toString().replace(/ /g, '').length) {
                    callback(false, roomid, 'You did not enter the room-id.');
                    return;
                }

                if (!listOfRooms[roomid]) {
                    callback(false, roomid, CONST_STRINGS.ROOM_NOT_AVAILABLE);
                    return;
                }

                if (!listOfRooms[roomid].password) {
                    callback(false, roomid, 'This room do not have any password.');
                    return;
                }

                if (listOfRooms[roomid].password === password) {
                    callback(true, roomid, '');
                } else {
                    callback(false, roomid, CONST_STRINGS.INVALID_PASSWORD);
                }
            } catch (e) {
                pushLogs(config,'is-valid-password', e);
            }
        });

        socket.on('get-public-rooms', (identifier: string, callback: (rooms: any[] | null, error?: string) => void) => {
            try {
                if (!identifier || !identifier.toString().length || !identifier.toString().replace(/ /g, '').length) {
                    callback(null, CONST_STRINGS.PUBLIC_IDENTIFIER_MISSING);
                    return;
                }

                const rooms: any[] = [];
                Object.keys(listOfRooms).forEach((key) => {
                    const room = listOfRooms[key];
                    if (!room || !room.identifier || !room.identifier.toString().length || room.identifier !== identifier) return;
                    rooms.push({
                        maxParticipantsAllowed: room.maxParticipantsAllowed,
                        owner: room.owner,
                        participants: room.participants,
                        extra: room.extra,
                        session: room.session,
                        sessionid: key,
                        isRoomFull: room.participants.length >= room.maxParticipantsAllowed,
                        isPasswordProtected: !!room.password && room.password.replace(/ /g, '').length > 0
                    });
                });

                callback(rooms);
            } catch (e) {
                pushLogs(config,'get-public-rooms', e);
            }
        });

        socket.on('open-room', (arg: any, callback: (success: boolean, error?: string) => void) => {
            callback = callback || function () {};

            try {
                closeOrShiftRoom();

                if (listOfRooms[arg.sessionid] && listOfRooms[arg.sessionid].participants.length) {
                    callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
                    return;
                }

                if (enableScalableBroadcast === true) {
                    arg.session.scalable = true;
                    arg.sessionid = arg.extra.broadcastId;
                }

                if (!listOfUsers[socket.userid]) {
                    listOfUsers[socket.userid] = {
                        socket: socket,
                        connectedWith: {},
                        extra: arg.extra,
                        socketMessageEvent: (params.socketMessageEvent as string) || '',
                        socketCustomEvent: (params.socketCustomEvent as string) || ''
                    };
                }
                listOfUsers[socket.userid].extra = arg.extra;

                if (arg.session && (arg.session.oneway === true || arg.session.broadcast === true)) {
                    autoCloseEntireSession = true;
                }
            } catch (e) {
                pushLogs(config, 'open-room', e);
            }

            appendToRoom(arg.sessionid, socket.userid);

            try {
                if (enableScalableBroadcast === true) {
                    if (Object.keys(listOfRooms[arg.sessionid]).length == 1) {
                        listOfRooms[arg.sessionid].owner = socket.userid;
                        listOfRooms[arg.sessionid].session = arg.session;
                    }
                } else {
                    listOfRooms[arg.sessionid].owner = socket.userid;
                    listOfRooms[arg.sessionid].session = arg.session;
                    listOfRooms[arg.sessionid].extra = arg.extra || {};
                    listOfRooms[arg.sessionid].socketMessageEvent = listOfUsers[socket.userid].socketMessageEvent;
                    listOfRooms[arg.sessionid].socketCustomEvent = listOfUsers[socket.userid].socketCustomEvent;
                    listOfRooms[arg.sessionid].maxParticipantsAllowed = parseInt(params.maxParticipantsAllowed as string || '1000') || 1000;

                    if (arg.identifier && arg.identifier.toString().length) {
                        listOfRooms[arg.sessionid].identifier = arg.identifier;
                    }

                    try {
                        if (typeof arg.password !== 'undefined' && arg.password.toString().length) {
                            listOfRooms[arg.sessionid].password = arg.password;
                        }
                    } catch (e) {
                        pushLogs(config, 'open-room.password', e);
                    }
                }

                listOfUsers[socket.userid].socket.admininfo = {
                    sessionid: arg.sessionid,
                    session: arg.session,
                    mediaConstraints: arg.mediaConstraints,
                    sdpConstraints: arg.sdpConstraints,
                    streams: arg.streams,
                    extra: arg.extra
                };
            } catch (e) {
                pushLogs(config, 'open-room', e);
            }

            try {
                callback(true);
            } catch (e) {
                pushLogs(config, 'open-room', e);
            }
        });

        socket.on('join-room', (arg: any, callback: (success: boolean, error?: string) => void) => {
            callback = callback || function () {};

            try {
                closeOrShiftRoom();

                if (enableScalableBroadcast === true) {
                    arg.session.scalable = true;
                    arg.sessionid = arg.extra.broadcastId;
                }

                if (!listOfUsers[socket.userid]) {
                    listOfUsers[socket.userid] = {
                        socket: socket,
                        connectedWith: {},
                        extra: arg.extra,
                        socketMessageEvent: (params.socketMessageEvent as string) || '',
                        socketCustomEvent: (params.socketCustomEvent as string) || ''
                    };
                }
                listOfUsers[socket.userid].extra = arg.extra;
            } catch (e) {
                pushLogs(config, 'join-room', e);
            }

            try {
                if (!listOfRooms[arg.sessionid]) {
                    callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
                    return;
                }
            } catch (e) {
                pushLogs(config, 'join-room', e);
            }

            try {
                if (listOfRooms[arg.sessionid].password && listOfRooms[arg.sessionid].password != arg.password) {
                    callback(false, CONST_STRINGS.INVALID_PASSWORD);
                    return;
                }
            } catch (e) {
                pushLogs(config, 'join-room.password', e);
            }

            try {
                if (listOfRooms[arg.sessionid].participants.length >= listOfRooms[arg.sessionid].maxParticipantsAllowed) {
                    callback(false, CONST_STRINGS.ROOM_FULL);
                    return;
                }
            } catch (e) {
                pushLogs(config, 'join-room.ROOM_FULL', e);
            }

            appendToRoom(arg.sessionid, socket.userid);

            try {
                listOfUsers[socket.userid].socket.admininfo = {
                    sessionid: arg.sessionid,
                    session: arg.session,
                    mediaConstraints: arg.mediaConstraints,
                    sdpConstraints: arg.sdpConstraints,
                    streams: arg.streams,
                    extra: arg.extra
                };
            } catch (e) {
                pushLogs(config, 'join-room', e);
            }

            try {
                callback(true);
            } catch (e) {
                pushLogs(config, 'join-room', e);
            }
        });

        socket.on('disconnect', () => {
            try {
                // 'this' context might be tricky here. Using 'socket' directly.
                if (socket && socket.nsp && socket.nsp.sockets) {
                    delete (socket.nsp.sockets as any)[socket.id];
                }
            } catch (e) {
                pushLogs(config, 'disconnect', e);
            }

            try {
                if (listOfUsers[socket.userid]) {
                    for (let s in listOfUsers[socket.userid].connectedWith) {
                        listOfUsers[socket.userid].connectedWith[s].emit('user-disconnected', socket.userid);

                        if (listOfUsers[s] && listOfUsers[s].connectedWith[socket.userid]) {
                            delete listOfUsers[s].connectedWith[socket.userid];
                            listOfUsers[s].socket.emit('user-disconnected', socket.userid);
                        }
                    }
                }
            } catch (e) {
                pushLogs(config, 'disconnect', e);
            }

            closeOrShiftRoom();

            delete listOfUsers[socket.userid];

            if (socket.ondisconnect) {
                try {
                    socket.ondisconnect();
                } catch (e) {
                    pushLogs(config,'socket.ondisconnect', e);
                }
            }
        });
    }
};