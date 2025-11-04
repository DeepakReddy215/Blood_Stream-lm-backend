export const setupSocketHandlers = (io) => {
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('user-connected', (userId) => {
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      console.log(`User ${userId} connected`);
    });

    socket.on('blood-request-created', (data) => {
      io.emit('new-blood-request', data);
    });

    socket.on('delivery-status-update', (data) => {
      io.emit('delivery-updated', data);
    });

    socket.on('donation-completed', (data) => {
      io.emit('new-donation', data);
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
      }
      console.log('Client disconnected:', socket.id);
    });
  });
};
