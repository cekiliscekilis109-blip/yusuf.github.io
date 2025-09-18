export type EntityId = string;

export interface Party {
  id: EntityId;
  name: string;
  position: { x: number; y: number };
  speed: number;
  factionId: string;
  troopCount: number;
}

export interface BattleReport {
  battleId: string;
  attackers: EntityId[];
  defenders: EntityId[];
  winnerFactionId: string;
}

export interface WorldTile {
  x: number;
  y: number;
  terrain: "plains" | "forest" | "mountain" | "water";
  movementCost: number;
}

export interface WorldMapConfig {
  width: number;
  height: number;
  seed: number;
}
