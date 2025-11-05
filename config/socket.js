export const setupSocketHandlers = (io) => {
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('user-connected', (userId) => {
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      // Join user-specific room for targeted notifications
      socket.join(`user-${userId}`);
      console.log(`User ${userId} connected and joined room`);
    });

    socket.on('update-location', (data) => {
      // Broadcast location update to all users
      socket.broadcast.emit('user-location-updated', {
        userId: socket.userId,
        coordinates: data.coordinates,
        role: data.role,
        bloodType: data.bloodType
      });
    });

    socket.on('blood-request-created', (data) => {
      // Send to specific matched donors
      if (data.matchedDonors) {
        data.matchedDonors.forEach(donorId => {
          io.to(`user-${donorId}`).emit('new-blood-request', data);
        });
      }
      // Also broadcast to all users in the area
      io.emit('new-blood-request-nearby', data);
    });

    socket.on('delivery-status-update', (data) => {
      io.emit('delivery-updated', data);
    });

    socket.on('donation-completed', (data) => {
      io.emit('new-donation', data);
    });

    socket.on('request-help', (data) => {
      // Emergency broadcast to all nearby donors
      io.emit('emergency-request', data);
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        // Notify others that user went offline
        socket.broadcast.emit('user-offline', socket.userId);
      }
      console.log('Client disconnected:', socket.id);
    });
  });
};
