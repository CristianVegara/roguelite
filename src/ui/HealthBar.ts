import Phaser from 'phaser';

/**
 * HealthBar — disabled canvas health bar.
 *
 * HP rendering is now handled entirely by the HTML HUD.
 * This class remains as a safe no-op so existing code in
 * Player.ts and Enemy.ts does not need to change.
 */
export class HealthBar {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    _centerX: number,
    _centerY: number,
    _width = 70,
    _height = 9,
  ) {
    this.bg = scene.add.graphics();
    this.fill = scene.add.graphics();

    this.redraw(1);
  }

  /** Called whenever HP changes. */
  update(current: number, max: number): void {
    this.redraw(max > 0 ? Math.max(0, current / max) : 0);
  }

  destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
  }

  private redraw(_ratio: number): void {
    // Canvas health bars are intentionally disabled.
    this.bg.clear();
    this.fill.clear();
  }
}