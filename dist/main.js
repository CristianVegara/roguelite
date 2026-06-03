import Phaser from 'phaser';
import { gameConfig } from './config/GameConfig';
import { router } from './router/Router';
// ── HTML layer: initialise router, navigate to home screen ───────────────────
router.init();
router.navigate('home');
// ── Phaser layer: create the game instance ───────────────────────────────────
// Phaser mounts its canvas into #canvas-mount (set in GameConfig).
// The canvas is hidden by default; the Router shows it when navigating to 'combat'.
//
// NOTE (M2): The Phaser game still starts immediately so existing scenes
// continue to work during migration. Once all scenes are migrated to HTML
// (M6–M11), Phaser will be initialised lazily from bridge/startRun.ts instead.
new Phaser.Game(gameConfig);
