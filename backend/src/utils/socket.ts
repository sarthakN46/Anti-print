import { Server } from 'socket.io';

let io: Server;

export const initSocket = (serverIo: Server) => {
  io = serverIo;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};