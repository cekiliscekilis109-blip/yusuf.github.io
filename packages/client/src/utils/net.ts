import mitt from 'mitt';
import type { ClientToServerMessage, ServerToClientMessage } from '@mb/shared/src/protocol/messages';

type Events = { [K in ServerToClientMessage as K["type"]]: K } & { message: ServerToClientMessage };

class Net {
  private socket: WebSocket | null = null;
  private emitter = mitt<Events>();

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    const url = `ws://localhost:3001`;
    this.socket = new WebSocket(url);
    this.socket.addEventListener('open', () => {
      this.send({ type: 'hello', clientVersion: '0.1.0' });
    });
    this.socket.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data) as ServerToClientMessage;
      this.emitter.emit('message', msg);
      this.emitter.emit(msg.type as any, msg as any);
    });
  }

  on<T extends ServerToClientMessage["type"]>(type: T, handler: (msg: Extract<ServerToClientMessage, { type: T }>) => void) {
    this.emitter.on(type as any, handler as any);
  }

  send(msg: ClientToServerMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(msg));
  }
}

let instance: Net | null = null;
export function useNet(): Net {
  if (!instance) instance = new Net();
  return instance;
}

