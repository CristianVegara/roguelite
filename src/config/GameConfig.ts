import Phaser from 'phaser';
import { BootScene }      from '../scenes/BootScene';
import { NameEntryScene } from '../scenes/NameEntryScene';
import { GameScene }      from '../scenes/GameScene';
import { StatsScene }     from '../scenes/StatsScene';
import { GAME_WIDTH, GAME_HEIGHT } from './GameConstants';

// Re-export so existing scene imports from '../config/GameConfig' keep working.
export { GAME_WIDTH, GAME_HEIGHT } from './GameConstants';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width:  GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#080812',
  // Scene order: first in array is started first (BootScene).
  // HomeScene M6, ClassScene M7, UpgradeScene M8, RelicScene+MerchantScene M9.
  scene: [BootScene, NameEntryScene, GameScene, StatsScene],
  // Mount the canvas inside the dedicated HTML shell slot.
  // The Router shows/hides #canvas-mount when navigating to/from 'combat'.
  parent: 'canvas-mount',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
};
