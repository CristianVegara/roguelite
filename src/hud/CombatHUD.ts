/**
 * CombatHUD — HTML HUD overlaid on the Phaser combat canvas.
 *
 * Architecture:
 * - Reads exclusively from RunStateStore (never from Phaser directly).
 * - Speed button clicks emit to GameEventBus (GameScene listens).
 * - The HUD frame is a 480×640 div centred over the canvas.
 *
 * Lifecycle:
 * - Instantiate once from main.ts; it is self-managing.
 * - Shows automatically when runState.isRunActive becomes true.
 * - Hides automatically when it becomes false.
 *
 * M4 note: the Phaser HUD and this HTML HUD are both visible simultaneously
 * for comparison. Run M5 to delete the Phaser HUD.
 */

import { runState } from '../bridge/RunStateStore';
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

  constructor() {
    this.root  = document.getElementById('hud-root')!;
    this.frame = this.createFrame();
    this.root.appendChild(this.frame);

    // Instantiate sub-sections; each appends into the frame
    this.left     = new HudLeft(this.frame);
    this.right    = new HudRight(this.frame);
    this.modifier = new HudModifierStrip(this.frame);

    // Subscribe to run activity to show/hide the entire HUD root
    this.subs.push(
      runState.subscribe(s => s.isRunActive, (active) => {
        this.root.classList.toggle('is-active', active);
      }),
    );
  }

  /** Tear down all subscriptions. Call if the HUD is ever removed from the DOM. */
  destroy(): void {
    this.subs.forEach(off => off());
    this.left.destroy();
    this.right.destroy();
    this.modifier.destroy();
    this.frame.remove();
  }

  private createFrame(): HTMLElement {
    const frame = document.createElement('div');
    frame.className = 'hud-frame';
    return frame;
  }
}
