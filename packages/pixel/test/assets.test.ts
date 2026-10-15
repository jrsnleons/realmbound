import { describe, expect, it } from 'vitest';
import {
  AURA_KINDS,
  EQUIPMENT_VISUAL_IDS,
  ICON_NAMES,
  MONSTER_IDS,
  OVERLAY_TILES,
  PATH_ALIASES,
  PROP_NAMES,
  TILE_NAMES,
  VFX_IDS,
  countOpaque,
  crop,
  pathTileFor,
  renderAllProps,
  renderAuraSheet,
  renderIcon,
  renderIconSheet,
  renderItemIcon,
  renderMonster,
  renderProp,
  renderTile,
  renderTileset,
  renderVfx,
  type PixelImage,
} from '../src/index';

const same = (a: PixelImage, b: PixelImage) => Buffer.from(a.data).equals(Buffer.from(b.data));

describe('tiles', () => {
  const ts = renderTileset();
  it('contains every tile at 16×16', () => {
    expect(ts.tileSize).toBe(16);
    expect(ts.frameWidth).toBe(16);
    expect(ts.frameHeight).toBe(16);
    expect(Object.keys(ts.tiles)).toHaveLength(TILE_NAMES.length);
    for (const n of TILE_NAMES) {
      const r = ts.frames[ts.tiles[n] as number]!;
      expect(r.name).toBe(n);
      const img = crop(ts.image, r.x, r.y, 16, 16);
      expect(countOpaque(img), n).toBeGreaterThan(0);
      if (!OVERLAY_TILES.includes(n)) expect(countOpaque(img), n).toBe(256);
    }
  });
  it('has the required families', () => {
    const names: readonly string[] = TILE_NAMES;
    for (const n of ['grass_0', 'grass_3', 'grass_flowers_1', 'grass_flowers_0_wilted', 'tall_grass', 'cobblestone_1', 'plaza_tile', 'water_0', 'water_1', 'shore_n', 'sand', 'wooden_floor', 'rug_c', 'stone_wall_top', 'stone_wall_face', 'wood_wall_face', 'fence_h', 'fence_v', 'fence_post', 'hedge', 'hedge_wilted', 'dark_forest_floor_1', 'mushrooms', 'bridge_h'])
      expect(names).toContain(n);
    for (let m = 0; m < 16; m++) expect(names).toContain(pathTileFor(m));
    for (const v of Object.values(PATH_ALIASES)) expect(names).toContain(v);
  });
  it('is deterministic and water animates', () => {
    expect(same(renderTileset().image, ts.image)).toBe(true);
    expect(same(renderTile('water_0'), renderTile('water_1'))).toBe(false);
    expect(same(renderTile('hedge'), renderTile('hedge_wilted'))).toBe(false);
  });
});

describe('props', () => {
  const all = renderAllProps();
  it('renders every prop with a feet anchor inside the image', () => {
    for (const n of PROP_NAMES) {
      const p = all[n];
      expect(p.frames.length).toBeGreaterThan(0);
      for (const f of p.frames) {
        expect(countOpaque(f), n).toBeGreaterThan(10);
        expect(f.width).toBe(p.image.width);
      }
      expect(p.anchorX).toBeGreaterThanOrEqual(0);
      expect(p.anchorX).toBeLessThan(p.image.width);
      expect(p.anchorY).toBeGreaterThanOrEqual(p.image.height / 2);
      expect(p.anchorY).toBeLessThan(p.image.height);
    }
  });
  it('has the specified sizes and frame counts', () => {
    const size = (n: (typeof PROP_NAMES)[number]) => [all[n].image.width, all[n].image.height];
    expect(size('house')).toEqual([48, 48]);
    expect(size('shop_stall')).toEqual([32, 32]);
    expect(size('guild_hall')).toEqual([64, 56]);
    expect(size('quest_board')).toEqual([24, 24]);
    expect(size('forge_lit')).toEqual([32, 32]);
    expect(size('fountain')).toEqual([48, 40]);
    expect(size('lamp_post_lit')).toEqual([8, 24]);
    expect(size('tree_0')).toEqual([32, 48]);
    expect(size('pine_tree')).toEqual([24, 40]);
    expect(size('bush_bloom')).toEqual([16, 16]);
    expect(size('campfire')).toEqual([16, 16]);
    expect(all.fountain.frames).toHaveLength(2);
    expect(all.campfire.frames).toHaveLength(3);
  });
  it('is deterministic', () => {
    expect(same(renderProp('house').image, all.house.image)).toBe(true);
    expect(same(renderProp('forge_lit').image, renderProp('forge_dim').image)).toBe(false);
  });
});

describe('monsters', () => {
  const expected = {
    slime: [16, 16, 4],
    forest_goblin: [24, 24, 2],
    shadow_wisp: [16, 24, 4],
    corruption_beast: [32, 32, 2],
    ancient_treant: [64, 64, 2],
  } as const;
  for (const id of MONSTER_IDS) {
    it(`${id} has correct frames`, () => {
      const m = renderMonster(id);
      const [w, h, n] = expected[id];
      expect(m.frames).toHaveLength(n);
      expect(m.frameWidth).toBe(w);
      expect(m.frameHeight).toBe(h);
      expect(m.sheet.image.width).toBe(w * n);
      for (const f of m.frames) expect(countOpaque(f)).toBeGreaterThan(20);
      expect(same(renderMonster(id).sheet.image, m.sheet.image)).toBe(true);
    });
  }
});

describe('icons', () => {
  it('renders every UI icon at 16×16', () => {
    for (const n of ICON_NAMES) {
      const i = renderIcon(n);
      expect([i.width, i.height]).toEqual([16, 16]);
      expect(countOpaque(i), n).toBeGreaterThan(15);
    }
    const sheet = renderIconSheet();
    expect(Object.keys(sheet.icons)).toHaveLength(ICON_NAMES.length);
  });
  it('renders an item icon for every equipment id', () => {
    for (const id of EQUIPMENT_VISUAL_IDS) {
      const i = renderItemIcon(id);
      expect([i.width, i.height]).toEqual([16, 16]);
      expect(countOpaque(i), id).toBeGreaterThan(15);
    }
  });
});

describe('vfx and auras', () => {
  it('has the documented frame counts', () => {
    const lu = renderVfx('level_up');
    expect(lu.frames).toHaveLength(6);
    expect([lu.frameWidth, lu.frameHeight]).toEqual([32, 32]);
    const sp = renderVfx('sparkle');
    expect(sp.frames).toHaveLength(4);
    expect([sp.frameWidth, sp.frameHeight]).toEqual([8, 8]);
    for (const id of VFX_IDS) for (const f of renderVfx(id).frames) expect(countOpaque(f), id).toBeGreaterThan(0);
  });
  it('aura overlays are 24×32 × 4 frames', () => {
    for (const k of AURA_KINDS) {
      const a = renderAuraSheet(k);
      expect(a.frames).toHaveLength(4);
      expect([a.frameWidth, a.frameHeight]).toEqual([24, 32]);
      for (const f of a.frames) expect(countOpaque(f)).toBeGreaterThan(5);
    }
  });
});
