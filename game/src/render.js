// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Neon glow is faked with layered shapes and
// additive-ish alpha, never with shadowBlur (too slow at 60 fps). Text that
// holds a number is rebuilt only when the number changes, so a frame
// allocates nothing.

import { FIELD, FONT, LIVES, PALETTE, POWERUP, SHARD } from './config.js';
import {
  KIND_BRUTE, KIND_CINDER, KIND_SPLITTER, KIND_WEAVER,
  POWER_RAPID, POWER_SHIELD, POWER_SPREAD,
} from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 720, top: 150, line: 34, bottom: 76 };
const HEART_SIZE = 22;
const HEART_GAP = 8;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const comboLabel = cachedLabel('x');
  const finalLabel = cachedLabel('FINAL SCORE ');
  const bestLabel = cachedLabel('BEST ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function disc(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawSky(elapsed) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Slow drifting stars, fixed by the clock so the title never flickers.
    for (let i = 0; i < 70; i += 1) {
      const sx = (i * 173 + 41) % FIELD.width;
      const sy = ((i * 97 + 13) % 480) + ((elapsed * (6 + (i % 5))) % 480);
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(elapsed * 1.4 + i));
      context.globalAlpha = twinkle * 0.8;
      context.fillStyle = i % 4 === 0 ? PALETTE.emberHot : '#ffffff';
      context.fillRect(sx, sy % 480, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
    }
    context.globalAlpha = 1;
    // A dim ember moon in the corner.
    disc(1120, 110, 46, '#3a1c4d');
    disc(1120, 110, 38, '#ff9a3c');
    disc(1108, 98, 8, '#e07f2e');
    disc(1134, 122, 11, '#e07f2e');
  }

  function drawEnemy(e) {
    const { x, y } = e;
    if (e.kind === KIND_CINDER) {
      // A burning coal: dark rock with a hot core.
      disc(x, y, e.radius + 5, 'rgba(255, 107, 74, 0.25)');
      disc(x, y, e.radius, '#5a1f16');
      disc(x, y, e.radius - 7, PALETTE.cinder);
      disc(x - 5, y - 5, 6, PALETTE.emberHot);
    } else if (e.kind === KIND_WEAVER) {
      disc(x, y, e.radius + 5, 'rgba(200, 107, 255, 0.25)');
      context.fillStyle = PALETTE.weaver;
      context.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const px = x + Math.cos(angle) * e.radius;
        const py = y + Math.sin(angle) * e.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      disc(x, y, 6, '#ffffff');
    } else if (e.kind === KIND_SPLITTER) {
      disc(x, y, e.radius + 6, 'rgba(255, 74, 138, 0.25)');
      disc(x, y, e.radius, PALETTE.splitter);
      disc(x - 9, y - 4, 8, '#ff8ab5');
      disc(x + 9, y + 5, 8, '#ff8ab5');
      disc(x, y, 5, '#ffffff');
    } else {
      // Brute: big armoured ember with a health ring.
      disc(x, y, e.radius + 8, 'rgba(255, 46, 99, 0.25)');
      disc(x, y, e.radius, '#4d0f24');
      disc(x, y, e.radius - 6, PALETTE.brute);
      context.fillStyle = '#ffd23c';
      context.fillRect(x - e.radius + 8, y - 6, (e.radius * 2 - 16) * (e.hp / e.maxHp), 12);
      disc(x - 12, y - 12, 5, '#ffffff');
      disc(x + 12, y - 12, 5, '#ffffff');
    }
  }

  function drawShip(state) {
    const ship = state.ship;
    // Blink while invulnerable after a hit.
    if (ship.invulnerable > 0 && Math.floor(ship.invulnerable * 10) % 2 === 0) return;
    const { x, y } = ship;
    // Shield bubble.
    if (ship.shield > 0) {
      context.globalAlpha = 0.35 + 0.15 * Math.sin(state.elapsed * 6);
      disc(x, y, 42, 'rgba(77, 201, 255, 0.35)');
      context.globalAlpha = 1;
      context.strokeStyle = PALETTE.powerShield;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, 42, 0, Math.PI * 2);
      context.stroke();
    }
    // Flame under the ship.
    const flicker = 10 + Math.sin(state.elapsed * 30) * 4;
    context.fillStyle = PALETTE.ember;
    context.beginPath();
    context.moveTo(x - 8, y + 18);
    context.lineTo(x + 8, y + 18);
    context.lineTo(x, y + 18 + flicker + 14);
    context.closePath();
    context.fill();
    // Hull: a swept dart with a glowing core.
    context.fillStyle = PALETTE.ship;
    context.beginPath();
    context.moveTo(x, y - 22);
    context.lineTo(x + 20, y + 16);
    context.lineTo(x + 8, y + 10);
    context.lineTo(x - 8, y + 10);
    context.lineTo(x - 20, y + 16);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.shipCore;
    context.beginPath();
    context.moveTo(x, y - 14);
    context.lineTo(x + 7, y + 8);
    context.lineTo(x - 7, y + 8);
    context.closePath();
    context.fill();
    disc(x, y - 2, 4, '#ffffff');
  }

  function drawField(state) {
    drawSky(state.elapsed);
    const ship = state.ship;
    // Bullets: bright dashes with a hot head.
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.strokeStyle = PALETTE.bullet;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(b.x, b.y + 12);
      context.lineTo(b.x, b.y - 6);
      context.stroke();
      disc(b.x, b.y - 6, 3, '#ffffff');
    }
    for (const e of state.enemies) {
      if (e.active) drawEnemy(e);
    }
    // Star shards: spinning diamonds.
    for (const s of state.shards) {
      if (!s.active) continue;
      const blink = 0.6 + 0.4 * Math.sin(state.elapsed * 8 + s.x);
      context.globalAlpha = Math.min(1, s.life) * blink;
      context.fillStyle = PALETTE.shard;
      context.beginPath();
      context.moveTo(s.x, s.y - SHARD.radius);
      context.lineTo(s.x + SHARD.radius, s.y);
      context.lineTo(s.x, s.y + SHARD.radius);
      context.lineTo(s.x - SHARD.radius, s.y);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    }
    // Power-ups: ringed orbs, colour and letter tell the kind.
    for (const p of state.powerups) {
      if (!p.active) continue;
      const kind = p.kind === POWER_SPREAD
        ? { color: PALETTE.powerSpread, letter: 'S' }
        : p.kind === POWER_SHIELD
          ? { color: PALETTE.powerShield, letter: 'H' }
          : { color: PALETTE.powerRapid, letter: 'R' };
      disc(p.x, p.y, 17, 'rgba(255,255,255,0.15)');
      disc(p.x, p.y, 14, kind.color);
      text(kind.letter, p.x, p.y + 6, 16, '#0a0616', 'center');
    }
    // Particles.
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      disc(p.x, p.y, p.size, p.color);
    }
    context.globalAlpha = 1;
    drawShip(state);
    // Hit flash: a red veil that fades fast.
    if (state.flash > 0) {
      context.globalAlpha = state.flash * 0.35;
      context.fillStyle = '#ff2e4d';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.globalAlpha = 1;
    }
  }

  function drawHud(state, best) {
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left', 'top');
    text(waveLabel(state.wave), FIELD.width / 2, 18, 30, PALETTE.text, 'center', 'top');
    // Lives as hearts, top right.
    const firstHeart = FIELD.width - 24 - LIVES * (HEART_SIZE + HEART_GAP) + HEART_GAP;
    for (let life = 0; life < LIVES; life += 1) {
      const hx = firstHeart + life * (HEART_SIZE + HEART_GAP);
      const hy = 26;
      context.fillStyle = life < state.lives ? '#ff4a6b' : '#3a2b52';
      context.beginPath();
      context.moveTo(hx + 11, hy + 18);
      context.bezierCurveTo(hx - 2, hy + 8, hx + 2, hy - 2, hx + 11, hy + 4);
      context.bezierCurveTo(hx + 20, hy - 2, hx + 24, hy + 8, hx + 11, hy + 18);
      context.fill();
    }
    // Combo meter under the score.
    if (state.combo > 1) {
      const width = 150 * (state.comboTimer / 2.5);
      context.fillStyle = '#3a2b52';
      context.fillRect(24, 58, 150, 8);
      context.fillStyle = PALETTE.emberHot;
      context.fillRect(24, 58, Math.max(0, width), 8);
      text(comboLabel(state.combo), 184, 52, 24, PALETTE.emberHot, 'left', 'top');
      text('COMBO', 24, 72, 14, PALETTE.muted, 'left', 'top');
    }
    // Active power-up timers, bottom left.
    let slot = 0;
    const timers = [
      { left: state.ship.spread, label: 'SPREAD', color: PALETTE.powerSpread },
      { left: state.ship.shield, label: 'SHIELD', color: PALETTE.powerShield },
      { left: state.ship.rapid, label: 'RAPID', color: PALETTE.powerRapid },
    ];
    for (const timer of timers) {
      if (timer.left <= 0) continue;
      const y = FIELD.height - 34 - slot * 26;
      context.fillStyle = timer.color;
      context.fillRect(24, y, 120 * (timer.left / POWERUP.duration), 8);
      text(`${timer.label} ${Math.ceil(timer.left)}s`, 152, y - 4, 16, timer.color, 'left', 'top');
      slot += 1;
    }
    // Wave banner.
    if (state.waveBanner > 0) {
      context.globalAlpha = Math.min(1, state.waveBanner);
      text(state.bannerText, FIELD.width / 2, 200, 64, PALETTE.emberHot, 'center');
      context.globalAlpha = 1;
    }
    if (best > 0) text(bestLabel(best), FIELD.width - 24, 58, 18, PALETTE.muted, 'right', 'top');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 6, 22, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 82, 52, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.emberHot, 'center');
  }

  const TITLE_LINES = [
    'Pilot the last ember-ship. Hold the line against the fall.',
    'Move: mouse or arrows / WASD. Fire: hold click or Space.',
    'Blast embers, grab star-shards, chain kills for combos.',
    'S spread, H shield, R rapid fire — P pause, M mute.',
    '',
  ];
  const PAUSED_LINES = ['The embers will wait for you.'];
  const OVER_LINES = ['', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake: offset the whole field while it lasts.
    const shake = state.shake;
    const ox = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0;
    const oy = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + ox * view.scale, view.y + oy * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = best > 0 ? bestLabel(best) : 'No flights logged yet — make the first one count.';
      drawPanel('EMBERFALL', TITLE_LINES, 'Click or press Space to launch');
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = `WAVES CLEARED ${Math.max(0, state.wave - 1)}   •   KILLS ${state.kills}   •   BEST COMBO x${state.bestCombo}`;
      OVER_LINES[2] = bestLabel(best);
      drawPanel('The ember fades…', OVER_LINES, 'Press Space or click to fly again', '#ff2e63');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
