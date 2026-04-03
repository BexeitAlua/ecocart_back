const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication required'));
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        logger.info(`Socket connected: ${socket.id} | User: ${socket.userId}`);

        socket.on('join_fridge', (fridgeId) => {
            socket.join(`fridge:${fridgeId}`);
            logger.debug(`User ${socket.userId} joined fridge room: ${fridgeId}`);
        });

        socket.on('leave_fridge', (fridgeId) => {
            socket.leave(`fridge:${fridgeId}`);
        });

        socket.on('join_user', () => {
            socket.join(`user:${socket.userId}`);
        });

        socket.on('disconnect', () => {
            logger.info(`Socket disconnected: ${socket.id}`);
        });
    });

    logger.info('Socket.io initialized');
    return io;
};

const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
};

const emitToFridge = (fridgeId, event, data) => {
    if (!io) return;
    io.to(`fridge:${fridgeId}`).emit(event, data);
};

const emitToUser = (userId, event, data) => {
    if (!io) return;
    io.to(`user:${userId}`).emit(event, data);
};

module.exports = { initSocket, getIO, emitToFridge, emitToUser };