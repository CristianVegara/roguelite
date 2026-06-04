import Phaser from 'phaser';
import { gameConfig }      from './config/GameConfig';
import { router }          from './router/Router';
import { CombatHUD }       from './hud/CombatHUD';
import { UpgradeModal }    from './modals/UpgradeModal';
import { RelicModal }      from './modals/RelicModal';
import { MerchantModal }   from './modals/MerchantModal';
import { GameOverModal }   from './modals/GameOverModal';
import { PauseModal }     from './modals/PauseModal';
import { createHomeScreen }        from './screens/HomeScreen';
import { createClassSelectScreen } from './screens/ClassSelectScreen';
import { createStatsScreen }       from './screens/StatsScreen';
import { createLeaderboardScreen } from './screens/LeaderboardScreen';
import { createNameEntryScreen }   from './screens/NameEntryScreen';
import { setPhaserGame }           from './bridge/startRun';

// ── Background image layer ───────────────────────────────────────────────────
// Set via JS so the path is resolved relative to Vite's configured base,
// which is correct for both local dev and subpath-hosted deployments.
const canvasBg = document.getElementById('canvas-bg');
if (canvasBg) {
  canvasBg.style.backgroundImage =
    `url('${import.meta.env.BASE_URL}images/background/background.png')`;
}

// ── HTML layer: initialise router ────────────────────────────────────────────
router.init();

// Register HTML screens with the router (M6+)
router.register('home',         ()       => createHomeScreen());
router.register('class-select', (params) => createClassSelectScreen(params));
router.register('stats',        ()       => createStatsScreen());
router.register('leaderboard',  ()       => createLeaderboardScreen());
router.register('name-entry',   ()       => createNameEntryScreen());

// ── HTML HUD — self-managing, subscribes to RunStateStore ────────────────────
new CombatHUD();

// ── HTML Modals — self-managing, listen to GameEventBus ──────────────────────
new UpgradeModal();
new RelicModal();
new MerchantModal();
new GameOverModal();
new PauseModal();

// ── Phaser layer: create the game instance ───────────────────────────────────
const phaserGame = new Phaser.Game(gameConfig);

// Give startRun.ts the Phaser.Game reference so it can launch GameScene
setPhaserGame(phaserGame);
