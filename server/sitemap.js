import { publicOrigin, publicPath, homePath, hasKazakhPage, pageAlternates } from '../shared/publicRoutes.js';

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));

export function buildSitemap(catalog) {
  const entries = [];
  function append(kind, record = null) {
    const route = {kind};
    const alternates = pageAlternates(route,record,catalog);
    for (const language of hasKazakhPage(route,record,catalog) ? ['ru','kk'] : ['ru']) {
      const path = kind === 'home' ? homePath(language) : publicPath(kind,record.id,'',language);
      const links = alternates.map(item => `<xhtml:link rel="alternate" hreflang="${item.language}" href="${escapeXml(item.url)}"/>`).join('');
      entries.push(`<url><loc>${escapeXml(publicOrigin + path)}</loc>${links}</url>`);
    }
  }
  append('home');
  for (const product of catalog.products) if (product.isVisible !== false) append('product',product);
  for (const category of catalog.categories) append('category',category);
  for (const task of catalog.tasks) append('task',task);
  // Dates are omitted: category/task pages also change when their products change.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  if (entries.length > 50000 || Buffer.byteLength(xml,'utf8') > 50 * 1024 * 1024) throw new RangeError('Sitemap exceeds protocol limits');
  return xml;
}
