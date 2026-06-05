import Phaser from 'phaser';
import { BootScene }  from '../scenes/BootScene';
import { GameScene }  from '../scenes/GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './GameConstants';

// Re-export so existing scene imports from '../config/GameConfig' keep working.
export { GAME_WIDTH, GAME_HEIGHT } from './GameConstants';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width:  GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#080812',
  scene: [BootScene, GameScene],
  parent: 'canvas-mount',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode:       Phaser.Scale.FIT,
    // CSS flexbox on #canvas-mount handles centering exclusively.
    // CENTER_BOTH injects inline margins that conflict with flex layout,
    // causing the canvas to shift right on mount.
    autoCenter: Phaser.Scale.NO_CENTER,
    zoom:       Math.max(window.devicePixelRatio, 1),
  },
  render: {
    antialias: true,
    antialiasGL: true,
  },
};
