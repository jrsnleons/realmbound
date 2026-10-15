import { renderCharacterSheet, renderMonster, renderProp, renderTileset, type Appearance as PixelAppearance, type Condition, type Direction, type FrameRect, type MonsterId, type PixelImage, type PropName } from '@realmbound/pixel';
import * as Phaser from 'phaser';
import { findPath, type NpcPlacement, type ZoneKey, type ZoneMap } from './maps';

const T = 16;
const SPEED = 72; // pixels per second
const EMOTE_EMOJI: Record<string, string> = { wave: '👋', cheer: '🎉', heart: '❤️', laugh: '😂', sleep: '💤', thumbs_up: '👍' };

export interface SceneConfig {
  zone: ZoneMap;
  me: { id: string; name: string; look: PixelAppearance; condition: Condition };
  hour: number;
  worldState: 'thriving' | 'neutral' | 'struggling';
  boss?: { id: MonsterId; name: string; hp: number; maxHp: number; defeated: boolean };
  reducedMotion: boolean;
  onExit(to: ZoneKey, spawn: { x: number; y: number }): void;
  onMove(path: [number, number][]): void;
  onInteract(id: string, label?: string): void;
}

function toCanvas(img: PixelImage): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
}

let texSeq = 0;

class Walker {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  bubble?: Phaser.GameObjects.Text;
  bubbleTimer?: Phaser.Time.TimerEvent;
  tile: { x: number; y: number };
  dir: Direction = 'down';
  queue: { x: number; y: number }[] = [];
  moving = false;
  /** Tile the current step is heading to (where a new path should start). */
  heading: { x: number; y: number } = { x: 0, y: 0 };
  onArrive?: () => void;

  constructor(
    private scene: WorldScene,
    public texKey: string,
    x: number,
    y: number,
    name: string,
    labelColor = '#ffffff',
  ) {
    this.tile = { x, y };
    this.sprite = scene.add.sprite(x * T + T / 2, y * T + T, texKey, 0).setOrigin(0.5, 1);
    this.label = scene.add
      .text(0, 0, name, { fontFamily: '-apple-system, system-ui, sans-serif', fontSize: '7px', color: labelColor, stroke: '#000000', strokeThickness: 2, resolution: 6 })
      .setOrigin(0.5, 1);
    this.play('idle');
    this.sync();
  }

  play(anim: 'idle' | 'walk' | 'celebrate') {
    const key = `${this.texKey}:${anim}:${this.dir}`;
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key, true);
  }

  sync() {
    this.sprite.setDepth(this.sprite.y);
    this.label.setPosition(Math.round(this.sprite.x), Math.round(this.sprite.y - 31)).setDepth(10_000 + this.sprite.y);
    this.bubble?.setPosition(Math.round(this.sprite.x), Math.round(this.sprite.y - 39)).setDepth(10_001 + this.sprite.y);
  }

  walk(path: { x: number; y: number }[], onArrive?: () => void) {
    this.queue = path.slice();
    this.onArrive = onArrive;
    if (!this.moving) this.step();
  }

  place(x: number, y: number) {
    this.queue = [];
    this.tile = { x, y };
    this.sprite.setPosition(x * T + T / 2, y * T + T);
    this.sync();
  }

  private step() {
    const next = this.queue.shift();
    if (!next) {
      this.moving = false;
      this.play('idle');
      const cb = this.onArrive;
      this.onArrive = undefined;
      cb?.();
      return;
    }
    this.moving = true;
    this.heading = next;
    const dx = next.x - this.tile.x;
    const dy = next.y - this.tile.y;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.play('walk');
    const dist = Math.max(1, Math.abs(dx) + Math.abs(dy));
    this.scene.tweens.add({
      targets: this.sprite,
      x: next.x * T + T / 2,
      y: next.y * T + T,
      duration: (dist * T * 1000) / SPEED,
      onUpdate: () => this.sync(),
      onComplete: () => {
        this.tile = next;
        this.scene.arrived(this);
        this.step();
      },
    });
  }

  say(text: string, ms = 2600) {
    this.bubble?.destroy();
    this.bubbleTimer?.remove();
    const emoji = text.length <= 2;
    this.bubble = this.scene.add
      .text(0, 0, text, {
        fontFamily: '-apple-system, system-ui, sans-serif',
        fontSize: emoji ? '12px' : '7px',
        color: '#1c1c1e',
        backgroundColor: emoji ? undefined : '#ffffffee',
        padding: emoji ? undefined : { x: 3, y: 2 },
        resolution: 6,
        wordWrap: { width: 110 },
        align: 'center',
      })
      .setOrigin(0.5, 1);
    this.sync();
    this.bubbleTimer = this.scene.time.delayedCall(ms, () => {
      this.bubble?.destroy();
      this.bubble = undefined;
    });
  }

  face(dir: Direction) {
    this.dir = dir;
    this.play('idle');
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
    this.bubble?.destroy();
  }
}

