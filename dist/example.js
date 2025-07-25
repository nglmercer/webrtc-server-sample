"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ACRHIVO DE PRUEBA DE WEBRTC
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const signaling_server_1 = __importDefault(require("./signaling_server"));
const app = (0, express_1.default)();
const httpServer = http_1.default.createServer(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
    }
});
const PORT = process.env.PORT || 9001;
app.use(express_1.default.static('public'));
io.on('connection', (socket) => {
    console.log(`\n[Server] New user connected with socket ID: ${socket.id}`);
    (0, signaling_server_1.default)(socket, {});
    socket.on('disconnect', () => {
        console.log(`[Server] User with socket ID ${socket.id} has disconnected.`);
    });
});
httpServer.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
});
