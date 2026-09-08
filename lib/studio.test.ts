import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initialSession,
  logDemoSet,
  demoCompletion,
  movements,
} from './studio.ts';
void test('Sample session requires exactly nine explicit sets and cannot over-complete', () => {
  let s = { ...initialSession, active: true };
  for (let i = 0; i < 8; i++) {
    s = logDemoSet(s);
    assert.equal(s.finished, false);
  }
  s = logDemoSet(s);
  assert.equal(s.finished, true);
  assert.equal(s.active, false);
  assert.equal(demoCompletion(s), 100);
  assert.deepEqual(logDemoSet(s), s);
  assert.deepEqual(logDemoSet(initialSession), initialSession);
});
void test('Exercise transition preserves completion and selects a supported movement', () => {
  let s = { ...initialSession, active: true };
  for (let i = 0; i < 9; i++) {
    const before = demoCompletion(s);
    s = logDemoSet(s);
    assert.ok(demoCompletion(s) > before);
    assert.ok(movements[s.exercise]);
    assert.ok(s.done >= 0 && s.done <= 3);
  }
});
void test('Human model contains skinned anatomy, all movement joints, and embedded images', () => {
  const bytes = readFileSync(new URL('../public/athlete.glb', import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  assert.ok(gltf.skins[0].joints.length >= 60);
  const names = gltf.nodes.map((n: { name: string }) => n.name);
  for (const joint of [
    'pelvis',
    'spine_03',
    'upperarm_l',
    'upperarm_r',
    'lowerarm_l',
    'lowerarm_r',
    'hand_l',
    'hand_r',
    'thigh_l',
    'thigh_r',
    'calf_l',
    'calf_r',
    'foot_l',
    'foot_r',
    'Head',
  ])
    assert.ok(names.includes(joint), joint);
  assert.ok(gltf.images.length >= 3);
  for (const image of gltf.images)
    assert.ok(image.bufferView !== undefined && !image.uri);
  assert.ok(names.includes('SuperHero_Male'));
});
