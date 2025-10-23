const io = require('socket.io-client');
// Connect to the server: use local host or LAN IP
const socket = io('https://localhost:3000', { rejectUnauthorized: false });

const maxApi = require('max-api');

// Handler for commands coming from Max
maxApi.addHandler('setPosition', (index, x, y, z) => {
  maxApi.post('Received from Max:', index, x, y, z);
  setPosition(index, x, y, z);
});

maxApi.addHandler('playSound', () => {
  socket.emit('sync-play'); // command to trigger synchronized playback
  maxApi.post('🔔 Synchronized playSound command sent');
});

function mpost(msg) {
  if (typeof post !== 'undefined') {
    post(msg + '\n');
  } else {
    console.log(msg);
  }
}

// Debug connection status
socket.on('connect', () => {
  mpost('✅ Connected to the server');
});
socket.on('connect_error', (err) => {
  mpost('❌ Socket.io connection error: ' + err.message);
});

// Receive each listener's position (user) from the web app
socket.on('listener-position', ({ id, x, z }) => {
  //maxApi.post(`📍 Listener position ${id}: x=${x}, z=${z}`);
  // Forward data to Max patch: [listenerPosition, id, x, z]
  maxApi.outlet('listenerPosition', id, x, z);
});

// Send cube position via socket
function setPosition(index, x, y, z) {
  try {
    socket.emit('move-cube', { index, x, y, z });
    mpost(`📤 Cube #${index} position sent: x=${x} y=${y} z=${z}`);
  } catch (err) {
    mpost('❌ Error emitting move-cube: ' + err.message);
  }
}