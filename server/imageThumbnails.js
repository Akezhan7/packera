import { Router } from 'express';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const widths = new Set([320, 640, 960]);
const uploadedImage = /^upload_[a-z0-9]+_\d+\.(?:jpe?g|png)$/i;

// Only generated upload names are immutable; original files are never overwritten.
export function createImageThumbnailsRouter(productsDir) {
  const router = Router();
  const pending = new Map();
  let active = 0;
  const waiting = [];
  async function generate(source, target, width) {
    if (active >= 2) await new Promise(resolve => waiting.push(resolve));
    active++;
    try {
      const { default: Jimp } = await import('jimp');
      const image = await Jimp.read(source);
      if (image.bitmap.width > width) image.resize(width, Jimp.AUTO);
      image.quality(78);
      await fs.mkdir(join(productsDir, '.thumbnails'), { recursive: true });
      const buffer = await image.getBufferAsync(image.getMIME());
      await fs.writeFile(`${target}.tmp`, buffer);
      await fs.rename(`${target}.tmp`, target);
    } finally {
      active--;
      waiting.shift()?.();
    }
  }
  router.get('/:filename', async (req, res, next) => {
    if (req.query.w === undefined) return next();
    const width = Number(req.query.w);
    if (!widths.has(width) || !uploadedImage.test(req.params.filename)) {
      return res.status(400).json({ error: 'Unsupported image or thumbnail width' });
    }
    const source = join(productsDir, req.params.filename);
    const target = join(productsDir, '.thumbnails', `${width}-${req.params.filename}`);
    try {
      await fs.access(source);
      try { await fs.access(target); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (!pending.has(target)) {
          if (waiting.length >= 128) {
            // Backpressure must not break an existing photo or cache the original as a thumbnail.
            return res.sendFile(source, { headers: { 'Cache-Control': 'no-store' } }, error => { if (error) next(error); });
          }
          pending.set(target, generate(source, target, width).finally(() => pending.delete(target)));
        }
        await pending.get(target);
      }
      res.sendFile(target, { maxAge: '1y', immutable: true, dotfiles: 'allow' }, error => { if (error) next(error); });
    } catch (error) {
      if (error.code === 'ENOENT') return res.sendStatus(404);
      console.error('Thumbnail generation failed:', req.params.filename, error.message);
      res.status(500).json({ error: 'Unable to prepare image' });
    }
  });
  return router;
}
