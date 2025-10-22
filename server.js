const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const { Server } = require("socket.io");

const app = express();

const options = {
  key: fs.readFileSync(path.join(__dirname, "certs/server.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs/server.pem")),
};

const server = https.createServer(options, app);
const io = new Server(server);

// ID numerici progressivi per client
let nextClientId = 1;
const clientIdMap = new Map(); // socket.id → assigned numeric ID

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  const ua = req.headers["user-agent"] || "";
  if (/android/i.test(ua)) {
    res.sendFile(path.join(__dirname, "public", "index-mindar.html"));
  } else {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

let senderSocketId = null;
const receivers = new Set();
const cubePositions = {
  1: { x: 0, y: 0, z: -2 },
  2: { x: 1, y: 0, z: -2 },
};

const listenerIdMap = new Map(); // socket.id → myId

io.on("connection", (socket) => {
  console.log("🆕 Client connesso:", socket.id);

  // assegna un ID univoco e incrementale a questo socket
  const assignedId = nextClientId++;
  clientIdMap.set(socket.id, assignedId);
  socket.emit("assignId", assignedId);
  console.log(`🆔 ID assegnato a ${socket.id}: ${assignedId}`);

  socket.on("sender-ready", () => {
    senderSocketId = socket.id;
    console.log("🚀 Sender pronto:", senderSocketId);
  });

  socket.on("receiver-ready", () => {
    receivers.add(socket.id);
    console.log("👂 Receiver pronto:", socket.id);

    Object.entries(cubePositions).forEach(([index, pos]) => {
      io.to(socket.id).emit("move-cube", { index: parseInt(index), ...pos });
    });

    if (senderSocketId) {
      io.to(senderSocketId).emit("new-receiver", { receiverId: socket.id });
    }
  });

  socket.on("move-cube", ({ index, x, y, z }) => {
    cubePositions[index] = { x, y, z };
    socket.broadcast.emit("move-cube", { index, x, y, z });
    console.log(`📦 Cubo ${index} spostato a x:${x}, y:${y}, z:${z}`);
  });

  socket.on("listener-position", ({ id, x, z }) => {
    listenerIdMap.set(socket.id, id);
    io.emit("listener-position", { id, x, z });
  });

  socket.on("disconnect", () => {
    const listenerId = listenerIdMap.get(socket.id);
    if (listenerId) {
      io.emit("listener-disconnected", listenerId);
      listenerIdMap.delete(socket.id);
      console.log(`🗑️ Listener ${listenerId} rimosso`);
    }

    receivers.delete(socket.id);
    if (socket.id === senderSocketId) senderSocketId = null;
    console.log("❌ Client disconnesso:", socket.id);

    // rimuove l'ID assegnato a questo socket
    clientIdMap.delete(socket.id);
  });

  socket.on("webrtc-offer", ({ target, offer, cubeIndex }) => {
    io.to(target).emit("webrtc-offer", { from: socket.id, offer, cubeIndex });
  });

  socket.on("webrtc-answer", ({ target, answer, cubeIndex }) => {
    io.to(target).emit("webrtc-answer", { from: socket.id, answer, cubeIndex });
  });

  socket.on("webrtc-candidate", ({ target, candidate, cubeIndex }) => {
    io.to(target).emit("webrtc-candidate", { from: socket.id, candidate, cubeIndex });
  });
});

// 🔽 Solo per il log dell'interfaccia selezionata
function getLocalIPv4Interfaces() {
  const interfaces = os.networkInterfaces();
  const list = [];
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        list.push({ name, address: iface.address });
      }
    }
  }
  return list;
}

const PORT = process.env.PORT || 3000;
const interfaces = getLocalIPv4Interfaces();

if (interfaces.length === 0) {
  console.log(`🌐 Server HTTPS attivo su https://localhost:${PORT}`);
  server.listen(PORT, '0.0.0.0');
} else {
  console.log("🌐 Interfacce disponibili:");
  interfaces.forEach((iface, i) => {
    console.log(`  [${i}] ${iface.name}: ${iface.address}`);
  });

  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question("Seleziona l'interfaccia da usare per il log (numero): ", (answer) => {
    const index = parseInt(answer);
    const ip = (interfaces[index] && interfaces[index].address) || 'localhost';
    rl.close();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 Server HTTPS attivo su https://${ip}:${PORT}`);
    });
  });
}