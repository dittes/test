import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/media-tools.js', import.meta.url), 'utf8');
const { mediaToolHelpers } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('rms computes a stable root-mean-square level', () => {
  assert.equal(mediaToolHelpers.rms(new Float32Array([0, 0, 0, 0])), 0);
  assert.ok(Math.abs(mediaToolHelpers.rms(new Float32Array([1, -1])) - 1) < 1e-9);
  assert.ok(Math.abs(mediaToolHelpers.rms(new Float32Array([0.5, -0.5])) - 0.5) < 1e-7);
});

test('dBFS conversion and formatting make zero input explicit', () => {
  assert.equal(mediaToolHelpers.dbfs(1), 0);
  assert.ok(Math.abs(mediaToolHelpers.dbfs(0.5) + 6.0206) < 0.001);
  assert.equal(mediaToolHelpers.formatDbfs(-Infinity), 'below −90 dBFS');
  assert.equal(mediaToolHelpers.formatDbfs(-12.4), '−12 dBFS');
});

test('media errors produce specific recovery guidance', () => {
  assert.match(mediaToolHelpers.errorMessage({ name: 'NotFoundError' }, 'camera'), /No camera was found/);
  assert.match(mediaToolHelpers.errorMessage({ name: 'NotReadableError' }, 'microphone'), /Another app/);
  assert.match(mediaToolHelpers.errorMessage({ name: 'NotAllowedError' }, 'camera'), /Permission/);
});

test('session guard rejects stale permission and teardown completions', () => {
  const stream = {};
  assert.equal(mediaToolHelpers.isCurrentSession(4, 4, stream, stream), true);
  assert.equal(mediaToolHelpers.isCurrentSession(4, 5, stream, stream), false);
  assert.equal(mediaToolHelpers.isCurrentSession(4, 4, {}, stream), false);
  assert.equal(mediaToolHelpers.isCurrentSession(4, 4, stream, stream, true), false);
});
