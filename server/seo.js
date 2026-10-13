import { Router } from 'express';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { parsePublicRoute, publicPath, publicRecord, pageMetadata, homePath, hasKazakhPage, pageAlternates } from '../shared/publicRoutes.js';
import { pageStructuredData, serializeScriptData } from '../shared/structuredData.js';
import { buildSitemap } from './sitemap.js';

const origin = 'https://packera.kz';
const aliases = new Set(['www.packera.kz', 'packerra.kz', 'www.packerra.kz']);

export function seoHeaders(req, res, next) {
  const hostname = req.hostname.toLowerCase();
  const trustedProxy = Boolean(req.app.get('trust proxy'));
  if (aliases.has(hostname) || (hostname === 'packera.kz' && trustedProxy && !req.secure)) {
    return res.redirect(308, `${origin}${req.originalUrl}`);
  }
  if (/^\/(?:admin|api)(?:\/|$)/i.test(req.path)) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    if (/^\/admin(?:\/|$)/i.test(req.path)) res.set('Cache-Control', 'no-store');
  }
  if (req.path === '/index.html') return res.redirect(308, `/${req.url.slice(req.path.length)}`);
  if (/^\/admin\/?$/i.test(req.path) && req.path !== '/admin') {
    return res.redirect(308, `/admin${req.url.slice(req.path.length)}`);
  }
  next();
}

export function createPublicPagesRouter(distPath, loadCatalog, render) {
  const router = Router();
  router.get('/sitemap.xml', async (_req,res,next) => {
    res.set('Cache-Control','no-store');
    try { res.type('application/xml').send(buildSitemap(await loadCatalog())); }
    catch (error) { next(error); }
  });
  router.get(/^\/(?:$|kk(?:\/|$)|(?:product|catalog|tasks)\/)/, async (req, res, next) => {
    const route = parsePublicRoute(req.originalUrl);
    if (route.kind === 'missing') return next();
    res.set('Cache-Control', 'no-store');
    try {
      const catalog = await loadCatalog();
      const record = publicRecord(route, catalog);
      if (route.kind !== 'home' && !record) return next();
      if (route.kind === 'home' && route.lang === 'kk' && !hasKazakhPage(route, record, catalog)) return next();
      const canonicalPath = route.kind === 'home' ? homePath(route.lang) : publicPath(route.kind, record.id, '', route.lang);
      if (req.path !== canonicalPath) return res.redirect(308, canonicalPath + req.url.slice(req.path.length));
      if (route.kind === 'product' && route.size && !record.sizes?.some(size => size.size === route.size)) {
        const query = new URLSearchParams(req.url.slice(req.path.length));
        query.delete('size');
        return res.redirect(307, canonicalPath + (query.size ? '?' + query.toString() : ''));
      }
      const publicCatalog = { ...catalog, products:catalog.products.filter(product => product.isVisible !== false) };
      const renderedAt = Date.now();
      const body = await render(req.originalUrl, publicCatalog, renderedAt);
      const meta = pageMetadata(route, record, publicCatalog);
      const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
      let html = await readFile(join(distPath, 'index.html'), 'utf8');
      html = html.replace(/(<html[^>]*\slang=")[^"]*(")/, (_match,start,end) => start + (route.lang || 'ru') + end);
      html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escape(meta.title)}</title>`);
      for (const [attribute, key, value] of [
        ['name', 'description', meta.description], ['property', 'og:title', meta.title],
        ['property', 'og:description', meta.description], ['property', 'og:url', meta.url], ['property', 'og:image', meta.image],
        ['property', 'og:locale', route.lang === 'kk' ? 'kk_KZ' : 'ru_KZ'],
      ]) {
        html = html.replace(new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`), (_match, start, end) => start + escape(value) + end);
      }
      html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, (_match, start, end) => start + escape(meta.url) + end);
      const structuredData = pageStructuredData(route, record, publicCatalog);
      const alternates = pageAlternates(route, record, publicCatalog).map(item => `<link rel="alternate" hreflang="${item.language}" href="${escape(item.url)}">`).join('');
      html = html.replace('</head>', () => `${alternates}<script id="packera-structured-data" type="application/ld+json">${serializeScriptData(structuredData)}</script></head>`);
      // JSON is inert, but '<' must be escaped to prevent closing the script tag.
      const state = serializeScriptData({ url:req.originalUrl, catalog:publicCatalog, renderedAt });
      html = html.replace('<div id="app"></div>', () => `<div id="app">${body}</div><script id="packera-state" type="application/json">${state}</script>`);
      res.type('html').send(html);
    } catch (error) { next(error); }
  });
  router.get('/admin', (_req, res, next) => {
    res.sendFile(join(distPath, 'index.html'), { headers: { 'Cache-Control': 'no-store' } }, error => { if (error) next(error); });
  });
  router.get(/.*/, (req, res, next) => {
    if (/^\/api(?:\/|$)/i.test(req.path)) return next();
    res.status(404).sendFile(join(distPath, '404.html'), {
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    }, error => { if (error) next(error); });
  });
  return router;
}
