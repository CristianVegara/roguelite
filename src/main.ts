import Phaser from 'phaser';
import { gameConfig } from './config/GameConfig';
import { router }     from './router/Router';
import { CombatHUD }  from './hud/CombatHUD';

// ── HTML layer: initialise router ────────────────────────────────────────────
// router.navigate() is NOT called here yet.
// During migration steps M1–M5 the Phaser scenes own all navigation.
// router.navigate('home') is wired in Step M6 once HomeScreen.ts exists.
router.init();

// ── HTML HUD — self-managing, subscribes to RunStateStore ────────────────────
// Shows automatically when isRunActive becomes true (GameScene.create sets it).
// Hides automatically when isRunActive becomes false (run ends).
new CombatHUD();

// ── Phaser layer: create the game instance ───────────────────────────────────
// Phaser mounts its canvas into #canvas-mount (defined in GameConfig).
// The canvas is visible by default; the Router adds is-hidden only when
// a real HTML screen replaces a Phaser scene (M6+).
new Phaser.Game(gameConfig);
