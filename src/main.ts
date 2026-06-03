import Phaser from 'phaser';
import { gameConfig }      from './config/GameConfig';
import { router }          from './router/Router';
import { CombatHUD }       from './hud/CombatHUD';
import { UpgradeModal }    from './modals/UpgradeModal';
import { RelicModal }      from './modals/RelicModal';
import { MerchantModal }   from './modals/MerchantModal';
import { createHomeScreen }        from './screens/HomeScreen';
import { createClassSelectScreen } from './screens/ClassSelectScreen';
import { setPhaserGame }           from './bridge/startRun';

// ── HTML layer: initialise router ────────────────────────────────────────────
router.init();

// Register HTML screens with the router (M6+)
router.register('home',         ()       => createHomeScreen());
router.register('class-select', (params) => createClassSelectScreen(params));

// ── HTML HUD — self-managing, subscribes to RunStateStore ────────────────────
new CombatHUD();

// ── HTML Modals — self-managing, listen to GameEventBus ──────────────────────
new UpgradeModal();
new RelicModal();
new MerchantModal();

// ── Phaser layer: create the game instance ───────────────────────────────────
const phaserGame = new Phaser.Game(gameConfig);

// Give startRun.ts the Phaser.Game reference so it can launch GameScene
setPhaserGame(phaserGame);
