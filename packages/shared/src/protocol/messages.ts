export type ClientToServerMessage =
  | { type: "hello"; clientVersion: string }
  | { type: "join_world"; playerName: string }
  | { type: "move_party"; partyId: string; target: { x: number; y: number } }
  | { type: "enter_battle"; targetPartyId: string }
  | { type: "action_ack"; actionId: string };

export type ServerToClientMessage =
  | { type: "welcome"; serverVersion: string; time: number }
  | { type: "world_state"; time: number; parties: any[] }
  | { type: "party_moved"; partyId: string; position: { x: number; y: number } }
  | { type: "battle_started"; battleId: string }
  | { type: "battle_ended"; battleId: string; winnerFactionId: string }
  | { type: "error"; message: string };
