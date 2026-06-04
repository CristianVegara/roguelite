/**
 * CombatHUD — HTML HUD overlaid on the Phaser combat canvas.
 *
 * Architecture:
 * - Reads exclusively from RunStateStore (never from Phaser directly).
 * - Speed button clicks emit to GameEventBus (GameScene listens).
 * - The HUD frame is a 480×640 div centred over the canvas.
 *
 * Responsive scaling:
 * - Phaser is configured with Scale.FIT + NO_CENTER; CSS flexbox on
 *   #canvas-mount exclusively handles centering, preserving the 480×640 ratio.
 * - A ResizeObserver watches the canvas element and applies the same scale
 *   factor to the HUD frame via CSS transform, keeping the two pixel-perfect
 *   aligned on any screen size.
 *
 * Lifecycle:
 * - Instantiate once from main.ts; it is self-managing.
 * - Shows automatically when runState.isRunActive becomes true.
 * - Hides automatically when it becomes false.
 */

import { runState } from '../bridge/RunStateStore';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';
import { HudLeft }           from './HudLeft';
import { HudRight }          from './HudRight';
import { HudModifierStrip }  from './HudModifierStrip';

export class CombatHUD {
  private root:  HTMLElement;
  private frame: HTMLElement;

  private left:     HudLeft;
  private right:    HudRight;
  private modifier: HudModifierStrip;

  private subs: Array<() => void> = [];
  private canvasObserver: ResizeObserver | null = null;

  constructor() {
    this.root  = document.getElementById('hud-root')!;
    this.frame = this.createFrame();
    this.root.appendChild(this.frame);

    // Instantiate sub-sections; each appends into the frame
    this.left     = new HudLeft(this.frame);
    this.right    = new HudRight(this.frame);
    this.modifier = new HudModifierStrip(this.frame);

    // Subscribe to run activity to show/hide the entire HUD root.
    // After toggling visibility we re-sync the scale via rAF so the frame
    // is correctly sized the moment it first appears (the ResizeObserver
    // won't fire again if the canvas hasn't changed since we last observed).
    this.subs.push(
      runState.subscribe(s => s.isRunActive, (active) => {
        this.root.classList.toggle('is-active', active);
        if (active) {
          requestAnimationFrame(() => {
            const canvas = document.querySelector('#canvas-mount canvas') as HTMLElement | null;
            if (canvas) this.syncFrameScale(canvas);
          });
        }
      }),
    );

    // Keep HUD frame scaled to match the Phaser canvas at all times
    this.attachCanvasObserver();
  }

  /** Tear down all subscriptions. Call if the HUD is ever removed from the DOM. */
  destroy(): void {
    this.subs.forEach(off => off());
    this.left.destroy();
    this.right.destroy();
    this.modifier.destroy();
    this.canvasObserver?.disconnect();
    this.frame.remove();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private createFrame(): HTMLElement {
    const frame = document.createElement('div');
    frame.className = 'hud-frame';
    return frame;
  }

  /**
   * Watch the Phaser canvas element. When Phaser's Scale Manager resizes it
   * (Scale.FIT mode changes its CSS dimensions), scale the HUD frame to match.
   *
   * The canvas may not exist yet when the HUD is constructed (Phaser boots
   * asynchronously), so we poll briefly until it appears.
   */
  private attachCanvasObserver(): void {
    const attach = () => {
      const canvas = document.querySelector('#canvas-mount canvas') as HTMLElement | null;
      if (!canvas) {
        setTimeout(attach, 100);
        return;
      }

      this.canvasObserver = new ResizeObserver(() => this.syncFrameScale(canvas));
      this.canvasObserver.observe(canvas);
      // Fire once immediately in case the canvas is already the right size
      this.syncFrameScale(canvas);
    };
    attach();
  }

  /**
   * Apply a CSS scale to the HUD frame so it perfectly overlays the canvas.
   * The frame is centred at 50%/50% via CSS; we only need to adjust the scale.
   *
   * Uses getBoundingClientRect() rather than clientWidth/clientHeight so the
   * measurement reflects the canvas's actual painted dimensions — correct
   * regardless of whether Phaser scales via CSS width/height or transform.
   */
  private syncFrameScale(canvas: HTMLElement): void {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (!w || !h) return;

    const scale = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT);
    this.frame.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
}
