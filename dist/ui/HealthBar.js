/**
 * A simple two-layer health bar.
 * Pass the bar's centre coordinates; the bar expands left→right.
 * Colour transitions: green (>50%) → yellow (>25%) → red (≤25%).
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
    /** Call this whenever HP changes. ratio = current / max (clamped 0–1). */
    update(current, max) {
        this.redraw(max > 0 ? Math.max(0, current / max) : 0);
    }
    destroy() {
        this.bg.destroy();
        this.fill.destroy();
    }
    // ---------------------------------------------------------------------------
    redraw(ratio) {
        const x = Math.round(this.cx - this.w / 2);
        const y = Math.round(this.cy - this.h / 2);
        this.bg.clear();
        this.bg.fillStyle(0x222222);
        this.bg.fillRect(x, y, this.w, this.h);
        this.fill.clear();
        if (ratio > 0) {
            const color = ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c;
            this.fill.fillStyle(color);
            this.fill.fillRect(x, y, Math.max(1, Math.floor(this.w * ratio)), this.h);
        }
    }
}
