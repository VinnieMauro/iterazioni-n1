console.log('✅ app.js caricato');

console.log('📱 User Agent:', navigator.userAgent);

import * as THREE from './libs/three.module.js';
import { ARButton } from './libs/ARButton.js';
import { io } from './libs/socket.io.esm.min.js';

const socket = io();

let camera, scene, renderer;
let listener;
const cubes = {};
const positionalAudios = {};
const peers = {};
const streamSourceReady = { 1: false, 2: false };
const buffers = {};
let audioContext = null;

// Posizioni cubi aggiornate da server
const cubePositions = { 1: new THREE.Vector3(), 2: new THREE.Vector3() };

async function initAR() {
  console.log('🚀 initAR chiamato');
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 0);

  listener = new THREE.AudioListener();
  camera.add(listener);

  audioContext = listener.context;

  try {
    await audioContext.audioWorklet.addModule('circular-buffer-processor.js');
    console.log('✅ AudioWorklet caricato');
  } catch(e) {
    console.warn('⚠️ AudioWorklet non caricato:', e);
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
  document.body.appendChild(arButton);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444);
  scene.add(light);

  [1, 2].forEach(i => {
    cubes[i] = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ color: i === 1 ? 0xff0000 : 0x00ff00 })
    );
    scene.add(cubes[i]);

    positionalAudios[i] = new THREE.PositionalAudio(listener);
    positionalAudios[i].setRefDistance(0.2);
    positionalAudios[i].setRolloffFactor(1);
    positionalAudios[i].setDistanceModel('exponential');
    positionalAudios[i].panner.panningModel = 'HRTF';

    cubes[i].add(positionalAudios[i]);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

function animate() {
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);

    listener.position.copy(camera.position);
    listener.quaternion.copy(camera.quaternion);
    listener.updateMatrixWorld();

    Object.keys(cubes).forEach(i => {
      const idx = parseInt(i);
      if (cubes[idx]) {
        cubes[idx].position.copy(cubePositions[idx]);
        cubes[idx].updateMatrixWorld();
      }
      if (positionalAudios[idx]) {
        positionalAudios[idx].updateMatrixWorld();
      }
    });
  });
}

// === WEBRTC SETUP ===

function createPeerConnection(cubeIndex, remoteId) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-candidate', {
        target: remoteId,
        candidate: event.candidate,
        cubeIndex,
      });
    }
  };

  pc.ontrack = (event) => {
    console.log(`🎧 Track ricevuta per cubo ${cubeIndex}`, event.streams[0]);

    if (!positionalAudios[cubeIndex]) {
      console.warn('⚠️ PositionalAudio non trovato per cubo', cubeIndex);
      return;
    }

    const stream = event.streams[0];
    positionalAudios[cubeIndex].setMediaStream(stream);
    if (!streamSourceReady[cubeIndex]) {
      positionalAudios[cubeIndex].play();
      streamSourceReady[cubeIndex] = true;
      console.log(`▶️ Audio spazializzato cubo ${cubeIndex} avviato`);
    }
  };

  return pc;
}

socket.on('webrtc-offer', async ({ from, offer, cubeIndex }) => {
  console.log(`📩 Offerta WebRTC per cubo ${cubeIndex} da ${from}`);

  if (!peers[cubeIndex]) {
    peers[cubeIndex] = createPeerConnection(cubeIndex, from);
  }

  try {
    await peers[cubeIndex].setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peers[cubeIndex].createAnswer();
    await peers[cubeIndex].setLocalDescription(answer);

    socket.emit('webrtc-answer', {
      target: from,
      answer,
      cubeIndex,
    });
  } catch (e) {
    console.error('❌ Errore nella risposta WebRTC:', e);
  }
});

socket.on('webrtc-answer', async ({ from, answer, cubeIndex }) => {
  console.log(`📩 Risposta WebRTC per cubo ${cubeIndex} da ${from}`);

  if (peers[cubeIndex]) {
    try {
      await peers[cubeIndex].setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error('❌ Errore setRemoteDescription answer:', e);
    }
  }
});

socket.on('webrtc-candidate', async ({ from, candidate, cubeIndex }) => {
  console.log(`📩 Candidato ICE per cubo ${cubeIndex} da ${from}`);

  if (peers[cubeIndex]) {
    try {
      await peers[cubeIndex].addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('❌ Errore addIceCandidate:', e);
    }
  }
});

// === GESTIONE MOVIMENTO CUBI

socket.on('move-cube', ({ index, x, y, z }) => {
  console.log(`📦 Ricevuto move-cube: cubo ${index} -> x:${x}, y:${y}, z:${z}`);
  cubePositions[index].set(x, y, z);
});

// === INIT & ENABLE BUTTON

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOMContentLoaded');
  const enableButton = document.getElementById('enableButton');
  if (enableButton) {
    console.log('🔘 Bottone trovato, attacco handler');
    enableButton.onclick = async () => {
      console.log('👉 Bottone cliccato');
      try {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          console.log('🎧 AudioContext creato');
        }
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
          const permission = await DeviceMotionEvent.requestPermission();
          console.log('📱 Permesso sensori:', permission);
          if (permission !== 'granted') throw new Error('Permessi sensori negati');
        }
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('🎧 AudioContext ripreso');
        }
        document.getElementById('overlay').style.display = 'none';
        await initAR();
        socket.emit('receiver-ready');
      } catch (e) {
        alert('❌ Errore permessi sensori o audio: ' + e.message);
        console.error(e);
      }
    };
  } else {
    console.warn('⚠️ Bottone Abilita non trovato!');
  }
});