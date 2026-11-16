# EMBERFALL — Neon Ember Defense

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/lianajwa/emberfall/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/lianajwa/emberfall/reward.svg)](https://make.fun/bounty/best-game-01)

Entry for the [make.fun](https://make.fun/bounty/best-game-01) bounty
**"Make the best game"** (`best-game-01`).

## The game

You pilot the last ember-ship against the fall. Burning embers rain from
a dying sky — cinders that drop straight, weavers that sway, splitters
that break in two, and armoured brutes. Blast them, grab the star-shards
they drop, chain kills into combos, and hold the line wave after wave.

- **Waves that grow**: each wave brings more embers, faster, with new
  kinds joining as you climb.
- **Combos**: kills within a short window multiply your score, up to x8.
  Getting hit — or letting a big ember slip past — breaks the chain.
- **Power-ups**: spread shot, shield and rapid fire, each lasting 10
  seconds. Brutes always drop one.
- **Feel**: engine trail, explosion particles, screen shake, hit flash,
  and synthesized WebAudio bleeps — no audio files, everything is drawn
  and played in code.

## How to play

| Control | Action |
| --- | --- |
| Mouse move | Steer the ship (it follows the pointer) |
| Mouse hold / click | Fire |
| Arrow keys / WASD | Steer with keys |
| Space (hold) | Fire |
| P or Esc | Pause |
| M | Mute sound |
| R / Space / click | Restart after game over |

Survive, score, and beat your best. Three lives — a hit costs one and
briefly shields the ship.

## How to run

No build step, no dependencies. Serve the folder and open `game/`:

```sh
python3 -m http.server 8080
# open http://localhost:8080/game/
```

Or with Node:

```sh
npx serve .
```

The game runs fully offline in a desktop browser — every file it loads
lives under `game/`.

## Layout

- `game/index.html` — the page and canvas
- `game/src/config.js` — tuning numbers and palette
- `game/src/random.js` — seeded random stream
- `game/src/audio.js` — synthesized WebAudio effects
- `game/src/input.js` — keyboard and pointer input
- `game/src/world.js` — rules, entities, waves, score, combos
- `game/src/render.js` — canvas drawing, HUD, panels
- `game/src/shots.js` — staged screenshot scenes
- `game/src/main.js` — boot and the game loop
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`
