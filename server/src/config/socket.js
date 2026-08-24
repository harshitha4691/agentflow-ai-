const { Server } = require('socket.io');

let io;

function initSocket(server, clientUrl) {
  io = new Server(server, {
    cors: {
      origin: clientUrl || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    socket.on('workflow:join', (workflowId) => {
      socket.join(`workflow:${workflowId}`);
    });

    socket.on('execution:join', (executionId) => {
      socket.join(`execution:${executionId}`);
    });

    socket.on('workflow:leave', (workflowId) => {
      socket.leave(`workflow:${workflowId}`);
    });

    socket.on('execution:leave', (executionId) => {
      socket.leave(`execution:${executionId}`);
    });
  });

  return io;
}

function emitEvent(channel, event, payload) {
  if (!io) return;
  if (channel) {
    io.to(channel).emit(event, payload);
  } else {
    io.emit(event, payload);
  }
}

function getIO() {
  return io;
}

module.exports = { initSocket, emitEvent, getIO };
