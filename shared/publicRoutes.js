const sections = { product: 'product', category: 'catalog', task: 'tasks' };
const kinds = Object.fromEntries(Object.entries(sections).map(([kind, section]) => [section, kind]));
export const publicOrigin = 'https://packera.kz';

export function homePath(language = 'ru') {
  return language === 'kk' ? '/kk/' : '/';
}

export function publicPath(kind, id, size = '', language = 'ru') {
  if (!sections[kind] || typeof id !== 'string' || !id) throw new TypeError('Public route requires an existing ID');
  // The prefix also makes IDs such as "." or ".." safe URL segments.
  const path = `${language === 'kk' ? '/kk' : ''}/${sections[kind]}/id-${encodeURIComponent(id)}`;
  return kind === 'product' && size ? `${path}?size=${encodeURIComponent(size)}` : path;
}

export function parsePublicRoute(input) {
  let [pathname, query = ''] = input.split('?');
  const locale = pathname === '/kk' || pathname.startsWith('/kk/') ? { lang:'kk' } : {};
  if (locale.lang) pathname = pathname.slice(3) || '/';
  if (pathname === '/') return { kind: 'home', ...locale };
  if (locale.lang && pathname === '/admin') return { kind:'missing' };
  if (pathname === '/admin') return { kind: 'admin' };
  const match = /^\/(product|catalog|tasks)\/id-([^/]+)\/?$/.exec(pathname);
  if (!match) return { kind: 'missing' };
  try {
    const id = decodeURIComponent(match[2]);
    if (!id || id.length > 200 || id.includes('\u0000')) return { kind: 'missing' };
    return { kind: kinds[match[1]], id, size: new URLSearchParams(query).get('size') || '', ...locale };
  } catch { return { kind: 'missing' }; }
}

export function publicRecord(route, catalog) {
  const list = catalog[{ product: 'products', category: 'categories', task: 'tasks' }[route.kind]];
  const record = list?.find(item => item.id === route.id && (route.kind !== 'product' || item.isVisible !== false)) || null;
  return route.lang === 'kk' && !hasKazakhPage(route, record, catalog) ? null : record;
}

export function hasKazakhPage(route, record, catalog) {
  if (route.kind === 'home') {
    const hero = catalog.siteSettings?.hero;
    return Boolean(hero?.titleKk?.trim() && (!hero.description?.trim() || hero.descriptionKk?.trim()) &&
      (hero.actionType === 'none' || !hero.buttonText?.trim() || hero.buttonTextKk?.trim()));
  }
  return route.kind === 'task' && Boolean(record?.titleKk?.trim() && (!record.desc?.trim() || record.descKk?.trim()));
}

export function pageAlternates(route, record, catalog) {
  if (!hasKazakhPage(route, record, catalog)) return [];
  const path = language => route.kind === 'home' ? homePath(language) : publicPath(route.kind, record.id, '', language);
  return ['ru','kk','x-default'].map(language => ({ language, url:publicOrigin + path(language) }));
}

export function isPlainNavigation(event) {
  return !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function pageMetadata(route, record, catalog) {
  const home = {
    title: 'Packera.kz — упаковочные материалы в Алматы',
    description: 'Коробки, скотч, стрейч и воздушно-пузырчатая плёнка для переезда, хранения и бизнеса. Доставка по всему Казахстану.',
    url: `${publicOrigin}/`, image: `${publicOrigin}/Artboard%201.png`,
  };
  const hero = catalog?.siteSettings?.hero;
  if (route.kind === 'home' && route.lang === 'kk' && hero) return {
    ...home, title:`${hero.titleKk} — Packera.kz`, description:hero.descriptionKk || hero.titleKk, url:publicOrigin + homePath('kk'),
  };
  if (!record) return home;
  const name = route.lang === 'kk' ? record.titleKk : record.name || record.title;
  let image = home.image;
  try {
    const candidate = new URL(record.desktopImage || record.image || '', publicOrigin);
    if ((record.desktopImage || record.image) && ['http:', 'https:'].includes(candidate.protocol)) image = candidate.href;
  } catch { /* Invalid image URLs do not become social preview URLs. */ }
  return {
    title: `${name} — Packera.kz`,
    description: (route.lang === 'kk' ? record.descKk : record.desc) || name,
    url: publicOrigin + publicPath(route.kind, record.id, '', route.lang), image,
  };
}
