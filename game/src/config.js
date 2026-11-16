// EMBERFALL tuning: every number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step, in seconds: 60 updates a second, whatever the display rate. */
export const STEP = 1 / 60;

export const SHIP = {
  width: 54,
  height: 42,
  speed: 620,
  minY: 480,
  maxY: 676,
  invulnerable: 2.0,
  fireInterval: 0.16,
  rapidInterval: 0.08,
  bulletSpeed: 780,
};

export const LIVES = 3;

/** Points are multiplied by the combo at the moment of the kill. */
export const ENEMY = {
  cinder: { hp: 1, speed: 150, speedJitter: 60, radius: 20, points: 50 },
  weaver: { hp: 1, speed: 190, speedJitter: 40, radius: 18, points: 80 },
  splitter: { hp: 2, speed: 120, speedJitter: 30, radius: 26, points: 120 },
  brute: { hp: 5, speed: 80, speedJitter: 15, radius: 38, points: 300 },
};

export const WAVE = {
  /** Enemies in wave n (before the mix caps it). */
  baseCount: 5,
  perWave: 3,
  maxCount: 34,
  /** Seconds between spawns at wave 1, shrinking each wave down to the floor. */
  interval: 1.05,
  intervalScale: 0.93,
  minInterval: 0.28,
  /** Bonus for clearing a wave, times the wave number. */
  clearBonus: 150,
};

export const SHARD = {
  radius: 11,
  speed: 150,
  points: 25,
  /** Seconds a shard stays on the field before fading. */
  lifetime: 9,
};

export const POWERUP = {
  radius: 15,
  speed: 130,
  /** Seconds each power-up lasts once collected. */
  duration: 10,
  /** Chance a brute drops one; other enemies rarely do. */
  bruteChance: 1.0,
  otherChance: 0.04,
};

export const COMBO = {
  /** Seconds between kills before the combo resets. */
  window: 2.5,
  max: 8,
};

/** How many of each pool exist at once; allocated once at boot, never grown. */
export const POOLS = { bullets: 96, enemies: 48, shards: 24, powerups: 6, particles: 256 };

export const PALETTE = {
  backdrop: '#0a0616',
  skyTop: '#160a2e',
  skyMid: '#1e0f3d',
  skyLow: '#3d1428',
  ember: '#ff9a3c',
  emberHot: '#ffd23c',
  emberDeep: '#ff5e3a',
  ship: '#7fe7ff',
  shipCore: '#e8fbff',
  bullet: '#ffe9a3',
  shard: '#ffd23c',
  cinder: '#ff6b4a',
  weaver: '#c86bff',
  splitter: '#ff4a8a',
  brute: '#ff2e63',
  powerSpread: '#4dff88',
  powerShield: '#4dc9ff',
  powerRapid: '#ffe14d',
  panel: '#1a1030',
  panelEdge: '#ff9a3c',
  text: '#fff3e0',
  muted: '#b9a8d8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';
