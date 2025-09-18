import Phaser from 'phaser';
import { useNet } from '../utils/net';

export class MainScene extends Phaser.Scene {
  private playerPartyId: string | null = null;
  private parties: Map<string, Phaser.GameObjects.Arc> = new Map();

  constructor() {
    super('MainScene');
  }

  create() {
    const net = useNet();
    net.connect();

    net.on('welcome', () => {
      net.send({ type: 'join_world', playerName: 'Player' + Math.floor(Math.random() * 1000) });
    });

    net.on('world_state', (msg: any) => {
      for (const p of msg.parties) {
        this.ensureParty(p.id, p.x, p.y);
        if (!this.playerPartyId && p.name.includes("Player")) this.playerPartyId = p.id;
      }
    });

    net.on('party_moved', (msg: any) => {
      const circle = this.parties.get(msg.partyId);
      if (circle) {
        circle.x = msg.position.x * 10;
        circle.y = msg.position.y * 10;
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.playerPartyId) return;
      const target = { x: pointer.x / 10, y: pointer.y / 10 };
      net.send({ type: 'move_party', partyId: this.playerPartyId, target });
    });
  }

  private ensureParty(id: string, x: number, y: number) {
    if (this.parties.has(id)) return;
    const circle = this.add.circle(x * 10, y * 10, 6, 0x00d8ff);
    this.parties.set(id, circle);
  }
}

