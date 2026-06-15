/**
 * HudModifierStrip — HTML version of the Phaser modifier strip.
 *
 * Shows the current floor modifier name and description.
 * Subscribes to: modifierName, modifierDesc.
 */
import { runState } from '../bridge/RunStateStore';
export class HudModifierStrip {
    constructor(frame) {
        this.subs = [];
        this.el = this.build();
        this.accent = this.el.querySelector('.hud-mod-accent');
        this.name = this.el.querySelector('.hud-mod-name');
        this.desc = this.el.querySelector('.hud-mod-desc');
        frame.appendChild(this.el);
        this.subscribe();
    }
    destroy() {
        this.subs.forEach(off => off());
        this.el.remove();
    }
    build() {
        const el = document.createElement('div');
        el.className = 'hud-mod-strip is-hidden';
        const accent = document.createElement('div');
        accent.className = 'hud-mod-accent';
        const name = document.createElement('span');
        name.className = 'hud-mod-name';
        const desc = document.createElement('span');
        desc.className = 'hud-mod-desc';
        el.append(accent, name, desc);
        return el;
    }
    subscribe() {
        this.subs.push(runState.subscribe(s => `${s.modifierName}|${s.modifierDesc}`, () => this.refresh()));
    }
    refresh() {
        const s = runState.get();
        if (!s.modifierName) {
            this.el.classList.add('is-hidden');
            return;
        }
        this.el.classList.remove('is-hidden');
        const colour = '#ffd700';
        // Pill background: subtle tint of the modifier colour
        this.el.style.background = hexWithAlpha(colour, 0.10);
        this.el.style.borderColor = hexWithAlpha(colour, 0.30);
        // Accent dot (replaces old full-height stripe)
        this.accent.style.background = colour;
        this.name.textContent = s.modifierName;
        this.name.style.color = colour;
        this.desc.textContent = s.modifierDesc;
    }
}
function hexWithAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
