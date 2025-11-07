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

    // Handle donor acceptance
    socket.on('donor-accepted', (data) => {
      // Notify the recipient
      io.to(`user-${data.recipientId}`).emit('donor-accepted', {
        donorName: data.donorName,
        requestId: data.requestId,
        message: `${data.donorName} has accepted your blood request!`
      });
      
      // Broadcast to admin dashboard
      io.to('admin-room').emit('request-update', {
        type: 'acceptance',
        data
      });
    });

    // Handle blood request creation
    socket.on('blood-request-created', (data) => {
      // Notify matched donors
      if (data.matchedDonors) {
        data.matchedDonors.forEach(donorId => {
          io.to(`user-${donorId}`).emit('new-blood-request', data);
        });
      }
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

    // Handle delivery updates
    socket.on('delivery-status-update', (data) => {
      // Notify recipient
      io.to(`user-${data.recipientId}`).emit('delivery-updated', data);
      
      // Notify admin
      io.to('admin-room').emit('delivery-updated', data);
    });

    socket.on('donation-completed', (data) => {
      io.emit('new-donation', data);
    });

    // Handle emergency requests
    socket.on('emergency-request', (data) => {
      // Broadcast to all online donors with compatible blood type
      io.emit('emergency-blood-request', data);
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
        console.log(`User ${socket.userId} disconnected`);
      }
      console.log('Client disconnected:', socket.id);
    });
  });
};
