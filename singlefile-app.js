// Single-file Mount & Blade-like minimal web demo
// Run: node singlefile-app.js, then open http://localhost:3001

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// --------------------------- Server-side Simulation ---------------------------

const TICK_RATE_HZ = 20;
const MS_PER_TICK = 1000 / TICK_RATE_HZ;
const PARTY_DEFAULT_SPEED = 3.5; // tiles per second

function now() { return Date.now(); }

function generateId() {
  // Simple unique id
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** @typedef {{ id:string, socket:WebSocket, playerName?:string, partyId?:string }} Connection */
/** @typedef {{ id:string, name:string, x:number, y:number, speed:number, target?:{x:number,y:number}|null }} Party */

/** @type {Map<string, Connection>} */
const connections = new Map();
/** @type {Map<string, Party>} */
const parties = new Map();

function createParty(name, x, y) {
  const id = generateId();
  const party = { id, name, x, y, speed: PARTY_DEFAULT_SPEED, target: null };
  parties.set(id, party);
  return party;
}

function stepParties(deltaSeconds) {
  for (const party of parties.values()) {
    if (!party.target) continue;
    const dx = party.target.x - party.x;
    const dy = party.target.y - party.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) {
      party.x = party.target.x;
      party.y = party.target.y;
      party.target = null;
      broadcast({ type: 'party_moved', partyId: party.id, position: { x: party.x, y: party.y } });
      continue;
    }
    const maxStep = party.speed * deltaSeconds;
    const step = Math.min(dist, maxStep);
    const nx = dx / dist;
    const ny = dy / dist;
    party.x += nx * step;
    party.y += ny * step;
    broadcast({ type: 'party_moved', partyId: party.id, position: { x: party.x, y: party.y } });
  }
}

// --------------------------- HTTP + WebSocket Setup ---------------------------

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(indexHtml());
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, time: now(), parties: parties.size, players: connections.size, tickRate: TICK_RATE_HZ });
});

wss.on('connection', (socket) => {
  const id = generateId();
  /** @type {Connection} */
  const conn = { id, socket };
  connections.set(id, conn);

  send(socket, { type: 'welcome', serverVersion: '0.1.0', time: now() });

  socket.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(conn, msg);
    } catch (e) {
      send(socket, { type: 'error', message: 'Invalid message' });
    }
  });

  socket.on('close', () => {
    connections.delete(id);
  });
});

function send(socket, msg) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const { socket } of connections.values()) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

function handleMessage(conn, msg) {
  switch (msg.type) {
    case 'hello': {
      break;
    }
    case 'join_world': {
      conn.playerName = msg.playerName || 'Player';
      const p = createParty(`${conn.playerName}'s Party`, Math.random() * 50, Math.random() * 50);
      conn.partyId = p.id;
      send(conn.socket, { type: 'world_state', time: now(), parties: Array.from(parties.values()), yourPartyId: p.id });
      break;
    }
    case 'move_party': {
      if (!conn.partyId) return send(conn.socket, { type: 'error', message: 'No party' });
      const p = parties.get(conn.partyId);
      if (!p) return send(conn.socket, { type: 'error', message: 'Party missing' });
      p.target = { x: Number(msg.target?.x) || 0, y: Number(msg.target?.y) || 0 };
      break;
    }
    default: {
      send(conn.socket, { type: 'error', message: 'Unknown message' });
    }
  }
}

let lastTick = now();
setInterval(() => {
  const t = now();
  const deltaMs = t - lastTick;
  lastTick = t;
  stepParties(deltaMs / 1000);
}, MS_PER_TICK);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// --------------------------- Client HTML (served by /) ---------------------------

function indexHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MB Web - Single File</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #20232a; color: #fff; font-family: Inter, system-ui, sans-serif; }
      #hud { position: fixed; top: 8px; left: 12px; background: rgba(0,0,0,0.35); padding: 8px 12px; border-radius: 8px; font-size: 14px; }
      #canvas { display: block; width: 100vw; height: 100vh; }
      a { color: #61dafb; }
    </style>
  </head>
  <body>
    <div id="hud">Click anywhere to move your party. <a href="/health" target="_blank">Health</a></div>
    <canvas id="canvas"></canvas>
    <script>
      (function(){
        const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
        const SCALE = 10; // world tile -> pixels

        /** @type {WebSocket|null} */
        let socket = null;
        /** @type {string|null} */
        let yourPartyId = null;
        /** @type {Map<string,{id:string,name:string,x:number,y:number}>} */
        const parties = new Map();

        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize); resize();

        function connect(){
          if (socket && socket.readyState === WebSocket.OPEN) return;
          socket = new WebSocket(WS_URL);
          socket.addEventListener('open', () => {
            send({ type: 'hello', clientVersion: '0.1.0' });
            send({ type: 'join_world', playerName: 'Player' + Math.floor(Math.random() * 1000) });
          });
          socket.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            handleMessage(msg);
          });
          socket.addEventListener('close', () => {
            setTimeout(connect, 1000);
          });
        }

        function send(msg){ if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg)); }

        function handleMessage(msg){
          switch(msg.type){
            case 'welcome': break;
            case 'world_state': {
              yourPartyId = msg.yourPartyId || null;
              parties.clear();
              for (const p of msg.parties) parties.set(p.id, { id:p.id, name:p.name, x:p.x, y:p.y });
              break;
            }
            case 'party_moved': {
              const p = parties.get(msg.partyId);
              if (p){ p.x = msg.position.x; p.y = msg.position.y; }
              break;
            }
            case 'error': {
              console.warn('Server error:', msg.message);
              break;
            }
          }
        }

        canvas.addEventListener('pointerdown', (e) => {
          if (!yourPartyId) return;
          const rect = canvas.getBoundingClientRect();
          const x = (e.clientX - rect.left) / SCALE;
          const y = (e.clientY - rect.top) / SCALE;
          send({ type: 'move_party', partyId: yourPartyId, target: { x, y } });
        });

        function drawGrid(){
          const gridSize = 10 * SCALE;
          ctx.strokeStyle = '#2a2f3a';
          ctx.lineWidth = 1;
          for (let x = 0; x < canvas.width; x += gridSize){
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
          }
          for (let y = 0; y < canvas.height; y += gridSize){
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
          }
        }

        function render(){
          ctx.fillStyle = '#20232a';
          ctx.fillRect(0,0,canvas.width,canvas.height);
          drawGrid();

          // Draw parties
          for (const p of parties.values()){
            const px = p.x * SCALE;
            const py = p.y * SCALE;
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = (p.id === yourPartyId) ? '#00d8ff' : '#9aa4b2';
            ctx.fill();

            // label
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, px, py - 10);
          }

          requestAnimationFrame(render);
        }

        connect();
        render();
      })();
    </script>
  </body>
</html>`;
}

