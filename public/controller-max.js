const io = require('socket.io-client');
// Connessione al server: usa l'host locale o l'IP della rete
const socket = io('https://localhost:3000', { rejectUnauthorized: false });

const maxApi = require('max-api');

// Handler per comandi da Max
maxApi.addHandler('setPosition', (index, x, y, z) => {
  maxApi.post('Ricevuto da Max:', index, x, y, z);
  setPosition(index, x, y, z);
});

maxApi.addHandler('playSound', () => {
  socket.emit('sync-play'); // comando per avviare suono sincronizzato
  maxApi.post('🔔 Comando playSound sincronizzato inviato');
});

function mpost(msg) {
  if (typeof post !== 'undefined') {
    post(msg + '\n');
  } else {
    console.log(msg);
  }
}

// Debug della connessione
socket.on('connect', () => {
  mpost('✅ Connesso al server');
});
socket.on('connect_error', (err) => {
  mpost('❌ Errore di connessione socket.io: ' + err.message);
});

// Ricezione posizione di ogni listener (utente) dall'app
socket.on('listener-position', ({ id, x, z }) => {
  //maxApi.post(`📍 Posizione utente ${id}: x=${x}, z=${z}`);
  // Inoltra i dati al patch Max: [listenerPosition, id, x, z]
  maxApi.outlet('listenerPosition', id, x, z);
});

// Invia posizione cubo via socket
function setPosition(index, x, y, z) {
  try {
    socket.emit('move-cube', { index, x, y, z });
    mpost(`📤 Posizione cubo #${index} inviata: x=${x} y=${y} z=${z}`);
  } catch (err) {
    mpost('❌ Errore emit move-cube: ' + err.message);
  }
}