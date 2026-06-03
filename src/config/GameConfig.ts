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
  // Scene order: first in array is started first (BootScene).
  // All hub/modal scenes migrated to HTML in M6–M11. Only combat remains in Phaser.
  scene: [BootScene, GameScene],
  // Mount the canvas inside the dedicated HTML shell slot.
  // The Router shows/hides #canvas-mount when navigating to/from 'combat'.
  parent: 'canvas-mount',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
};
