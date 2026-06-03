/**
 * ServiceLocator — central registry for all platform services.
 *
 * Initialised once in BootScene before any scene routing.
 * All game code accesses services through this singleton so that
 * swapping a LocalXService for a RemoteXService later only
 * requires changing the init() method — nothing else.
 */

import { IProfileService, IRunHistoryService } from './types';
import { LocalProfileService }    from './local/LocalProfileService';
import { LocalRunHistoryService } from './local/LocalRunHistoryService';

export class ServiceLocator {
  private static _profile: IProfileService | null = null;
  private static _history: IRunHistoryService | null = null;

  /** Call once — in BootScene.create() — before routing to any other scene. */
  static init(): void {
    this._profile = new LocalProfileService();
    this._history = new LocalRunHistoryService();
  }

  static get profile(): IProfileService {
    if (!this._profile) {
      // Defensive: auto-init so scenes can't crash if called out of order
      this.init();
    }
    return this._profile!;
  }

  static get history(): IRunHistoryService {
    if (!this._history) this.init();
    return this._history!;
  }

  /** Expose the concrete local profile class for static helpers (e.g. name validation). */
  static get localProfile(): typeof LocalProfileService {
    return LocalProfileService;
  }
}
