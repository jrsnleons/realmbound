import type { WorldState } from '@realmbound/game-engine';
import { pathTileFor, type PropName, type TileName } from '@realmbound/pixel';

export type ZoneKey = 'riverstone' | 'whispering_woods' | 'player_room';

export interface PropPlacement {
  name: PropName;
  /** Tile column/row of the prop's feet. */
  x: number;
  y: number;
  /** Tiles blocked around the feet: width (centred) and height (upwards). */
  block?: [number, number];
  /** Optional interaction id (quest board, boss, npc…). */
  id?: string;
}

export interface NpcPlacement {
  id: string;
  name: string;
  x: number;
  y: number;
  look: { skinTone: number; hairStyle: number; hairColor: number; face: number; bodyTier: 1 | 2 | 3; equipment: Record<string, string> };
  lines: string[];
}

export interface ZoneMap {
  key: ZoneKey;
  width: number;
  height: number;
  ground: TileName[][];
  overlay: (TileName | null)[][];
  blocked: boolean[][];
  props: PropPlacement[];
  npcs: NpcPlacement[];
  spawn: { x: number; y: number };
  exits: { x: number; y: number; to: ZoneKey; spawn: { x: number; y: number } }[];
  indoor: boolean;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grid<T>(w: number, h: number, v: T): T[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => v));
}

class Builder {
  ground: TileName[][];
  overlay: (TileName | null)[][];
  blocked: boolean[][];
  path: boolean[][];
  props: PropPlacement[] = [];
  constructor(
    public w: number,
    public h: number,
    fill: TileName,
  ) {
    this.ground = grid(w, h, fill);
    this.overlay = grid<TileName | null>(w, h, null);
    this.blocked = grid(w, h, false);
    this.path = grid(w, h, false);
  }
  in(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  rect(x0: number, y0: number, w: number, h: number, tile: TileName | ((x: number, y: number) => TileName), block = false) {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (!this.in(x, y)) continue;
        this.ground[y]![x] = typeof tile === 'function' ? tile(x, y) : tile;
        if (block) this.blocked[y]![x] = true;
      }
  }
  dirt(x0: number, y0: number, w: number, h: number) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.in(x, y)) this.path[y]![x] = true;
  }
  prop(p: PropPlacement) {
    this.props.push(p);
    const [bw, bh] = p.block ?? [1, 1];
    const x0 = p.x - Math.floor((bw - 1) / 2);
    for (let y = p.y - bh + 1; y <= p.y; y++) for (let x = x0; x < x0 + bw; x++) if (this.in(x, y)) this.blocked[y]![x] = true;
  }
  free(x: number, y: number) {
    return this.in(x, y) && !this.blocked[y]![x] && [0, 1, 2].every((d) => [-1, 0, 1].every((dx) => !this.path[y - d]?.[x + dx])) && !this.props.some((p) => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1);
  }
  /** Converts the dirt-path mask into autotiles. */
  finishPaths() {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!this.path[y]![x]) continue;
        const at = (dx: number, dy: number) => this.in(x + dx, y + dy) && this.path[y + dy]![x + dx];
        const mask = (at(0, -1) ? 1 : 0) | (at(1, 0) ? 2 : 0) | (at(0, 1) ? 4 : 0) | (at(-1, 0) ? 8 : 0);
        this.ground[y]![x] = pathTileFor(mask);
      }
  }
}

const NPC_LOOKS = {
  mae: { skinTone: 2, hairStyle: 5, hairColor: 6, face: 2, bodyTier: 2 as const, equipment: { chest: 'scholar_chest', head: 'scholar_head' } },
  brann: { skinTone: 4, hairStyle: 1, hairColor: 0, face: 1, bodyTier: 3 as const, equipment: { chest: 'iron_guardian_chest', weapon: 'iron_guardian_weapon', back: 'iron_guardian_back' } },
  ilse: { skinTone: 1, hairStyle: 7, hairColor: 5, face: 0, bodyTier: 1 as const, equipment: { chest: 'forest_scout_chest', head: 'forest_scout_head', weapon: 'forest_scout_weapon' } },
  bea: { skinTone: 3, hairStyle: 9, hairColor: 3, face: 3, bodyTier: 2 as const, equipment: { chest: 'traveler_chest' } },
  smith: { skinTone: 0, hairStyle: 2, hairColor: 1, face: 1, bodyTier: 3 as const, equipment: { chest: 'warden_chest' } },
};

