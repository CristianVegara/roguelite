import { CLASS_SKINS } from '../data/ClassSkins';
import classSpriteUrl from '../assets/sprites/class_sprite.png?url';
import bossSheetUrl from '../assets/sprites/boss_sheet.png?url';
/**
 * Boss cell auto-loader (unchanged)
 */
const bossSheetCellModules = import.meta.glob('../assets/sprites/boss_sheet_cells/boss_sheet_*.png', { query: '?url', import: 'default', eager: true });
export const BOSS_SHEET_CELL_TEXTURE_KEYS = Object.keys(bossSheetCellModules)
    .map((filePath) => filePath.split('/').pop().replace('.png', ''))
    .sort();
/**
 * Monster cell auto-loader.
 */
const monsterCellModules = import.meta.glob('../assets/sprites/monster_sheet_1_cells/*.png', { query: '?url', import: 'default', eager: true });
export const MONSTER_CELL_TEXTURE_KEYS = Object.keys(monsterCellModules)
    .map((filePath) => filePath.split('/').pop().replace('.png', ''))
    .sort();
/**
 * Random boss cell picker
 */
export function getRandomBossSheetCellKey() {
    const keys = BOSS_SHEET_CELL_TEXTURE_KEYS;
    const index = Math.floor(Math.random() * keys.length);
    return keys[index];
}
/**
 * Random monster cell picker.
 */
export function getRandomMonsterCellKey() {
    const keys = MONSTER_CELL_TEXTURE_KEYS;
    if (keys.length === 0) {
        console.warn('[SpriteLoader] No monster cell textures found. Falling back to enemy placeholder.');
        return 'enemy';
    }
    const index = Math.floor(Math.random() * keys.length);
    return keys[index];
}
/**
 * CLASS SPRITE
 */
export const CLASS_SPRITE_URL = classSpriteUrl;
export const CLASS_SPRITE_FRAME_WIDTH = 352;
export const CLASS_SPRITE_FRAME_HEIGHT = 384;
export const CLASS_SPRITE_COLS = 4;
export const CLASS_SPRITE_ROWS = 2;
export const CLASS_SPRITE_TRACE = {
    necromancer: 0,
    assassin: 1,
    paladin: 2,
    berserker: 3,
    archmage: 4,
    pyromancer: 5,
    plague_doctor: 6,
    Bounty_Hunter: 7,
};
/**
 * BOSSES ONLY
 */
export const SPRITE_SHEETS = {
    boss_sheet: {
        key: 'boss_sheet',
        url: bossSheetUrl,
        frameWidth: 352,
        frameHeight: 192,
        cols: 4,
        rows: 4,
    },
};
export const classSpriteAvailable = { value: false };
/**
 * Preload all sprites
 */
export function preloadSpriteSheets(scene) {
    // Class sprite
    scene.load.spritesheet('class_sprite', CLASS_SPRITE_URL, {
        frameWidth: CLASS_SPRITE_FRAME_WIDTH,
        frameHeight: CLASS_SPRITE_FRAME_HEIGHT,
    });
    // Boss sheet
    scene.load.spritesheet(SPRITE_SHEETS.boss_sheet.key, SPRITE_SHEETS.boss_sheet.url, {
        frameWidth: SPRITE_SHEETS.boss_sheet.frameWidth,
        frameHeight: SPRITE_SHEETS.boss_sheet.frameHeight,
    });
    // Boss cell images
    for (const [filePath, moduleUrl] of Object.entries(bossSheetCellModules)) {
        const textureKey = filePath.split('/').pop().replace('.png', '');
        const url = typeof moduleUrl === 'string' ? moduleUrl : moduleUrl.default ?? String(moduleUrl);
        scene.load.image(textureKey, url);
    }
    // Monster cell images
    for (const [filePath, moduleUrl] of Object.entries(monsterCellModules)) {
        const textureKey = filePath.split('/').pop().replace('.png', '');
        const url = typeof moduleUrl === 'string' ? moduleUrl : moduleUrl.default ?? String(moduleUrl);
        scene.load.image(textureKey, url);
    }
    // Class skin images
    for (const skin of CLASS_SKINS) {
        scene.load.image(skin.textureKey, skin.url);
    }
    scene.load.on('loaderror', (file) => {
        console.warn('[SpriteLoader] Failed to load asset:', file.key, file.src);
    });
}
/**
 * Probe class sprite availability
 */
export function probeClassSpriteSheet() {
    const image = new Image();
    image.src = CLASS_SPRITE_URL;
    image.onload = () => { classSpriteAvailable.value = true; };
    image.onerror = () => {
        classSpriteAvailable.value = false;
        console.warn('[SpriteLoader] Failed to load class sprite sheet:', CLASS_SPRITE_URL);
    };
}
/**
 * CSS sprite helper
 */
export function getClassSpriteBackgroundStyle(classId) {
    const index = CLASS_SPRITE_TRACE[classId] ?? 0;
    const col = index % CLASS_SPRITE_COLS;
    const row = Math.floor(index / CLASS_SPRITE_COLS);
    return {
        backgroundImage: `url('${CLASS_SPRITE_URL}')`,
        backgroundSize: `${CLASS_SPRITE_FRAME_WIDTH * CLASS_SPRITE_COLS}px ` +
            `${CLASS_SPRITE_FRAME_HEIGHT * CLASS_SPRITE_ROWS}px`,
        backgroundPosition: `${-col * CLASS_SPRITE_FRAME_WIDTH}px ${-row * CLASS_SPRITE_FRAME_HEIGHT}px`,
    };
}
/**
 * Class frame helper
 */
export function getClassSpriteFrame(classId) {
    return CLASS_SPRITE_TRACE[classId] ?? null;
}
/**
 * Boss frame helper
 */
export function getBossSheetFrameForFloor(floor) {
    return (floor - 1) % (SPRITE_SHEETS.boss_sheet.cols * SPRITE_SHEETS.boss_sheet.rows);
}
/**
 * Public API
 */
export const SpriteLoader = {
    preload: preloadSpriteSheets,
    probeClassSpriteSheet,
    getClassSpriteBackgroundStyle,
    getClassSpriteFrame,
    getBossSheetFrameForFloor,
    getRandomBossSheetCellKey,
    getRandomMonsterCellKey,
};
