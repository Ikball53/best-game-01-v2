// TRENCHLIGHT — main.ts
// The entrypoint for the make.fun best-game-01 bounty.
// It gathers game/ and screenshots/ from this repository, copies them into
// the output directory, and writes the dossier the judge reads.
//
// Usage (Node 22, standard library only):
//   MAKEFUN_OUTPUT_DIR=/tmp/out node --experimental-strip-types main.ts
// With no MAKEFUN_OUTPUT_DIR set, /output is used.

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here);
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648
};

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  const dst = join(outDir, name);
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true, dereference: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

const dossier = buildDossier(outDir, dossierCaps);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameFiles = ['index.html', 'style.css', 'audio.js', 'world.js', 'warden.js', 'render.js', 'input.js', 'main.js'];
const shotFiles = readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.'));
console.log('TRENCHLIGHT packaged into ' + outDir);
console.log('game files: ' + gameFiles.length + ' (see game/)');
console.log('screenshots: ' + shotFiles.length + ' (' + shotFiles.join(', ') + ')');
console.log('dossier bytes: ' + dossier.length);
