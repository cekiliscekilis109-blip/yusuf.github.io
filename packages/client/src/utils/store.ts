import { create } from 'zustand';

interface GameState {
  game: Phaser.Game | null;
  setGame: (g: Phaser.Game) => void;
}

export const useGameStore = create<GameState>((set) => ({
  game: null,
  setGame: (g) => set({ game: g })
}));