export function buildZone(key: ZoneKey, world: WorldState): ZoneMap {
  if (key === 'player_room') return buildRoom(world);
  if (key === 'whispering_woods') return buildWoods(world);
  return buildTown(world);
}

function grassFor(r: () => number, world: WorldState): TileName {
  const v = r();
  if (v < 0.07) return world === 'struggling' ? 'grass_flowers_0_wilted' : 'grass_flowers_0';
  if (v < (world === 'thriving' ? 0.16 : 0.1)) return world === 'struggling' ? 'grass_flowers_1_wilted' : 'grass_flowers_1';
  return (['grass_0', 'grass_1', 'grass_2', 'grass_3'] as const)[Math.floor(r() * 4)]!;
}

function buildTown(world: WorldState): ZoneMap {
  const W = 30;
  const H = 26;
  const r = rng(7);
  const b = new Builder(W, H, 'grass_0');
  b.rect(0, 0, W, H, () => grassFor(r, world));

  // River on the east side with a bridge.
  b.rect(25, 0, 3, H, (x, y) => ((x + y) % 2 ? 'water_0' : 'water_1'), true);
  b.rect(24, 0, 1, H, 'sand');
  b.rect(28, 0, 2, H, 'sand');
  b.rect(24, 12, 6, 2, (x) => (x >= 25 && x <= 27 ? 'bridge_h' : 'plaza_tile'));
  for (let x = 24; x < 30; x++) for (const y of [12, 13]) b.blocked[y]![x] = false;

  // Plaza.
  b.rect(6, 9, 15, 9, (x, y) => ((x * 7 + y * 3) % 5 === 0 ? 'cobblestone_1' : 'cobblestone_0'));
  b.rect(11, 12, 5, 3, 'plaza_tile');

  // Roads: north to the guild, south exit to the woods, east to the bridge.
  b.dirt(13, 18, 1, 8);
  b.dirt(21, 13, 3, 1);
  b.dirt(13, 6, 1, 3);
  b.finishPaths();

  // Buildings.
  b.prop({ name: 'guild_hall', x: 13, y: 5, block: [6, 3], id: 'guild' });
  b.prop({ name: 'house', x: 4, y: 6, block: [4, 2] });
  b.prop({ name: 'house', x: 21, y: 6, block: [4, 2] });
  b.prop({ name: 'house', x: 3, y: 21, block: [4, 2] });
  b.prop({ name: 'shop_stall', x: 8, y: 10, block: [3, 1], id: 'shop' });
  b.prop({ name: world === 'struggling' ? 'forge_dim' : 'forge_lit', x: 19, y: 10, block: [3, 1], id: 'forge' });
  b.prop({ name: 'quest_board', x: 16, y: 8, block: [2, 1], id: 'quest_board' });
  b.prop({ name: 'fountain', x: 13, y: 14, block: [3, 2], id: 'fountain' });
  const lamp: PropName = world === 'struggling' ? 'lamp_post_unlit' : 'lamp_post_lit';
  for (const [x, y] of [
    [6, 9],
    [20, 9],
    [6, 17],
    [20, 17],
  ] as const)
    b.prop({ name: lamp, x, y });
  b.prop({ name: 'signpost', x: 15, y: 20, id: 'sign_woods' });
  b.prop({ name: 'crate', x: 10, y: 10 });
  b.prop({ name: 'barrel', x: 17, y: 10 });
  b.prop({ name: 'barrel', x: 18, y: 18 });
  b.prop({ name: 'training_dummy', x: 22, y: 20, id: 'dummy' });

  // Hedges and greenery.
  const bush: PropName = world === 'thriving' ? 'bush_bloom' : world === 'struggling' ? 'bush_wilted' : 'bush';
  for (const x of [7, 9, 17, 19]) b.prop({ name: bush, x, y: 18 });
  for (let x = 0; x < 24; x += 2) {
    if (b.free(x, 0)) b.prop({ name: r() < 0.5 ? 'tree_0' : 'tree_1', x, y: 1 });
  }
  for (let y = 3; y < H - 1; y += 3) if (b.free(0, y)) b.prop({ name: r() < 0.3 ? 'pine_tree' : 'tree_0', x: 0, y });
  for (let i = 0; i < 14; i++) {
    const x = 1 + Math.floor(r() * 22);
    const y = 19 + Math.floor(r() * 6);
    if (b.free(x, y)) b.prop({ name: world === 'struggling' && r() < 0.4 ? 'tree_bare' : r() < 0.5 ? 'tree_1' : 'bush', x, y });
  }
  for (let i = 0; i < 6; i++) {
    const x = 1 + Math.floor(r() * 22);
    const y = 2 + Math.floor(r() * 6);
    if (b.free(x, y)) b.prop({ name: r() < 0.5 ? 'rock_0' : 'flower_pot', x, y });
  }

  return {
    key: 'riverstone',
    width: W,
    height: H,
    ground: b.ground,
    overlay: b.overlay,
    blocked: b.blocked,
    props: b.props,
    npcs: [
      { id: 'mae', name: 'Registrar Mae', x: 12, y: 7, look: NPC_LOOKS.mae, lines: ['Welcome back to Riverstone!', 'The quest board has fresh work.', 'Every small step goes in the ledger.'] },
      { id: 'brann', name: 'Captain Brann', x: 21, y: 21, look: NPC_LOOKS.brann, lines: ['Consistency beats intensity.', 'Show up. Then show up again.', 'The dummy never skips leg day.'] },
      { id: 'smith', name: 'Smith Odo', x: 20, y: 11, look: NPC_LOOKS.smith, lines: ['Bring me materials and I will forge you something fine.', 'Iron from training, leather from the road.'] },
      { id: 'bea', name: 'Bea', x: 9, y: 11, look: NPC_LOOKS.bea, lines: ['Fresh water, fresh start!', 'Gold buys potions here. Effort earns gold.'] },
    ],
    spawn: { x: 14, y: 16 },
    exits: [
      { x: 13, y: 25, to: 'whispering_woods', spawn: { x: 12, y: 2 } },
    ],
    indoor: false,
  };
}

