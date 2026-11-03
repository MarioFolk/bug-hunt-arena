import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const questions = require('../netlify/lib/question-bank.cjs');
const required = [
  'public/index.html', 'public/app.js', 'public/style.css',
  'netlify/functions/game.ts', 'netlify/lib/game-engine.mjs',
  'netlify/lib/question-bank.cjs', 'netlify.toml', 'package-lock.json'
];
for (const file of required) {
  if (!existsSync(file)) throw new Error(`Missing required project file: ${file}`);
}
if (questions.length !== 100) throw new Error(`Expected 100 questions; found ${questions.length}`);
const html = await readFile('public/index.html', 'utf8');
const app = await readFile('public/app.js', 'utf8');
const fn = await readFile('netlify/functions/game.ts', 'utf8');
if (html.includes('/socket.io/socket.io.js') || app.includes('io()') || app.includes('socket.emit')) {
  throw new Error('Legacy Socket.IO client reference remains.');
}
if (!app.includes("'/.netlify/functions/game'") || !fn.includes("getStore(STORE_NAME)")) {
  throw new Error('The frontend-to-function route or Blobs store is missing.');
}
const syntax = spawnSync(process.execPath, ['--check', 'public/app.js'], { encoding: 'utf8' });
if (syntax.status !== 0) throw new Error(syntax.stderr || 'Frontend syntax check failed.');
const engine = spawnSync(process.execPath, ['--check', 'netlify/lib/game-engine.mjs'], { encoding: 'utf8' });
if (engine.status !== 0) throw new Error(engine.stderr || 'Game engine syntax check failed.');
console.log(`Build checks passed: ${questions.length} questions, static frontend, direct Netlify Function route.`);
