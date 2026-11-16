// The game's rules and state, with no drawing and no browser in it: the ember
// ship, bullets, falling enemies, shards, power-ups and particles, waves,
// collisions, score, combo and lives. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sounds, shake,
// announcements) without the world knowing about screens or sound.
// Nothing here allocates after createWorld returns: every pool is fixed.

import {
  COMBO, ENEMY, FIELD, LIVES, POOLS, POWERUP, SHARD, SHIP, WAVE,
} from './config.js';
import { pickWeighted } from './random.js';

export const KIND_CINDER = 0;
export const KIND_WEAVER = 1;
export const KIND_SPLITTER = 2;
export const KIND_BRUTE = 3;

export const POWER_SPREAD = 0;
export const POWER_SHIELD = 1;
export const POWER_RAPID = 2;

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_SHARD = 4;
export const EVENT_POWERUP = 8;
export const EVENT_WAVE = 16;
export const EVENT_OVER = 32;

function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy < reach * reach;
}

function waveMix(wave) {
  // Early waves are cinders; weavers join at wave 2, splitters at 3, brutes at 4.
  const table = [[10, KIND_CINDER]];
  if (wave >= 2) table.push([4 + wave, KIND_WEAVER]);
  if (wave >= 3) table.push([3 + wave, KIND_SPLITTER]);
  if (wave >= 4) table.push([1 + Math.floor(wave / 2), KIND_BRUTE]);
  return table;
}

