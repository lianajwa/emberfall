// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple pilot: chase the lowest enemy's column, fire the whole time, dodge
// by sliding away from anything about to land on the ship. The end scene's
// pilot looks only a moment ahead, so it banks a real score and is still
// caught out once the embers speed up, the way a hurried player is. Same
// seed, same frame, every time.

import { FIELD, SHIP, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Seconds until staying still (or sliding one way) runs into an enemy. */
function dangerAt(state, x, horizon) {
  const ship = state.ship;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    for (const e of state.enemies) {
      if (!e.active) continue;
      const ey = e.y + e.vy * t;
      const ex = e.kind === 1 ? e.baseX + Math.sin(e.phase + t * 3) * 90 : e.x;
      if (ey + e.radius > ship.y - 20 && ey - e.radius < ship.y + 20
        && ex + e.radius > x - 24 && ex - e.radius < x + 24) return t;
    }
  }
  return Infinity;
}

/**
 * Steer toward the lowest enemy while keeping clear. `horizon` is how far
 * ahead the pilot looks: long for the play scene, short for the end scene.
 */
function pilot(state, horizon) {
  const ship = state.ship;
  let target = null;
  for (const e of state.enemies) {
    if (!e.active) continue;
    if (target === null || e.y > target.y) target = e;
  }
  const wantX = target === null ? FIELD.width / 2 : target.x;
  const centre = ship.x;
  const wanted = wantX > centre + 10 ? 1 : wantX < centre - 10 ? -1 : 0;
  const candidates = [wanted, 0, -1, 1];
  let best = wanted;
  let bestTime = dangerAt(state, ship.x + wanted * SHIP.speed * horizon, horizon);
  for (const direction of candidates) {
    const time = dangerAt(state, ship.x + direction * SHIP.speed * horizon, horizon);
    if (time > bestTime) {
      bestTime = time;
      best = direction;
    }
  }
  return { x: best, y: 0 };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, null, false, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  // The end pilot plays like the play pilot but looks only a moment ahead,
  // so it scores a real run and is still caught out once the embers speed
  // up, the way a hurried player is.
  const horizon = name === 'end' ? 0.35 : 0.8;
  for (let i = 0; i < limit / STEP; i += 1) {
    const move = pilot(world.state, horizon);
    const events = world.step(STEP, move, null, true, false);
    if (events & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
