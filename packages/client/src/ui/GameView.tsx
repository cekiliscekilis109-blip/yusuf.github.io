import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { useGameStore } from '../utils/store';
import { MainScene } from '../world/MainScene';

export function GameView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const setGame = useGameStore((s) => s.setGame);

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 960,
      height: 540,
      parent: containerRef.current!,
      backgroundColor: '#20232a',
      physics: { default: 'arcade' },
      scene: [MainScene],
    };
    const game = new Phaser.Game(config);
    setGame(game);
    return () => {
      game.destroy(true);
    };
  }, [setGame]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={containerRef} />
    </div>
  );
}

