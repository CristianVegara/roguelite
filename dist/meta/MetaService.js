// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const META_MAX_LEVEL = 5;
export const UPGRADE_BONUS = {
    damage: 3,
    hp: 25,
    attackSpeed: 0.1,
};
export const UPGRADE_INFO = [
    { key: 'damage', label: 'Damage +', bonusDesc: '+3 damage per level', color: 0xe74c3c },
    { key: 'hp', label: 'Max HP +', bonusDesc: '+25 max HP per level', color: 0x2ecc71 },
    { key: 'attackSpeed', label: 'Attack Speed +', bonusDesc: '+0.1 speed per level', color: 0xf1c40f },
];
const COST_BASE = { damage: 30, hp: 25, attackSpeed: 40 };
const COST_STEP = { damage: 30, hp: 25, attackSpeed: 35 };
const SAVE_KEY = 'tower_roguelite_save';
const SAVE_VERSION = 2; // bumped: added lastRun field
// ---------------------------------------------------------------------------
// MetaService
// ---------------------------------------------------------------------------
export class MetaService {
    constructor() {
        this._currency = 0;
        this._highestFloor = 0;
        this._upgrades = { damage: 0, hp: 0, attackSpeed: 0 };
        this._lastRun = null;
        this.load();
    }
    // ---------------------------------------------------------------------------
    // Accessors
    // ---------------------------------------------------------------------------
    get currency() { return this._currency; }
    get highestFloor() { return this._highestFloor; }
    get upgrades() { return { ...this._upgrades }; }
    get lastRun() { return this._lastRun; }
    // ---------------------------------------------------------------------------
    // Upgrade shop
    // ---------------------------------------------------------------------------
    costForUpgrade(key) {
        return COST_BASE[key] + COST_STEP[key] * this._upgrades[key];
    }
    canAfford(key) {
        return this._upgrades[key] < META_MAX_LEVEL &&
            this._currency >= this.costForUpgrade(key);
    }
    isMaxLevel(key) {
        return this._upgrades[key] >= META_MAX_LEVEL;
    }
    purchase(key) {
        if (!this.canAfford(key))
            return false;
        this._currency -= this.costForUpgrade(key);
        this._upgrades[key]++;
        this.save();
        return true;
    }
    // ---------------------------------------------------------------------------
    // Run lifecycle
    // ---------------------------------------------------------------------------
    /**
     * Called when the player dies.
     * Accepts the full run stats so HomeScene can display them.
     */
    recordRunEnd(stats) {
        this._currency += stats.goldEarned;
        if (stats.floor > this._highestFloor)
            this._highestFloor = stats.floor;
        this._lastRun = { ...stats };
        this.save();
    }
    /** Currency earned for reaching a given floor. */
    static earnedForFloor(floor) {
        return floor * 5;
    }
    // ---------------------------------------------------------------------------
    // Apply to run
    // ---------------------------------------------------------------------------
    applyBonus(stats) {
        const u = this._upgrades;
        stats.damage += UPGRADE_BONUS.damage * u.damage;
        stats.maxHp += UPGRADE_BONUS.hp * u.hp;
        stats.hp += UPGRADE_BONUS.hp * u.hp;
        stats.attackSpeed = parseFloat((stats.attackSpeed + UPGRADE_BONUS.attackSpeed * u.attackSpeed).toFixed(3));
    }
    // ---------------------------------------------------------------------------
    // Persistence
    // ---------------------------------------------------------------------------
    save() {
        const data = {
            version: SAVE_VERSION,
            currency: this._currency,
            highestFloor: this._highestFloor,
            upgrades: { ...this._upgrades },
            lastRun: this._lastRun,
        };
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        }
        catch (e) {
            console.warn('[MetaService] save failed:', e);
        }
    }
    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw)
                return;
            const data = JSON.parse(raw);
            if (data.version !== SAVE_VERSION) {
                console.warn('[MetaService] save version mismatch — starting fresh.');
                return;
            }
            this._currency = Math.max(0, data.currency ?? 0);
            this._highestFloor = Math.max(0, data.highestFloor ?? 0);
            this._upgrades = {
                damage: clampLevel(data.upgrades?.damage),
                hp: clampLevel(data.upgrades?.hp),
                attackSpeed: clampLevel(data.upgrades?.attackSpeed),
            };
            this._lastRun = data.lastRun ?? null;
        }
        catch (e) {
            console.warn('[MetaService] load failed — starting fresh:', e);
        }
    }
    resetSave() {
        this._currency = 0;
        this._highestFloor = 0;
        this._upgrades = { damage: 0, hp: 0, attackSpeed: 0 };
        this._lastRun = null;
        try {
            localStorage.removeItem(SAVE_KEY);
        }
        catch { /* ignore */ }
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clampLevel(v) {
    return Math.min(META_MAX_LEVEL, Math.max(0, Math.floor(v ?? 0)));
}
export const metaService = new MetaService();
