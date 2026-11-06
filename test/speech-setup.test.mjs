// speech-setup refuses an unknown model before downloading and leaves no .partial file behind (#25).
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-edit-speech-setup-'));
process.env.GAME_TRAILER_STUDIO_DATA_ROOT = root;
// A stand-in whisper CLI, so setupSpeech goes straight to the model download.
const cli = path.join(root, 'whisper-cli');
await fs.writeFile(cli, '');
process.env.WHISPER_CPP_PATH = cli;
const { setupSpeech, MODEL_NAME, MODEL_ORDER, WHISPER_ROOT } = await import('../src/transcribe.mjs');

test('an unknown model name is refused before anything is downloaded', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('should not be called'); };
  await assert.rejects(() => setupSpeech({ model: 'smal', fetchImpl }), err => err.code === 'INVALID_MODEL' && /tiny, base, small/.test(err.message));
  assert.equal(calls, 0);
});

test('every model the app ranks, and the quantized names, are accepted', () => {
  for (const name of [...MODEL_ORDER, 'tiny-q5_1', 'small.en-q8_0']) assert.ok(MODEL_NAME.test(name), name);
  for (const name of ['smal', 'base.', 'large-v4', '../base']) assert.ok(!MODEL_NAME.test(name), name);
});

test('a download that fails part-way leaves no .partial file', async () => {
  const body = (async function* () { yield Buffer.from('some bytes'); throw new Error('connection reset'); })();
  const fetchImpl = async () => ({ ok: true, status: 200, body, headers: new Headers() });
  await assert.rejects(() => setupSpeech({ model: 'base', fetchImpl }), /connection reset/);
  const files = await fs.readdir(path.join(WHISPER_ROOT, 'models'));
  assert.deepEqual(files.filter(f => f.endsWith('.partial')), []);
});