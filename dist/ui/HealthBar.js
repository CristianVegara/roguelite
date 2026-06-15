/**
 * HealthBar — two-layer canvas health bar.
 *
 * CHANGE: redraw() now clears both graphics objects and draws nothing.
 *
 * Why: The HTML HUD (HudLeft for player, HudRight for enemy) already
 * renders HP panels with colour-coded fill bars, numeric HP values, and
 * boss/status indicators. The Phaser-canvas health bars above sprites were
 * visually redundant and caused clutter in the arena area.
 *
 * How: redraw() is the single paint method called by both the constructor
 * and update(). Making it a no-op silences all rendering. The HealthBar
 * instances still exist and all their public methods (update, destroy)
 * remain safe to call — Player.ts and Enemy.ts need no changes.
 */
export class HealthBar {
    constructor(scene, centerX, centerY, width = 70, height = 9) {
        this.cx = centerX;
        this.cy = centerY;
        this.w = width;
        this.h = height;
        this.bg = scene.add.graphics();
        this.fill = scene.add.graphics();
        this.redraw(1);
    }
    /** Called whenever HP changes. ratio = current / max, clamped 0–1. */
    update(current, max) {
        this.redraw(max > 0 ? Math.max(0, current / max) : 0);
    }
    destroy() {
        this.bg.destroy();
        this.fill.destroy();
    }
    // ---------------------------------------------------------------------------
    redraw(_ratio) {
        // FIX: cleared and left empty — HP display is handled by the HTML HUD.
        // HudLeft shows the player HP panel; HudRight shows the enemy HP panel.
        // Re-enable the draw calls below if you ever need the canvas bars back.
        this.bg.clear();
        this.fill.clear();
        /*
        // ── Original draw code (kept for reference) ─────────────────────────
        const x = Math.round(this.cx - this.w / 2);
        const y = Math.round(this.cy - this.h / 2);
    
        this.bg.clear();
        this.bg.fillStyle(0x222222);
        this.bg.fillRect(x, y, this.w, this.h);
    
        this.fill.clear();
        if (_ratio > 0) {
          const color =
            _ratio > 0.5 ? 0x2ecc71 : _ratio > 0.25 ? 0xf39c12 : 0xe74c3c;
          this.fill.fillStyle(color);
          this.fill.fillRect(x, y, Math.max(1, Math.floor(this.w * _ratio)), this.h);
        }
        // ─────────────────────────────────────────────────────────────────── */
    }
}