export function createWorld(random) {
  const ship = {
    x: FIELD.width / 2, y: SHIP.maxY - 40,
    invulnerable: 0, fireTimer: 0,
    spread: 0, shield: 0, rapid: 0,
  };
  const bullets = [];
  for (let i = 0; i < POOLS.bullets; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  }
  const enemies = [];
  for (let i = 0; i < POOLS.enemies; i += 1) {
    enemies.push({
      active: false, kind: KIND_CINDER, x: 0, y: 0, vx: 0, vy: 0,
      hp: 1, maxHp: 1, radius: 20, phase: 0, baseX: 0, split: false,
    });
  }
  const shards = [];
  for (let i = 0; i < POOLS.shards; i += 1) {
    shards.push({ active: false, x: 0, y: 0, vy: 0, life: 0 });
  }
  const powerups = [];
  for (let i = 0; i < POOLS.powerups; i += 1) {
    powerups.push({ active: false, kind: POWER_SPREAD, x: 0, y: 0, vy: 0 });
  }
  const particles = [];
  for (let i = 0; i < POOLS.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }

  const state = {
    ship, bullets, enemies, shards, powerups, particles,
    score: 0, lives: LIVES, wave: 1,
    spawned: 0, toSpawn: 0, spawnTimer: 0,
    combo: 0, comboTimer: 0, bestCombo: 0,
    kills: 0, elapsed: 0, shake: 0, flash: 0,
    waveBanner: 0, bannerText: '', leaksInWave: 0,
  };

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  /** First inactive slot that is not `except` (so a splitter never reuses itself). */
  function freeExcept(pool, except) {
    for (let i = 0; i < pool.length; i += 1) {
      if (!pool[i].active && pool[i] !== except) return pool[i];
    }
    return null;
  }

  function burst(x, y, count, color, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v - 40;
      p.maxLife = 0.35 + random() * 0.45;
      p.life = p.maxLife;
      p.size = 2 + random() * 4;
      p.color = color;
    }
  }

  function beginWave(wave) {
    state.wave = wave;
    state.spawned = 0;
    state.toSpawn = Math.min(WAVE.maxCount, WAVE.baseCount + WAVE.perWave * (wave - 1));
    state.spawnTimer = 0.6;
    state.waveBanner = 2.2;
    state.bannerText = `WAVE ${wave}`;
    state.leaksInWave = 0;
  }

  function spawnEnemy() {
    const e = free(enemies);
    if (e === null) return;
    const kind = pickWeighted(random, waveMix(state.wave));
    const spec = [ENEMY.cinder, ENEMY.weaver, ENEMY.splitter, ENEMY.brute][kind];
    e.active = true;
    e.kind = kind;
    e.hp = spec.hp;
    e.maxHp = spec.hp;
    e.radius = spec.radius;
    e.x = 40 + random() * (FIELD.width - 80);
    e.baseX = e.x;
    e.y = -spec.radius - 10;
    // Early waves fall slower, so a new pilot has time to learn the ropes.
    const wavePace = Math.min(1, 0.8 + (state.wave - 1) * 0.1);
    e.vy = (spec.speed + spec.speedJitter * random() + (state.wave - 1) * 8) * wavePace;
    e.vx = kind === KIND_WEAVER ? 90 + random() * 60 : 0;
    e.phase = random() * Math.PI * 2;
    e.split = false;
    state.spawned += 1;
  }

  function spawnShard(x, y) {
    const s = free(shards);
    if (s === null) return;
    s.active = true;
    s.x = x;
    s.y = y;
    s.vy = SHARD.speed;
    s.life = SHARD.lifetime;
  }

  function spawnPowerup(x, y) {
    const p = free(powerups);
    if (p === null) return;
    p.active = true;
    p.kind = Math.floor(random() * 3);
    p.x = x;
    p.y = y;
    p.vy = POWERUP.speed;
  }

  function fireBullet(x, y, vx, vy) {
    const b = free(bullets);
    if (b === null) return;
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
  }

  function shipFire() {
    const noseY = ship.y - SHIP.height / 2;
    if (ship.spread > 0) {
      fireBullet(ship.x - 14, noseY, -160, -SHIP.bulletSpeed);
      fireBullet(ship.x, noseY - 6, 0, -SHIP.bulletSpeed);
      fireBullet(ship.x + 14, noseY, 160, -SHIP.bulletSpeed);
    } else {
      fireBullet(ship.x - 7, noseY, 0, -SHIP.bulletSpeed);
      fireBullet(ship.x + 7, noseY, 0, -SHIP.bulletSpeed);
    }
  }

  function killEnemy(e, awardPoints) {
    e.active = false;
    state.kills += 1;
    if (awardPoints) {
      state.combo = Math.min(COMBO.max, state.combo + 1);
      state.comboTimer = COMBO.window;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      const spec = [ENEMY.cinder, ENEMY.weaver, ENEMY.splitter, ENEMY.brute][e.kind];
      state.score += spec.points * state.combo;
    }
    const color = ['#ff6b4a', '#c86bff', '#ff4a8a', '#ff2e63'][e.kind];
    burst(e.x, e.y, e.kind === KIND_BRUTE ? 26 : 14, color, 260);
    if (e.kind === KIND_SPLITTER && !e.split) {
      for (const side of [-1, 1]) {
        const child = freeExcept(enemies, e);
        if (child === null) break;
        child.active = true;
        child.kind = KIND_CINDER;
        child.hp = 1;
        child.maxHp = 1;
        child.radius = ENEMY.cinder.radius;
        child.x = e.x + side * 30;
        child.baseX = child.x;
        child.y = e.y;
        child.vy = ENEMY.cinder.speed + 40;
        child.vx = 0;
        child.phase = 0;
        child.split = true;
      }
    }
    if (e.kind === KIND_BRUTE) {
      spawnPowerup(e.x, e.y);
      spawnShard(e.x - 24, e.y);
      spawnShard(e.x + 24, e.y);
    } else if (random() < POWERUP.otherChance) {
      spawnPowerup(e.x, e.y);
    } else if (random() < 0.3) {
      spawnShard(e.x, e.y);
    }
  }

  function reset() {
    ship.x = FIELD.width / 2;
    ship.y = SHIP.maxY - 40;
    ship.invulnerable = 0;
    ship.fireTimer = 0;
    ship.spread = 0;
    ship.shield = 0;
    ship.rapid = 0;
    for (const b of bullets) b.active = false;
    for (const e of enemies) e.active = false;
    for (const s of shards) s.active = false;
    for (const p of powerups) p.active = false;
    for (const p of particles) p.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.kills = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.flash = 0;
    state.waveBanner = 0;
    state.bannerText = '';
    beginWave(1);
  }

  /**
   * One fixed step. `move` is {x, y} from keys (-1/0/1); `pointer` is a field
   * point the ship chases, or null; `firing` holds the trigger. With
   * `ambient` set (the title screen's backdrop) embers drift and fade but
   * nothing shoots, scores or dies.
   */
  function step(dt, move, pointer, firing, ambient) {
    let events = 0;
    state.elapsed += dt;
    if (state.waveBanner > 0) state.waveBanner -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 3);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.5);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // Ship steering: pointer wins when the mouse is over the field, else keys.
    if (!ambient) {
      if (pointer !== null) {
        const dx = pointer.x - ship.x;
        const dy = pointer.y - ship.y;
        const dist = Math.hypot(dx, dy);
        const maxStep = SHIP.speed * dt;
        if (dist > 2) {
          const stepLen = Math.min(dist, maxStep);
          ship.x += (dx / dist) * stepLen;
          ship.y += (dy / dist) * stepLen;
        }
      } else {
        ship.x += move.x * SHIP.speed * dt;
        ship.y += move.y * SHIP.speed * dt;
      }
      ship.x = Math.min(FIELD.width - SHIP.width / 2, Math.max(SHIP.width / 2, ship.x));
      ship.y = Math.min(SHIP.maxY, Math.max(SHIP.minY, ship.y));
      if (ship.invulnerable > 0) ship.invulnerable = Math.max(0, ship.invulnerable - dt);
      if (ship.spread > 0) ship.spread -= dt;
      if (ship.shield > 0) ship.shield -= dt;
      if (ship.rapid > 0) ship.rapid -= dt;
      ship.fireTimer -= dt;
      if (firing && ship.fireTimer <= 0) {
        shipFire();
        ship.fireTimer = ship.rapid > 0 ? SHIP.rapidInterval : SHIP.fireInterval;
      }
      // Engine trail.
      const trail = free(particles);
      if (trail !== null) {
        trail.active = true;
        trail.x = ship.x + (random() - 0.5) * 16;
        trail.y = ship.y + SHIP.height / 2;
        trail.vx = (random() - 0.5) * 30;
        trail.vy = 120 + random() * 60;
        trail.maxLife = 0.3;
        trail.life = 0.3;
        trail.size = 2 + random() * 3;
        trail.color = random() < 0.5 ? '#ff9a3c' : '#ffd23c';
      }
    }

    // Waves: keep spawning until the wave's count is out, then wait for the
    // field to clear before the next wave.
    if (!ambient) {
      if (state.spawned < state.toSpawn) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnEnemy();
          const interval = Math.max(
            WAVE.minInterval,
            WAVE.interval * WAVE.intervalScale ** (state.wave - 1),
          );
          state.spawnTimer += interval;
        }
      } else if (!enemies.some((e) => e.active)) {
        state.score += WAVE.clearBonus * state.wave;
        events |= EVENT_WAVE;
        beginWave(state.wave + 1);
      }
    } else if (random() < dt * 2) {
      // Ambient embers on the title screen.
      spawnEnemy();
    }

    // Bullets.
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -20 || b.x < -20 || b.x > FIELD.width + 20) b.active = false;
    }

    // Enemies: drift, weave, fall off the bottom. One that slips past the
    // ground line burns the ship's hull: a life lost, the combo broken.
    // At most one leak per step, so a bad moment cannot end the run at once.
    // Wave 1 is a learning wave: leaks there sting (combo lost, shake) but
    // cost no life. From wave 2, the hull holds once per wave, then leaks
    // cost a life — so a new pilot is not punished for a slip while learning.
    let leaked = false;
    for (const e of enemies) {
      if (!e.active) continue;
      e.phase += dt * 3;
      if (e.kind === KIND_WEAVER) e.x = e.baseX + Math.sin(e.phase) * 90;
      e.y += e.vy * dt;
      if (e.y > FIELD.height + 60) {
        e.active = false;
        if (!ambient && !leaked) {
          leaked = true;
          state.combo = 0;
          state.comboTimer = 0;
          state.leaksInWave += 1;
          state.shake = 1;
          const costsLife = state.wave >= 2 && state.leaksInWave > 1;
          if (costsLife) {
            state.lives -= 1;
            state.flash = 0.8;
            ship.invulnerable = Math.max(ship.invulnerable, SHIP.invulnerable);
            if (state.lives <= 0) {
              events |= EVENT_OVER;
              burst(ship.x, ship.y, 40, '#7fe7ff', 380);
              burst(ship.x, ship.y, 24, '#ff9a3c', 320);
            }
          }
          events |= EVENT_HIT;
        }
      }
    }

    // Bullet vs enemy.
    for (const b of bullets) {
      if (!b.active) continue;
      for (const e of enemies) {
        if (!e.active) continue;
        if (!circleHit(b.x, b.y, 5, e.x, e.y, e.radius)) continue;
        b.active = false;
        e.hp -= 1;
        burst(b.x, b.y, 4, '#ffe9a3', 140);
        if (e.hp <= 0) {
          killEnemy(e, !ambient);
          events |= EVENT_KILL;
        }
        break;
      }
    }

    // Enemy vs ship, shards, power-ups.
    if (!ambient) {
      const shipRadius = 20;
      for (const e of enemies) {
        if (!e.active) continue;
        if (!circleHit(e.x, e.y, e.radius - 4, ship.x, ship.y, shipRadius)) continue;
        if (ship.shield > 0) {
          killEnemy(e, true);
          events |= EVENT_KILL;
          state.shake = 0.5;
          continue;
        }
        if (ship.invulnerable > 0) continue;
        e.active = false;
        burst(e.x, e.y, 18, '#ff6b4a', 300);
        state.lives -= 1;
        state.combo = 0;
        state.comboTimer = 0;
        state.shake = 1;
        state.flash = 0.8;
        ship.invulnerable = SHIP.invulnerable;
        events |= EVENT_HIT;
        if (state.lives <= 0) {
          events |= EVENT_OVER;
          burst(ship.x, ship.y, 40, '#7fe7ff', 380);
          burst(ship.x, ship.y, 24, '#ff9a3c', 320);
        }
        break;
      }
      for (const s of shards) {
        if (!s.active) continue;
        if (circleHit(s.x, s.y, SHARD.radius, ship.x, ship.y, shipRadius + 8)) {
          s.active = false;
          state.score += SHARD.points * Math.max(1, state.combo);
          events |= EVENT_SHARD;
        }
      }
      for (const p of powerups) {
        if (!p.active) continue;
        if (!circleHit(p.x, p.y, POWERUP.radius, ship.x, ship.y, shipRadius + 8)) continue;
        p.active = false;
        if (p.kind === POWER_SPREAD) ship.spread = POWERUP.duration;
        else if (p.kind === POWER_SHIELD) ship.shield = POWERUP.duration;
        else ship.rapid = POWERUP.duration;
        events |= EVENT_POWERUP;
      }
    }

    // Shards and power-ups drift down and expire.
    for (const s of shards) {
      if (!s.active) continue;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.y > FIELD.height + 20 || s.life <= 0) s.active = false;
    }
    for (const p of powerups) {
      if (!p.active) continue;
      p.y += p.vy * dt;
      if (p.y > FIELD.height + 20) p.active = false;
    }

    // Particles fade and fall.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
