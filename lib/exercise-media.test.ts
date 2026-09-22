import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { exercises } from './fitness.ts';
const media = JSON.parse(readFileSync(new URL('./exercise-media.json', import.meta.url), 'utf8')) as Record<string, { images: string[] }>;
void test('available photo guides reference catalog exercises and local images', () => {
  for (const [name, guide] of Object.entries(media)) {
    assert.ok(exercises.some(exercise => exercise.name === name));
    assert.equal(guide.images.length, 2);
    for (const image of guide.images) assert.ok(existsSync(new URL('../public' + image, import.meta.url)), image);
  }
});
