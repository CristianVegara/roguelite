/**
 * startRun.ts — single entry point for starting a run from HTML screens.
 *
 * Called by HomeScreen (mode card click when forceRandomClass) and
 * ClassSelectScreen (after class is chosen).
 *
 * Requires the Phaser.Game reference to be set once from main.ts via
 * setPhaserGame() before any run can start.
 */
import { getModeById } from '../modes/GameModeConfig';
import { ALL_CLASSES } from '../data/ClassDefinition';
import { setRunConfig } from '../RunConfig';
import { router } from '../router/Router';
let _game = null;
/** Call once from main.ts after creating the Phaser.Game instance. */
export function setPhaserGame(game) {
    _game = game;
}
/**
 * Kick off a run:
 *  1. Resolves the class (random if classId is empty).
 *  2. Writes RunConfig.
 *  3. Shows the canvas via router.navigate('combat').
 *  4. Tells Phaser to start GameScene.
 */
export function startRun(config) {
    const mode = getModeById(config.modeId);
    const classId = config.classId
        ? config.classId
        : ALL_CLASSES[Math.floor(Math.random() * ALL_CLASSES.length)].id;
    setRunConfig({
        classId,
        modeId: config.modeId,
        rules: mode.rules,
        startTime: Date.now(),
    });
    // Show canvas, hide any HTML screen
    router.navigate('combat');
    // Start GameScene — restarts cleanly if already running
    _game?.scene.start('GameScene');
}