function buildWoods(world: WorldState): ZoneMap {
  const W = 26;
  const H = 24;
  const r = rng(21);
  const b = new Builder(W, H, 'dark_forest_floor_0');
  b.rect(0, 0, W, H, () => (r() < 0.3 ? 'dark_forest_floor_1' : r() < 0.6 ? 'dark_forest_floor_0' : 'grass_2'));
  b.dirt(12, 0, 1, 10);
  b.dirt(8, 9, 10, 1);
  b.dirt(8, 10, 1, 6);
  b.finishPaths();
  // Boss clearing.
  b.rect(6, 15, 9, 6, () => (r() < 0.5 ? 'dirt' : 'grass_3'));
  b.prop({ name: world === 'struggling' ? 'campfire_weak' : 'campfire', x: 17, y: 11, id: 'campfire' });
  b.prop({ name: 'stump', x: 15, y: 12 });
  b.prop({ name: 'signpost', x: 14, y: 2, id: 'sign_town' });
  b.prop({ name: 'chest_rare_closed', x: 22, y: 20, id: 'chest' });
  for (let i = 0; i < 55; i++) {
    const x = Math.floor(r() * W);
    const y = 1 + Math.floor(r() * (H - 1));
    if (x >= 5 && x <= 15 && y >= 14 && y <= 21) continue;
    if (b.free(x, y)) b.prop({ name: r() < 0.6 ? 'pine_tree' : world === 'struggling' && r() < 0.5 ? 'tree_bare' : 'tree_1', x, y });
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(r() * H);
    if (!b.path[y]![x] && !b.blocked[y]![x]) b.overlay[y]![x] = r() < 0.5 ? 'mushrooms' : world === 'struggling' ? 'tall_grass_wilted' : 'tall_grass';
  }
  return {
    key: 'whispering_woods',
    width: W,
    height: H,
    ground: b.ground,
    overlay: b.overlay,
    blocked: b.blocked,
    props: b.props,
    npcs: [{ id: 'ilse', name: 'Ranger Ilse', x: 16, y: 13, look: NPC_LOOKS.ilse, lines: ['The weekly threat lurks in the clearing.', 'Every habit you log is a blow against it.', 'Missed days let it heal. Keep the pressure on.'] }],
    spawn: { x: 12, y: 3 },
    exits: [{ x: 12, y: 0, to: 'riverstone', spawn: { x: 13, y: 23 } }],
    indoor: false,
  };
}

