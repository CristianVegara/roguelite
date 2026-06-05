import type Phaser from 'phaser';
import classSpriteUrl from '../assets/sprites/class_sprite.png?url';
import bossSheetUrl from '../assets/sprites/boss_sheet.png?url';
import monsterSheet1Url from '../assets/sprites/monster_sheet_1.png?url';
import monsterSheet2Url from '../assets/sprites/monster_sheet_2.png?url';

const bossSheetCellModules = import.meta.glob('../assets/sprites/boss_sheet_cells/boss_sheet_*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
export const BOSS_SHEET_CELL_TEXTURE_KEYS = Object.keys(bossSheetCellModules)
  .map((filePath) => filePath.split('/').pop()!.replace('.png', ''))
  .sort((a, b) => a.localeCompare(b));

export function getRandomBossSheetCellKey(): string {
  const index = Math.floor(Math.random() * BOSS_SHEET_CELL_TEXTURE_KEYS.length);
  return BOSS_SHEET_CELL_TEXTURE_KEYS[index];
}

export type MonsterSheetKey = 'monster_sheet_1' | 'monster_sheet_2';
export type SpriteSheetKey = 'boss_sheet' | MonsterSheetKey;

export interface SpriteSheetInfo {
  readonly key: SpriteSheetKey;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly cols: number;
  readonly rows: number;
}

export const CLASS_SPRITE_URL = classSpriteUrl;
export const CLASS_SPRITE_FRAME_WIDTH = 352;
export const CLASS_SPRITE_FRAME_HEIGHT = 384;
export const CLASS_SPRITE_COLS = 4;
export const CLASS_SPRITE_ROWS = 2;

export const CLASS_SPRITE_TRACE: Record<string, number> = {
  necromancer:   0,
  assassin:      1,
  paladin:       2,
  berserker:     3,
  archmage:      4,
  pyromancer:    5,
  plague_doctor: 6,
  Bounty_Hunter: 7,
};

export const SPRITE_SHEETS: Record<SpriteSheetKey, SpriteSheetInfo> = {
  boss_sheet: {
    key: 'boss_sheet',
    url: bossSheetUrl,
    frameWidth: 352,
    frameHeight: 192,
    cols: 4,
    rows: 4,
  },
  monster_sheet_1: {
    key: 'monster_sheet_1',
    url: monsterSheet1Url,
    frameWidth: 352,
    frameHeight: 192,
    cols: 4,
    rows: 4,
  },
  monster_sheet_2: {
    key: 'monster_sheet_2',
    url: monsterSheet2Url,
    frameWidth: 352,
    frameHeight: 192,
    cols: 4,
    rows: 4,
  },
};

export const classSpriteAvailable = { value: false };

export function preloadSpriteSheets(scene: Phaser.Scene): void {
  scene.load.spritesheet('class_sprite', CLASS_SPRITE_URL, {
    frameWidth: CLASS_SPRITE_FRAME_WIDTH,
    frameHeight: CLASS_SPRITE_FRAME_HEIGHT,
  });

  Object.values(SPRITE_SHEETS).forEach((sheet) => {
    scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
  });

  Object.entries(bossSheetCellModules).forEach(([filePath, moduleUrl]) => {
    const textureKey = filePath.split('/').pop()!.replace('.png', '');
    const url = typeof moduleUrl === 'string'
      ? moduleUrl
      : (moduleUrl as { default?: string }).default ?? String(moduleUrl);
    scene.load.image(textureKey, url);
  });

  scene.load.on('loaderror', (file: any) => {
    console.warn('[SpriteLoader] Failed to load sprite sheet:', file.key, file.src);
  });
}

export function probeClassSpriteSheet(): void {
  const image = new Image();
  image.src = CLASS_SPRITE_URL;
  image.onload = () => { classSpriteAvailable.value = true; };
  image.onerror = () => {
    classSpriteAvailable.value = false;
    console.warn('[SpriteLoader] Failed to load class sprite sheet:', CLASS_SPRITE_URL);
  };
}

export function getClassSpriteBackgroundStyle(classId: string): { backgroundImage: string; backgroundSize: string; backgroundPosition: string; } {
  const index = CLASS_SPRITE_TRACE[classId] ?? 0;
  const col = index % CLASS_SPRITE_COLS;
  const row = Math.floor(index / CLASS_SPRITE_COLS);
  const x = -(col * CLASS_SPRITE_FRAME_WIDTH);
  const y = -(row * CLASS_SPRITE_FRAME_HEIGHT);
  return {
    backgroundImage: `url('${CLASS_SPRITE_URL}')`,
    backgroundSize: `${CLASS_SPRITE_FRAME_WIDTH * CLASS_SPRITE_COLS}px ${CLASS_SPRITE_FRAME_HEIGHT * CLASS_SPRITE_ROWS}px`,
    backgroundPosition: `${x}px ${y}px`,
  };
}

export function getClassSpriteFrame(classId: string): number | null {
  return CLASS_SPRITE_TRACE[classId] ?? null;
}

export function chooseRunMonsterSheet(): MonsterSheetKey {
  return Math.random() < 0.5 ? 'monster_sheet_1' : 'monster_sheet_2';
}

export function getEnemySheetFrameForFloor(floor: number): number {
  return (floor - 1) % (SPRITE_SHEETS.monster_sheet_1.cols * SPRITE_SHEETS.monster_sheet_1.rows);
}

export function getBossSheetFrameForFloor(floor: number): number {
  return (floor - 1) % (SPRITE_SHEETS.boss_sheet.cols * SPRITE_SHEETS.boss_sheet.rows);
}

export const SpriteLoader = {
  preload: preloadSpriteSheets,
  probeClassSpriteSheet,
  getClassSpriteBackgroundStyle,
  getClassSpriteFrame,
  chooseRunMonsterSheet,
  getEnemySheetFrameForFloor,
  getBossSheetFrameForFloor,
  getRandomBossSheetCellKey,
};
