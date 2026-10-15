/**
 * @realmbound/pixel — procedural placeholder pixel art for Realmbound.
 *
 * Everything renders to plain RGBA `PixelImage` buffers (no DOM). Use the
 * helpers in `browser` to turn them into canvases / data URLs.
 */
export * from './image';
export * from './palette';
export * from './sheet';
export * from './draw';
export * from './character';
export { HAIR_STYLES, type HairStyleDef, type HairTemplate } from './characterHair';
export {
  CHEST_STYLES,
  BACK_STYLES,
  HEAD_GEAR,
  WEAPONS,
  GEAR,
  type ChestStyle,
  type BackStyle,
  type HeadGearDef,
  type WeaponDef,
} from './characterGear';
export * from './tiles';
export * from './props';
export * from './monsters';
export * from './icons';
export * from './vfx';
export * from './browser';