function buildRoom(world: WorldState): ZoneMap {
  const W = 12;
  const H = 10;
  const b = new Builder(W, H, 'wooden_floor');
  b.rect(0, 0, W, 2, (_, y) => (y === 0 ? 'wood_wall_top' : 'wood_wall_face'), true);
  b.rect(0, 0, 1, H, 'wood_wall_top', true);
  b.rect(W - 1, 0, 1, H, 'wood_wall_top', true);
  b.rect(0, H - 1, W, 1, 'wood_wall_top', true);
  b.rect(5, H - 1, 2, 1, 'wooden_floor');
  b.blocked[H - 1]![5] = false;
  b.blocked[H - 1]![6] = false;
  const rug: TileName[][] = [
    ['rug_nw', 'rug_n', 'rug_n', 'rug_ne'],
    ['rug_w', 'rug_c', 'rug_c', 'rug_e'],
    ['rug_sw', 'rug_s', 'rug_s', 'rug_se'],
  ];
  rug.forEach((row, dy) => row.forEach((t, dx) => (b.ground[4 + dy]![4 + dx] = t)));
  b.prop({ name: 'bed', x: 2, y: 3, block: [2, 2], id: 'bed' });
  b.prop({ name: 'desk', x: 6, y: 2, block: [2, 1], id: 'desk' });
  b.prop({ name: 'bookshelf', x: 9, y: 2, block: [2, 1] });
  b.prop({ name: world === 'struggling' ? 'plant_pot_wilted' : 'plant_pot_thriving', x: 10, y: 7 });
  b.prop({ name: 'chest_common_closed', x: 2, y: 7, id: 'chest' });
  return {
    key: 'player_room',
    width: W,
    height: H,
    ground: b.ground,
    overlay: b.overlay,
    blocked: b.blocked,
    props: b.props,
    npcs: [],
    spawn: { x: 6, y: 7 },
    exits: [],
    indoor: true,
  };
}

/** 4-directional A* over the blocked grid. Returns tiles from start (exclusive) to goal (inclusive). */
export function findPath(blocked: boolean[][], from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  const h = blocked.length;
  const w = blocked[0]!.length;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !blocked[y]![x];
  if (!ok(to.x, to.y)) return [];
  const key = (x: number, y: number) => y * w + x;
  const open = new Map<number, { x: number; y: number; g: number; f: number }>();
  const came = new Map<number, number>();
  const g = new Map<number, number>();
  const start = key(from.x, from.y);
  g.set(start, 0);
  open.set(start, { x: from.x, y: from.y, g: 0, f: Math.abs(to.x - from.x) + Math.abs(to.y - from.y) });
  let guard = 0;
  while (open.size && guard++ < 4000) {
    let cur: { x: number; y: number; g: number; f: number } | undefined;
    let ck = -1;
    for (const [k, v] of open) if (!cur || v.f < cur.f) [cur, ck] = [v, k];
    if (!cur) break;
    if (cur.x === to.x && cur.y === to.y) {
      const out: { x: number; y: number }[] = [];
      let k = ck;
      while (k !== start) {
        out.unshift({ x: k % w, y: Math.floor(k / w) });
        k = came.get(k)!;
      }
      return out;
    }
    open.delete(ck);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!ok(nx, ny)) continue;
      const nk = key(nx, ny);
      const ng = cur.g + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, ck);
        open.set(nk, { x: nx, y: ny, g: ng, f: ng + Math.abs(to.x - nx) + Math.abs(to.y - ny) });
      }
    }
  }
  return [];
}
