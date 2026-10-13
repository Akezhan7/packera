import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as gallery from '../shared/productImages.js';

const product = {
  image: 'cover.jpg', images: ['specs.jpg', 'cover.jpg', 'use.jpg'],
  sizes: [
    { size: 'S', image: 'small.jpg', images: ['small-detail.jpg', 'small.jpg'] },
    { size: 'L', image: 'large.jpg', images: ['large-detail.jpg'] },
    { size: 'XL', image: '', images: [] },
  ],
};

test('initial gallery starts with the cover and excludes variant images', () => {
  assert.deepEqual(gallery.getProductImages(product), ['cover.jpg', 'specs.jpg', 'use.jpg']);
});
test('explicit variant starts with its own cover, then its details and common slides', () => {
  assert.deepEqual(gallery.getProductImages(product, 'S'), ['small.jpg', 'small-detail.jpg', 'cover.jpg', 'specs.jpg', 'use.jpg']);
});
test('variant without photos uses only cover and common slides', () => {
  assert.deepEqual(gallery.getProductImages(product, 'XL'), ['cover.jpg', 'specs.jpg', 'use.jpg']);
  assert.deepEqual(gallery.getProductImages(product, 'removed'), ['cover.jpg', 'specs.jpg', 'use.jpg']);
});
test('gallery removes empty entries and never mutates commercial variant data', () => {
  const input = { image: '', images: ['', 'one.jpg', 'one.jpg'], sizes: [{size:'X',price:500,image:'x.jpg'}] };
  const before = structuredClone(input);
  assert.deepEqual(gallery.getProductImages(input, 'X'), ['x.jpg', 'one.jpg']);
  assert.deepEqual(input, before);
  assert.deepEqual(gallery.getProductImages(null), []);
});
