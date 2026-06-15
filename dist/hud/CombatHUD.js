/**
 * CombatHUD — HTML HUD overlaid on the Phaser combat canvas.
 *
 * Mobile fix: listens for modal:open / modal:close on the bus and sets
 * pointer-events: none on the HUD frame while any modal is visible.
 * Without this the scaled 480×640 frame sits on top of #modal-root and
 * silently intercepts every tap before it reaches modal buttons.
 */
import { runState } from '../bridge/RunStateStore';
import { bus } from '../bridge/GameEventBus'; // ← added
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';
import { HudLeft } from './HudLeft';
import { HudRight } from './HudRight';
import { HudModifierStrip } from './HudModifierStrip';
export class CombatHUD {
    constructor() {
        this.subs = [];
        this.canvasObserver = null;
        this.root = document.getElementById('hud-root');
        this.frame = this.createFrame();
        this.root.appendChild(this.frame);
        this.left = new HudLeft(this.frame);
        this.right = new HudRight(this.frame);
        this.modifier = new HudModifierStrip(this.frame);
        this.subs.push(runState.subscribe(s => s.isRunActive, (active) => {
            this.root.classList.toggle('is-active', active);
            if (active) {
                requestAnimationFrame(() => {
                    const canvas = document.querySelector('#canvas-mount canvas');
                    if (canvas)
                        this.syncFrameScale(canvas);
                });
            }
        }));
        // ── Modal guard ───────────────────────────────────────────────────────────
        // While any modal is open the HUD frame must not receive pointer events —
        // it covers the full canvas area and would swallow taps meant for modal
        // buttons underneath it in the DOM.
        this.subs.push(bus.on('modal:open', () => { this.frame.style.pointerEvents = 'none'; }), bus.on('modal:close', () => { this.frame.style.pointerEvents = ''; }));
        this.attachCanvasObserver();
    }
    destroy() {
        this.subs.forEach(off => off());
        this.left.destroy();
        this.right.destroy();
        this.modifier.destroy();
        this.canvasObserver?.disconnect();
        this.frame.remove();
    }
    // ── Private ────────────────────────────────────────────────────────────────
    createFrame() {
        const frame = document.createElement('div');
        frame.className = 'hud-frame';
        return frame;
    }
    attachCanvasObserver() {
        const attach = () => {
            const canvas = document.querySelector('#canvas-mount canvas');
            if (!canvas) {
                setTimeout(attach, 100);
                return;
            }
            this.canvasObserver = new ResizeObserver(() => this.syncFrameScale(canvas));
            this.canvasObserver.observe(canvas);
            this.syncFrameScale(canvas);
        };
        attach();
    }
    syncFrameScale(canvas) {
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (!w || !h)
            return;
        const scale = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT);
        this.frame.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
}