export class WorldScene extends Phaser.Scene {
  cfg!: SceneConfig;
  me!: Walker;
  peers = new Map<string, Walker>();
  npcs = new Map<string, { walker: Walker; npc: NpcPlacement }>();
  interactables: { id: string; x: number; y: number; label?: string }[] = [];
  blocked!: boolean[][];
  private sheetKeys = new Map<string, string>();

  constructor() {
    super('world');
  }

  init(cfg: SceneConfig) {
    this.cfg = cfg;
  }

  /** Character sheet texture + animations for one look (cached per scene). */
  characterTexture(look: PixelAppearance, condition: Condition = 'normal'): string {
    const cacheKey = JSON.stringify([look, condition]);
    const hit = this.sheetKeys.get(cacheKey);
    if (hit) return hit;
    const key = `char${++texSeq}`;
    const sheet = renderCharacterSheet(look, { condition });
    const tex = this.textures.addCanvas(key, toCanvas(sheet.image))!;
    const total = sheet.columns * (sheet.image.height / sheet.frameHeight);
    for (let i = 0; i < total; i++) tex.add(i, 0, (i % sheet.columns) * sheet.frameWidth, Math.floor(i / sheet.columns) * sheet.frameHeight, sheet.frameWidth, sheet.frameHeight);
    for (const anim of ['idle', 'walk', 'celebrate'] as const) {
      const info = sheet.animations[anim];
      for (const dir of ['down', 'up', 'left', 'right'] as const) {
        this.anims.create({
          key: `${key}:${anim}:${dir}`,
          frames: Array.from({ length: info.frames }, (_, f) => ({ key, frame: sheet.frameIndex(anim, dir, f) })),
          frameRate: this.cfg.reducedMotion && anim === 'idle' ? 0.001 : info.fps,
          repeat: info.loop ? -1 : 0,
        });
      }
    }
    this.sheetKeys.set(cacheKey, key);
    return key;
  }

  private sheetTexture(key: string, img: PixelImage, rects: FrameRect[]) {
    if (this.textures.exists(key)) return;
    const tex = this.textures.addCanvas(key, toCanvas(img))!;
    rects.forEach((r, i) => tex.add(i, 0, r.x, r.y, r.w, r.h));
  }

  create() {
    const { zone } = this.cfg;
    this.blocked = zone.blocked.map((r) => r.slice());
    const W = zone.width * T;
    const H = zone.height * T;

    // Ground: pre-render two frames (water shimmer) into big canvases.
    const tileset = renderTileset();
    const tilesCanvas = toCanvas(tileset.image);
    const ground = [0, 1].map((frame) => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      const draw = (name: string, x: number, y: number) => {
        const idx = tileset.tiles[name as keyof typeof tileset.tiles];
        const r = idx === undefined ? undefined : tileset.frames[idx];
        if (r) g.drawImage(tilesCanvas, r.x, r.y, r.w, r.h, x * T, y * T, T, T);
      };
      for (let y = 0; y < zone.height; y++)
        for (let x = 0; x < zone.width; x++) {
          let name: string = zone.ground[y]![x]!;
          if (frame === 1 && name.startsWith('water_')) name = name === 'water_0' ? 'water_1' : 'water_0';
          draw(name, x, y);
          const o = zone.overlay[y]![x];
          if (o) draw(o, x, y);
        }
      this.textures.addCanvas(`ground${frame}:${zone.key}`, c);
      return `ground${frame}:${zone.key}`;
    });
    const groundImg = this.add.image(0, 0, ground[0]!).setOrigin(0).setDepth(-1000);
    if (!this.cfg.reducedMotion && zone.ground.some((r) => r.some((t) => t.startsWith('water')))) {
      let f = 0;
      this.time.addEvent({ delay: 650, loop: true, callback: () => groundImg.setTexture(ground[(f = 1 - f)]!) });
    }

    // Props, depth-sorted by their feet.
    const propCache = new Map<PropName, ReturnType<typeof renderProp>>();
    for (const p of zone.props) {
      let prop = propCache.get(p.name);
      if (!prop) {
        prop = renderProp(p.name);
        propCache.set(p.name, prop);
        const fw = prop.image.width;
        const fh = prop.image.height;
        const strip: PixelImage = { width: fw * prop.frames.length, height: fh, data: new Uint8ClampedArray(fw * prop.frames.length * fh * 4) };
        prop.frames.forEach((fr, i) => {
          for (let y = 0; y < fh; y++) strip.data.set(fr.data.subarray(y * fw * 4, (y + 1) * fw * 4), (y * strip.width + i * fw) * 4);
        });
        this.sheetTexture(`prop:${p.name}`, strip, prop.frames.map((_, i) => ({ x: i * fw, y: 0, w: fw, h: fh })));
        if (prop.frames.length > 1) {
          this.anims.create({ key: `prop:${p.name}`, frames: prop.frames.map((_, i) => ({ key: `prop:${p.name}`, frame: i })), frameRate: prop.fps, repeat: -1 });
        }
      }
      const s = this.add.sprite(p.x * T + T / 2, p.y * T + T, `prop:${p.name}`, 0);
      s.setOrigin(prop.anchorX / prop.image.width, prop.anchorY / prop.image.height).setDepth(p.y * T + T - 1);
      if (prop.frames.length > 1 && !this.cfg.reducedMotion) s.play(`prop:${p.name}`);
      if (p.id) this.interactables.push({ id: p.id, x: p.x, y: p.y });
    }

