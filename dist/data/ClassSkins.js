import { ALL_CLASSES } from './ClassDefinition';
const CLASS_SKIN_COST = 500;
const SKIN_FILE_RE = /^[a-z0-9]+(?:_[a-z0-9]+)+\.png$/;
const classSkinModules = import.meta.glob('../assets/sprites/class_sheets_cells/*.png', { query: '?url', import: 'default', eager: true });
const classIdByAssetPrefix = new Map(ALL_CLASSES.map((cls) => [assetPrefixForClass(cls.id), cls.id]));
const sortedClassPrefixes = [...classIdByAssetPrefix.keys()].sort((a, b) => b.length - a.length);
export const CLASS_SKINS = Object.entries(classSkinModules)
    .map(([filePath, moduleUrl]) => buildSkinDefinition(filePath, moduleUrl))
    .filter((skin) => skin !== null)
    .sort((a, b) => a.classId.localeCompare(b.classId) || a.skinName.localeCompare(b.skinName));
export const CLASS_SKINS_BY_ID = new Map(CLASS_SKINS.map((skin) => [skin.id, skin]));
export function getClassSkins(classId) {
    return CLASS_SKINS.filter((skin) => skin.classId === classId);
}
export function getClassSkinById(skinId) {
    if (!skinId)
        return null;
    return CLASS_SKINS_BY_ID.get(skinId) ?? null;
}
function buildSkinDefinition(filePath, moduleUrl) {
    const fileName = filePath.split('/').pop() ?? '';
    if (!SKIN_FILE_RE.test(fileName)) {
        console.warn(`[ClassSkins] Ignoring skin asset with invalid name: ${fileName}`);
        return null;
    }
    const id = fileName.replace('.png', '');
    const classPrefix = sortedClassPrefixes.find((prefix) => id.startsWith(`${prefix}_`));
    if (!classPrefix) {
        console.warn(`[ClassSkins] Ignoring skin asset without a matching class prefix: ${fileName}`);
        return null;
    }
    const classId = classIdByAssetPrefix.get(classPrefix);
    const skinName = id.slice(classPrefix.length + 1);
    if (!classId || skinName.length === 0) {
        console.warn(`[ClassSkins] Ignoring incomplete skin asset: ${fileName}`);
        return null;
    }
    return {
        id,
        classId,
        skinName,
        displayName: toTitleCase(skinName),
        textureKey: `class_skin_${id}`,
        url: typeof moduleUrl === 'string' ? moduleUrl : moduleUrl.default ?? String(moduleUrl),
        cost: CLASS_SKIN_COST,
    };
}
function assetPrefixForClass(classId) {
    return classId.toLowerCase();
}
function toTitleCase(value) {
    return value
        .split('_')
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ');
}
