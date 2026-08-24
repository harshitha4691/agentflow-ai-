import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5050';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}

export function joinWorkflow(workflowId) {
  const s = getSocket();
  s.emit('workflow:join', workflowId);
}

export function leaveWorkflow(workflowId) {
  const s = getSocket();
  s.emit('workflow:leave', workflowId);
}

export function joinExecution(executionId) {
  const s = getSocket();
  s.emit('execution:join', executionId);
}

export function leaveExecution(executionId) {
  const s = getSocket();
  s.emit('execution:leave', executionId);
}

export default getSocket;
