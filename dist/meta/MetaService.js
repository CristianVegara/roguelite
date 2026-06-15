import { CLASS_SKINS_BY_ID, getClassSkinById } from '../data/ClassSkins';
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
const SAVE_VERSION = 3; // bumped: added class skin unlocks/equipment
// ---------------------------------------------------------------------------
// MetaService
// ---------------------------------------------------------------------------
export class MetaService {
    constructor() {
        this._currency = 0;
        this._highestFloor = 0;
        this._upgrades = { damage: 0, hp: 0, attackSpeed: 0 };
        this._lastRun = null;
        this._unlockedSkinIds = new Set();
        this._equippedSkinByClass = {};
        this.load();
    }
    // ---------------------------------------------------------------------------
    // Accessors
    // ---------------------------------------------------------------------------
    get currency() { return this._currency; }
    get highestFloor() { return this._highestFloor; }
    get upgrades() { return { ...this._upgrades }; }
    get lastRun() { return this._lastRun; }
    get unlockedSkinIds() { return [...this._unlockedSkinIds]; }
    get equippedSkinByClass() { return { ...this._equippedSkinByClass }; }
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
    // Class skin shop
    // ---------------------------------------------------------------------------
    isSkinUnlocked(skinId) {
        return this._unlockedSkinIds.has(skinId);
    }
    canPurchaseSkin(skinId) {
        const skin = getClassSkinById(skinId);
        return Boolean(skin) && !this.isSkinUnlocked(skinId) && this._currency >= skin.cost;
    }
    purchaseSkin(skinId) {
        const skin = getClassSkinById(skinId);
        if (!skin || this.isSkinUnlocked(skinId) || this._currency < skin.cost)
            return false;
        this._currency -= skin.cost;
        this._unlockedSkinIds.add(skinId);
        this._equippedSkinByClass[skin.classId] = skinId;
        this.save();
        return true;
    }
    equipSkin(classId, skinId) {
        if (skinId === null) {
            delete this._equippedSkinByClass[classId];
            this.save();
            return true;
        }
        const skin = getClassSkinById(skinId);
        if (!skin || skin.classId !== classId || !this.isSkinUnlocked(skinId))
            return false;
        this._equippedSkinByClass[classId] = skinId;
        this.save();
        return true;
    }
    getEquippedSkinId(classId) {
        const skinId = this._equippedSkinByClass[classId] ?? null;
        const skin = getClassSkinById(skinId);
        if (!skin || skin.classId !== classId || !this.isSkinUnlocked(skin.id))
            return null;
        return skin.id;
    }
    getEquippedSkinTextureKey(classId) {
        const skin = getClassSkinById(this.getEquippedSkinId(classId));
        return skin?.textureKey ?? null;
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
            unlockedSkinIds: [...this._unlockedSkinIds],
            equippedSkinByClass: { ...this._equippedSkinByClass },
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
            if (data.version !== 2 && data.version !== SAVE_VERSION) {
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
            this._unlockedSkinIds = new Set((data.unlockedSkinIds ?? []).filter((skinId) => CLASS_SKINS_BY_ID.has(skinId)));
            this._equippedSkinByClass = sanitizeEquippedSkins(data.equippedSkinByClass, this._unlockedSkinIds);
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
        this._unlockedSkinIds = new Set();
        this._equippedSkinByClass = {};
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
function sanitizeEquippedSkins(equippedSkinByClass, unlockedSkinIds) {
    const sanitized = {};
    Object.entries(equippedSkinByClass ?? {}).forEach(([classId, skinId]) => {
        const skin = getClassSkinById(skinId);
        if (skin && skin.classId === classId && unlockedSkinIds.has(skinId)) {
            sanitized[classId] = skinId;
        }
    });
    return sanitized;
}
export const metaService = new MetaService();
