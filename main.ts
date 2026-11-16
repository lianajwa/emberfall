// EMBERFALL's entry program (Node 22, standard library only).
//
// The game is the static files under game/ in this directory: game/index.html
// and its ES modules, no library and no network request. This program hands
// the game in: it copies game/ and screenshots/ beside this file to /output
// and writes /output/dossier.json, the summary the judge reads, using the
// vendored make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Play it locally first: serve this directory (for example
// `python3 -m http.server 8080`) and open http://localhost:8080/game/.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory, then the two folders the scorer reads.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own limits (reference/gate.json): the text cap
// shapes the dossier's bytes; the rest refuse an entry the scorer would
// refuse (more than 4 screenshots or one over 256 KiB; game/ over 993 files
// or 48 MiB, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
