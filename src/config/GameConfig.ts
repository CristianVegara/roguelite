import Phaser from 'phaser';
import { BootScene }      from '../scenes/BootScene';
import { HomeScene }      from '../scenes/HomeScene';
import { NameEntryScene } from '../scenes/NameEntryScene';
import { ClassScene }     from '../scenes/ClassScene';
import { GameScene }      from '../scenes/GameScene';
import { UpgradeScene }   from '../scenes/UpgradeScene';
import { RelicScene }     from '../scenes/RelicScene';
import { MerchantScene }  from '../scenes/MerchantScene';
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
  // HomeScene and UpgradeScene are started/launched on demand.
  // MetaScene has been superseded by HomeScene and is no longer registered.
  scene: [BootScene, NameEntryScene, HomeScene, ClassScene, GameScene, UpgradeScene, RelicScene, MerchantScene, StatsScene],
  // Mount the canvas inside the dedicated HTML shell slot.
  // The Router shows/hides #canvas-mount when navigating to/from 'combat'.
  parent: 'canvas-mount',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
};
