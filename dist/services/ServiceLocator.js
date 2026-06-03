/**
 * ServiceLocator — central registry for all platform services.
 *
 * Initialised once in BootScene before any scene routing.
 * All game code accesses services through this singleton so that
 * swapping a LocalXService for a RemoteXService later only
 * requires changing the init() method — nothing else.
 */
import { LocalProfileService } from './local/LocalProfileService';
import { LocalRunHistoryService } from './local/LocalRunHistoryService';
export class ServiceLocator {
    /** Call once — in BootScene.create() — before routing to any other scene. */
    static init() {
        this._profile = new LocalProfileService();
        this._history = new LocalRunHistoryService();
    }
    static get profile() {
        if (!this._profile) {
            // Defensive: auto-init so scenes can't crash if called out of order
            this.init();
        }
        return this._profile;
    }
    static get history() {
        if (!this._history)
            this.init();
        return this._history;
    }
    /** Expose the concrete local profile class for static helpers (e.g. name validation). */
    static get localProfile() {
        return LocalProfileService;
    }
}
ServiceLocator._profile = null;
ServiceLocator._history = null;
