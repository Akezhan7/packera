import { Router } from 'express';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const widths = new Set([320, 640, 960, 1280]);
const uploadedImage = /^upload_[a-z0-9]+_\d+\.(?:jpe?g|png)$/i;

// Only generated upload names are immutable; original files are never overwritten.
export function createImageThumbnailsRouter(productsDir, publicDir) {
  const router = Router();
  const pending = new Map();
  let active = 0;
  const waiting = [];
  async function generate(source, target, width, format) {
    if (active >= 2) await new Promise(resolve => waiting.push(resolve));
    active++;
    try {
      let buffer;
      if (format === 'webp') {
        const { default: sharp } = await import('sharp');
        buffer = await sharp(source).resize({ width, withoutEnlargement:true }).webp({ quality:80 }).toBuffer();
      } else {
        const { default: Jimp } = await import('jimp');
        const image = await Jimp.read(source);
        if (image.bitmap.width > width) image.resize(width, Jimp.AUTO);
        image.quality(78);
        buffer = await image.getBufferAsync(image.getMIME());
      }
      await fs.mkdir(join(productsDir, '.thumbnails'), { recursive: true });
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
    const format = req.query.format;
    const isHero = req.params.filename === 'hero-banner' && Boolean(publicDir);
    if (!widths.has(width) || (format !== undefined && format !== 'webp') || (!isHero && !uploadedImage.test(req.params.filename))) {
      return res.status(400).json({ error: 'Unsupported image or thumbnail width' });
    }
    const source = isHero ? join(publicDir,'Artboard 1.png') : join(productsDir, req.params.filename);
    try {
      const sourceStat = await fs.stat(source);
      const cacheName = isHero ? `${sourceStat.mtimeMs}-${sourceStat.size}-hero-banner.png` : req.params.filename;
      const target = join(productsDir, '.thumbnails', format === 'webp' ? `webp-${width}-${cacheName}.webp` : `${width}-${cacheName}`);
      try { await fs.access(target); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (!pending.has(target)) {
          if (waiting.length >= 128) {
            // Backpressure must not break an existing photo or cache the original as a thumbnail.
            return res.sendFile(source, { headers: { 'Cache-Control': 'no-store' } }, error => { if (error) next(error); });
          }
          pending.set(target, generate(source, target, width, format).finally(() => pending.delete(target)));
        }
        await pending.get(target);
      }
      res.sendFile(target, { maxAge: isHero ? '1d' : '1y', immutable: !isHero, dotfiles: 'allow' }, error => { if (error) next(error); });
    } catch (error) {
      if (error.code === 'ENOENT') return res.sendStatus(404);
      console.error('Thumbnail generation failed:', req.params.filename, error.message);
      res.status(500).json({ error: 'Unable to prepare image' });
    }
  });
  return router;
}
