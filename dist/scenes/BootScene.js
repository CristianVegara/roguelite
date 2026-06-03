import Phaser from 'phaser';
import { ServiceLocator } from '../services/ServiceLocator';
/**
 * BootScene
 *
 * Responsibilities (Phase 1):
 *   - Preload all game assets.
 *   - Transition to GameScene when loading is done.
 *
 * In Phase 1 there are no real assets yet, so we just generate
 * placeholder textures programmatically and move on immediately.
 * Later phases will add real asset loading here without touching
 * any other scene.
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }
    preload() {
        // Phase 1: no external assets.
        // Subsequent phases will call this.load.image / this.load.audio here.
    }
    create() {
        // 1. Boot all platform services before any scene routing
        ServiceLocator.init();
        // 2. Generate placeholder textures
        this.generatePlaceholderTextures();
        // 3. Route: first-time player → NameEntryScene; returning player → HomeScene
        const profile = ServiceLocator.profile.getProfile();
        this.scene.start(profile ? 'HomeScene' : 'NameEntryScene');
    }
    generatePlaceholderTextures() {
        // Player: blue rectangle 24×32
        const player = this.make.graphics({ x: 0, y: 0 });
        player.fillStyle(0x4fc3f7);
        player.fillRect(0, 0, 24, 32);
        player.generateTexture('player', 24, 32);
        player.destroy();
        // Enemy: red rectangle 24×24
        const enemy = this.make.graphics({ x: 0, y: 0 });
        enemy.fillStyle(0xef5350);
        enemy.fillRect(0, 0, 24, 24);
        enemy.generateTexture('enemy', 24, 24);
        enemy.destroy();
        // Boss: purple rectangle 40×52 (visibly larger than a regular enemy)
        const boss = this.make.graphics({ x: 0, y: 0 });
        boss.fillStyle(0x9b59b6);
        boss.fillRect(0, 0, 40, 52);
        boss.generateTexture('boss', 40, 52);
        boss.destroy();
    }
}