    // Weekly boss in the woods clearing.
    if (zone.key === 'whispering_woods' && this.cfg.boss) {
      const b = this.cfg.boss;
      const m = renderMonster(b.id);
      this.sheetTexture(`monster:${b.id}`, m.sheet.image, m.sheet.frames);
      this.anims.create({ key: `monster:${b.id}`, frames: m.frames.map((_, i) => ({ key: `monster:${b.id}`, frame: i })), frameRate: m.fps, repeat: -1 });
      const bx = 10;
      const by = 18;
      const s = this.add.sprite(bx * T + T / 2, by * T + T, `monster:${b.id}`, 0).setOrigin(m.anchorX / m.frameWidth, m.anchorY / m.frameHeight).setDepth(by * T + T);
      if (!this.cfg.reducedMotion) s.play(`monster:${b.id}`);
      if (b.defeated) s.setAlpha(0.35);
      this.add
        .text(bx * T + T / 2, by * T + T - m.frameHeight - 2, b.defeated ? `${b.name} · defeated` : `${b.name} · ${b.hp}/${b.maxHp} HP`, {
          fontFamily: '-apple-system, system-ui, sans-serif',
          fontSize: '7px',
          color: b.defeated ? '#a6f0b4' : '#ffb3a8',
          stroke: '#000',
          strokeThickness: 2,
          resolution: 6,
        })
        .setOrigin(0.5, 1)
        .setDepth(20_000);
      for (let y = by - 1; y <= by; y++) for (let x = bx - 1; x <= bx + 1; x++) if (this.blocked[y]?.[x] !== undefined) this.blocked[y]![x] = true;
      this.interactables.push({ id: 'boss', x: bx, y: by, label: b.defeated ? `${b.name} was defeated this week.` : `${b.name}: ${b.hp}/${b.maxHp} HP. Log habits to strike it!` });
    }

    // NPCs.
    for (const npc of zone.npcs) {
      const key = this.characterTexture({ ...npc.look, equipment: npc.look.equipment as PixelAppearance['equipment'] });
      const w = new Walker(this, key, npc.x, npc.y, npc.name, '#ffd60a');
      this.npcs.set(npc.id, { walker: w, npc });
      this.blocked[npc.y]![npc.x] = true;
      this.interactables.push({ id: `npc:${npc.id}`, x: npc.x, y: npc.y });
    }
    if (!this.cfg.reducedMotion) {
      this.time.addEvent({
        delay: 2400,
        loop: true,
        callback: () => {
          for (const { walker } of this.npcs.values()) if (Math.random() < 0.35) walker.face((['down', 'left', 'right', 'up'] as const)[Math.floor(Math.random() * 4)]!);
        },
      });
    }

    // Player.
    this.me = new Walker(this, this.characterTexture(this.cfg.me.look, this.cfg.me.condition), zone.spawn.x, zone.spawn.y, this.cfg.me.name, '#ffffff');

    // Lighting: night tint and world-state mood across the whole map.
    const h = this.cfg.hour;
    const night = h >= 20 || h < 5 ? 0.42 : h >= 18 || h < 7 ? 0.2 : 0;
    const mood = this.cfg.worldState === 'struggling' ? 0.14 : 0;
    if (!zone.indoor && night + mood > 0) {
      this.add.rectangle(0, 0, W, H, night ? 0x1a1f4a : 0x3a3f5a, night + mood).setOrigin(0).setDepth(30_000);
      if (night && this.cfg.worldState !== 'struggling') {
        for (const p of zone.props.filter((q) => q.name === 'lamp_post_lit' || q.name.startsWith('campfire') || q.name === 'forge_lit')) {
          this.add.circle(p.x * T + T / 2, p.y * T - 10, 34, 0xffc46b, 0.22).setDepth(30_001).setBlendMode(Phaser.BlendModes.ADD);
        }
      }
    }

