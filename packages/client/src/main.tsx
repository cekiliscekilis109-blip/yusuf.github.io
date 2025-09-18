import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameView } from './ui/GameView';

const root = createRoot(document.getElementById('root')!);
root.render(<GameView />);

