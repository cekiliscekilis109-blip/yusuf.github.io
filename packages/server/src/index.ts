import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { MS_PER_TICK, TICK_RATE_HZ, PARTY_DEFAULT_SPEED } from "@mb/shared/src/world/constants";
import type { ClientToServerMessage, ServerToClientMessage } from "@mb/shared/src/protocol/messages";
import { nanoid } from "nanoid";

type Connection = {
  id: string;
  socket: WebSocket;
  playerName?: string;
  partyId?: string;
};

type Party = {
  id: string;
  name: string;
  x: number;
  y: number;
  speed: number; // tiles per second
  target?: { x: number; y: number } | null;
};

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const connections = new Map<string, Connection>();
const parties = new Map<string, Party>();

function now(): number {
  return Date.now();
}

function send(socket: WebSocket, msg: ServerToClientMessage) {
  socket.send(JSON.stringify(msg));
}

function broadcast(msg: ServerToClientMessage) {
  for (const { socket } of connections.values()) {
    if (socket.readyState === WebSocket.OPEN) {
      send(socket, msg);
    }
  }
}

function createParty(name: string, x: number, y: number): Party {
  const id = nanoid();
  const party: Party = { id, name, x, y, speed: PARTY_DEFAULT_SPEED, target: null };
  parties.set(id, party);
  return party;
}

function stepParties(deltaSeconds: number) {
  for (const party of parties.values()) {
    if (!party.target) continue;
    const dx = party.target.x - party.x;
    const dy = party.target.y - party.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) {
      party.x = party.target.x;
      party.y = party.target.y;
      party.target = null;
      broadcast({ type: "party_moved", partyId: party.id, position: { x: party.x, y: party.y } });
      continue;
    }
    const maxStep = party.speed * deltaSeconds;
    const step = Math.min(dist, maxStep);
    const nx = dx / dist;
    const ny = dy / dist;
    party.x += nx * step;
    party.y += ny * step;
    broadcast({ type: "party_moved", partyId: party.id, position: { x: party.x, y: party.y } });
  }
}

let lastTick = now();
setInterval(() => {
  const t = now();
  const deltaMs = t - lastTick;
  lastTick = t;
  stepParties(deltaMs / 1000);
}, MS_PER_TICK);

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: now(), parties: parties.size, players: connections.size, tickRate: TICK_RATE_HZ });
});

wss.on("connection", (socket) => {
  const id = nanoid();
  const conn: Connection = { id, socket };
  connections.set(id, conn);
  send(socket, { type: "welcome", serverVersion: "0.1.0", time: now() });

  socket.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientToServerMessage;
      handleMessage(conn, msg);
    } catch (err) {
      send(socket, { type: "error", message: "Invalid message" });
    }
  });

  socket.on("close", () => {
    connections.delete(id);
  });
});

function handleMessage(conn: Connection, msg: ClientToServerMessage) {
  switch (msg.type) {
    case "hello":
      break;
    case "join_world": {
      conn.playerName = msg.playerName;
      const p = createParty(`${msg.playerName}'s Party`, Math.random() * 50, Math.random() * 50);
      conn.partyId = p.id;
      send(conn.socket, { type: "world_state", time: now(), parties: Array.from(parties.values()) });
      break;
    }
    case "move_party": {
      if (!conn.partyId) return send(conn.socket, { type: "error", message: "No party" });
      const p = parties.get(conn.partyId);
      if (!p) return send(conn.socket, { type: "error", message: "Party missing" });
      p.target = { x: msg.target.x, y: msg.target.y };
      break;
    }
    case "enter_battle": {
      // Placeholder for future battle logic
      break;
    }
    default:
      send(conn.socket, { type: "error", message: "Unknown message" });
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});