    // Camera.
    const cam = this.cameras.main;
    cam.setBackgroundColor(zone.indoor ? '#2a1d14' : '#1f3a1f');
    cam.setRoundPixels(true);
    const fit = () => {
      const zoom = Math.max(2, Math.min(5, Math.floor(Math.min(this.scale.width / (T * 11), this.scale.height / (T * 13)) || 3)));
      cam.setZoom(zoom);
      if (W * zoom <= this.scale.width && H * zoom <= this.scale.height) {
        cam.stopFollow();
        cam.removeBounds();
        cam.centerOn(W / 2, H / 2);
      } else {
        // Let the map scroll out from under the zone bar and the bottom buttons.
        const padTop = 120 / zoom;
        const padBottom = 96 / zoom;
        cam.setBounds(0, -padTop, W, H + padTop + padBottom);
        cam.startFollow(this.me.sprite, true, 0.18, 0.18);
      }
    };
    fit();
    this.scale.on('resize', fit);

    // Tap to move (and interact).
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.getDistance() > 12) return;
      const tx = Math.floor(p.worldX / T);
      const ty = Math.floor(p.worldY / T);
      const hit = this.interactables.find((i) => Math.abs(i.x - tx) <= 1 && ty >= i.y - 2 && ty <= i.y);
      if (hit) {
        const adj = [
          { x: hit.x, y: hit.y + 1 },
          { x: hit.x - 1, y: hit.y },
          { x: hit.x + 1, y: hit.y },
          { x: hit.x, y: hit.y - 1 },
        ]
          .filter((a) => this.blocked[a.y]?.[a.x] === false)
          .sort((a, b) => Math.abs(a.x - this.me.tile.x) + Math.abs(a.y - this.me.tile.y) - (Math.abs(b.x - this.me.tile.x) + Math.abs(b.y - this.me.tile.y)))[0];
        const near = Math.abs(this.me.tile.x - hit.x) + Math.abs(this.me.tile.y - hit.y) <= 1;
        const interact = () => {
          this.me.face(hit.y > this.me.tile.y ? 'down' : hit.y < this.me.tile.y ? 'up' : hit.x > this.me.tile.x ? 'right' : 'left');
          this.interact(hit.id, hit.label);
        };
        if (near || !adj) interact();
        else this.goTo(adj.x, adj.y, interact);
        return;
      }
      this.goTo(tx, ty);
    });
  }

  goTo(x: number, y: number, then?: () => void) {
    const from = this.me.moving ? this.me.heading : this.me.tile;
    const path = findPath(this.blocked, from, { x, y });
    if (!path.length) return;
    this.me.walk(path, then);
    this.cfg.onMove([[from.x, from.y], ...path.map((p) => [p.x, p.y] as [number, number])]);
  }

  interact(id: string, label?: string) {
    if (id.startsWith('npc:')) {
      const n = this.npcs.get(id.slice(4));
      if (n) {
        const line = n.npc.lines[Math.floor(Math.random() * n.npc.lines.length)]!;
        n.walker.say(line, 3400);
        const dx = this.me.tile.x - n.npc.x;
        const dy = this.me.tile.y - n.npc.y;
        n.walker.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      }
      return;
    }
    if (label) this.me.say(label, 3000);
    this.cfg.onInteract(id, label);
  }

  arrived(w: Walker) {
    if (w !== this.me) return;
    const exit = this.cfg.zone.exits.find((e) => e.x === w.tile.x && e.y === w.tile.y);
    if (exit) this.cfg.onExit(exit.to, exit.spawn);
  }

  /* ─── Networking hooks ─── */

  setPeers(peers: { id: string; name: string; look: unknown; x: number; y: number }[]) {
    const seen = new Set(peers.map((p) => p.id));
    for (const [id, w] of this.peers) if (!seen.has(id)) {
      w.destroy();
      this.peers.delete(id);
    }
    for (const p of peers) {
      if (this.peers.has(p.id)) continue;
      try {
        const key = this.characterTexture(p.look as PixelAppearance);
        this.peers.set(p.id, new Walker(this, key, p.x, p.y, p.name, '#bfe3ff'));
      } catch {
        /* malformed look from a peer: skip it */
      }
    }
  }

  peerMove(id: string, path: [number, number][]) {
    const w = this.peers.get(id);
    if (!w || !path.length) return;
    const [sx, sy] = path[0]!;
    if (Math.abs(sx - w.tile.x) + Math.abs(sy - w.tile.y) > 1) w.place(sx, sy);
    w.walk(path.slice(1).map(([x, y]) => ({ x, y })));
  }

  peerPlace(id: string, x: number, y: number) {
    this.peers.get(id)?.place(x, y);
  }

  peerSay(id: string, text: string) {
    this.peers.get(id)?.say(EMOTE_EMOJI[text] ?? text);
  }

  meSay(text: string) {
    this.me.say(EMOTE_EMOJI[text] ?? text);
    if (text === 'cheer') this.me.play('celebrate');
  }
}
