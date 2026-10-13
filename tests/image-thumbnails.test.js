import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import Jimp from 'jimp';
import { createImageThumbnailsRouter } from '../server/imageThumbnails.js';
import { thumbnailUrl, thumbnailSrcset } from '../src/imageUrls.js';

test('responsive URLs only address supported local uploads', () => {
  const image = '/products/upload_abc123_1780000000000.jpeg';
  assert.equal(thumbnailUrl(image, 320), `${image}?w=320`);
  assert.equal(thumbnailSrcset(image).split(', ').length, 3);
  for (const url of ['https://example.com/photo.jpg', '/products/icon.svg', '/logo2.png', '/products/../upload_a_1.png']) {
    assert.equal(thumbnailUrl(url, 320), url);
    assert.equal(thumbnailSrcset(url), undefined);
  }
});

test('thumbnails shrink photos, preserve originals and cache concurrent requests', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'pakera-thumbnails-'));
  const filename = 'upload_test123_1780000000000.jpeg';
  const source = join(dir, filename);
  const image = new Jimp(1200, 600);
  for (let i = 0; i < image.bitmap.data.length; i += 4) {
    image.bitmap.data[i] = (i * 13) % 255;
    image.bitmap.data[i + 1] = (i * 17) % 255;
    image.bitmap.data[i + 2] = (i * 23) % 255;
    image.bitmap.data[i + 3] = 255;
  }
  await image.quality(95).writeAsync(source);
  const original = await readFile(source);
  const app = express();
  app.use('/products', createImageThumbnailsRouter(dir));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/products/`;
  const results = await Promise.all(Array.from({ length: 4 }, async () => {
    const response = await fetch(`${base}${filename}?w=320`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /max-age=31536000.*immutable/);
    return Buffer.from(await response.arrayBuffer());
  }));
  for (const result of results) assert.deepEqual(result, results[0]);
  const small = await Jimp.read(results[0]);
  assert.equal(small.bitmap.width, 320);
  assert.equal(small.bitmap.height, 160);
  assert.ok(results[0].length < original.length / 2);
  assert.deepEqual(await readFile(source), original);
  const cached = join(dir, '.thumbnails', `320-${filename}`);
  const before = (await stat(cached)).mtimeMs;
  await (await fetch(`${base}${filename}?w=320`)).arrayBuffer();
  assert.equal((await stat(cached)).mtimeMs, before);
  assert.equal((await fetch(`${base}${filename}?w=10000`)).status, 400);
  assert.equal((await fetch(`${base}missing.jpeg?w=320`)).status, 400);
  assert.equal((await fetch(`${base}upload_absent_1.jpeg?w=320`)).status, 404);
  const pngName = 'upload_alpha_1780000000000.png';
  await new Jimp(100, 50, 0x11223300).writeAsync(join(dir, pngName));
  const png = await fetch(`${base}${pngName}?w=320`);
  const alpha = await Jimp.read(Buffer.from(await png.arrayBuffer()));
  assert.equal(alpha.bitmap.width, 100);
  assert.equal(alpha.bitmap.data[3], 0);
});
