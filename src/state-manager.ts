import { User, Room } from './types';
import pushLogs from './pushLogs'; // Asumiendo que pushLogs está en un archivo de utilidades

export class StateManager {
    private listOfUsers: { [key: string]: User } = {};
    private listOfRooms: { [key: string]: Room } = {};
    private config: any;

    constructor(config: any) {
        this.config = config;
    }

    // --- Métodos de Usuario ---
    getUser(userid: string): User | undefined {
        return this.listOfUsers[userid];
    }

    addUser(user: User): void {
        this.listOfUsers[user.socket.userid] = user;
    }

    removeUser(userid: string): void {
        const user = this.getUser(userid);
        if (!user) return;

        // Notificar a los usuarios conectados con él
        try {
            for (const connectedUserId in user.connectedWith) {
                const connectedUser = this.getUser(connectedUserId);
                if (connectedUser) {
                    delete connectedUser.connectedWith[userid];
                    connectedUser.socket.emit('user-disconnected', userid);
                }
            }
        } catch (e) {
            pushLogs(this.config, 'removeUser.connectedWith', e);
        }

        delete this.listOfUsers[userid];
    }

    getUsers(): { [key: string]: User } {
        return this.listOfUsers;
    }
    
    // --- Métodos de Sala ---
    getRoom(roomid: string): Room | undefined {
        return this.listOfRooms[roomid];
    }

    addRoom(room: Room, roomid: string): void {
        this.listOfRooms[roomid] = room;
    }

    removeRoom(roomid: string): void {
        delete this.listOfRooms[roomid];
    }

    addUserToRoom(roomid: string, userid: string): void {
        const room = this.getRoom(roomid);
        if (room && room.participants.indexOf(userid) === -1) {
            room.participants.push(userid);
        }
    }

    removeUserFromRoom(roomid: string, userid: string): void {
        const room = this.getRoom(roomid);
        if (room) {
            room.participants = room.participants.filter(pid => pid !== userid);
        }
    }
    
    findPublicRooms(identifier: string): any[] {
        const rooms: any[] = [];
        Object.keys(this.listOfRooms).forEach((key) => {
            const room = this.listOfRooms[key];
            if (room && room.identifier === identifier) {
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
            }
        });
        return rooms;
    }
    
    getRooms(): { [key: string]: Room } {
        return this.listOfRooms;
    }
}