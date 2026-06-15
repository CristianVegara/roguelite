/**
 * UpgradeKeyboardHandler — keyboard shortcuts for upgrade and relic modals.
 *
 * Wires up number keys (1 / 2 / 3) and skip keys (S / Escape) so players
 * on desktop can select upgrade or relic cards without moving their hands
 * to the mouse. Works independently of the modal HTML — it listens on the
 * game event bus and emits the same events the modal's click handlers emit.
 *
 * Initialization
 * ──────────────
 * Call UpgradeKeyboardHandler.init() once at app startup, before any game
 * scene runs. A single instance covers the entire session.
 *
 *   import { UpgradeKeyboardHandler } from './bridge/UpgradeKeyboardHandler';
 *   UpgradeKeyboardHandler.init();
 *
 * Keys (upgrade modal)
 * ────────────────────
 *   1 / 2 / 3   — select that upgrade card
 *   S / Escape  — skip (equivalent to clicking SKIP)
 *
 * Keys (relic modal)
 * ──────────────────
 *   1 / 2 / 3   — select that relic card
 *   S / Escape  — skip the relic
 *
 * Keys (merchant modal)
 * ─────────────────────
 *   Escape      — close merchant (equivalent to clicking LEAVE)
 *
 * Safety
 * ──────
 * The handler is active only while its corresponding modal is open (between
 * the 'available' event and the 'selected' / 'skipped' / 'closed' event).
 * It registers and removes the keydown listener precisely so shortcuts can't
 * fire when no modal is visible.
 *
 * Input text fields inside modals: if the active element is an <input> or
 * <textarea> the handler defers — number keys shouldn't eat typed characters.
 */
import { bus } from './GameEventBus';
// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export class UpgradeKeyboardHandler {
    static init() {
        if (UpgradeKeyboardHandler.initialised)
            return;
        UpgradeKeyboardHandler.initialised = true;
        const handler = new UpgradeKeyboardHandler();
        handler.register();
    }
    register() {
        this.registerUpgradeShortcuts();
        this.registerRelicShortcuts();
        this.registerMerchantShortcuts();
    }
    // ── Upgrade modal ──────────────────────────────────────────────────────────
    registerUpgradeShortcuts() {
        bus.on('upgrade:available', (e) => {
            const upgrades = e.payload.upgrades;
            if (!upgrades?.length)
                return;
            let active = true;
            const cleanup = () => {
                active = false;
                document.removeEventListener('keydown', onKey, { capture: true });
            };
            // Auto-clean when the modal resolves (whichever fires first)
            const offSelected = bus.on('upgrade:selected', () => {
                cleanup();
                offSelected();
                offSkipped();
            });
            const offSkipped = bus.on('upgrade:skipped', () => {
                cleanup();
                offSelected();
                offSkipped();
            });
            const onKey = (e) => {
                if (!active)
                    return;
                if (isTypingContext())
                    return;
                const key = e.key;
                if (key === '1' && upgrades[0]) {
                    e.preventDefault();
                    cleanup();
                    offSelected();
                    offSkipped();
                    bus.emit({ type: 'upgrade:selected', payload: { upgradeId: upgrades[0].id } });
                    return;
                }
                if (key === '2' && upgrades[1]) {
                    e.preventDefault();
                    cleanup();
                    offSelected();
                    offSkipped();
                    bus.emit({ type: 'upgrade:selected', payload: { upgradeId: upgrades[1].id } });
                    return;
                }
                if (key === '3' && upgrades[2]) {
                    e.preventDefault();
                    cleanup();
                    offSelected();
                    offSkipped();
                    bus.emit({ type: 'upgrade:selected', payload: { upgradeId: upgrades[2].id } });
                    return;
                }
                if (key === 's' || key === 'S' || key === 'Escape') {
                    e.preventDefault();
                    cleanup();
                    offSelected();
                    offSkipped();
                    bus.emit({ type: 'upgrade:skipped', payload: {} });
                }
            };
            // Use capture so the shortcut fires before the modal processes events
            document.addEventListener('keydown', onKey, { capture: true });
        });
    }
    // ── Relic modal ────────────────────────────────────────────────────────────
    registerRelicShortcuts() {
        bus.on('relic:available', (e) => {
            const relics = e.payload.relics;
            if (!relics?.length)
                return;
            let active = true;
            const cleanup = () => {
                active = false;
                document.removeEventListener('keydown', onKey, { capture: true });
            };
            const offSelected = bus.on('relic:selected', () => {
                cleanup();
                offSelected();
                offSkipped();
            });
            const offSkipped = bus.on('relic:skipped', () => {
                cleanup();
                offSelected();
                offSkipped();
            });
            const onKey = (e) => {
                if (!active)
                    return;
                if (isTypingContext())
                    return;
                const key = e.key;
                if (key === '1' && relics[0]) {
                    e.preventDefault();
                    cleanup();
                    offSelected();
                    offSkipped();
                    bus.emit({ type: 'relic:selected', payload: { relicId: relics[0].id } });
                    return;
                }
                if (key === '2' && relics[1]) {
                    e.preventDefault();
                    cleanup();
                    offSelected();
                    offSkipped();
                    bus.emit({ type: 'relic:selected', payload: { relicId: relics[1].id } });
                    return;
                }
                if (key === '3' && relics[2]) {
                    e.preventDefault();
                    cleanup();
                    offSelected();
                    offSkipped();
                    bus.emit({ type: 'relic:selected', payload: { relicId: relics[2].id } });
                    return;
                }
                if (key === 's' || key === 'S' || key === 'Escape') {
                    e.preventDefault();
                    cleanup();
                    offSelected();
                    offSkipped();
                    bus.emit({ type: 'relic:skipped', payload: {} });
                }
            };
            document.addEventListener('keydown', onKey, { capture: true });
        });
    }
    // ── Merchant modal ─────────────────────────────────────────────────────────
    registerMerchantShortcuts() {
        bus.on('merchant:available', () => {
            let active = true;
            const cleanup = () => {
                active = false;
                document.removeEventListener('keydown', onKey, { capture: true });
            };
            const offClosed = bus.on('merchant:closed', () => {
                cleanup();
                offClosed();
            });
            const onKey = (e) => {
                if (!active)
                    return;
                if (isTypingContext())
                    return;
                // Escape closes the merchant (equivalent to clicking LEAVE)
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cleanup();
                    offClosed();
                    bus.emit({ type: 'merchant:closed', payload: {} });
                }
            };
            document.addEventListener('keydown', onKey, { capture: true });
        });
    }
}
UpgradeKeyboardHandler.initialised = false;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Returns true when the user is actively typing in a form field.
 * Prevents number keys from being intercepted while the player is
 * entering text in an input (e.g. name-entry screen loaded over a pause).
 */
function isTypingContext() {
    const tag = (document.activeElement?.tagName ?? '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
}
