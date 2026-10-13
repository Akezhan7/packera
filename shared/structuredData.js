import { publicOrigin, publicPath, homePath, hasKazakhPage } from './publicRoutes.js';
import { PHONE, STORE_ADDRESS, DELIVERY_DESCRIPTION } from './storeContacts.js';
import { getProductImages } from './productImages.js';

function imageUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, publicOrigin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function serializeScriptData(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function pageStructuredData(route, record, catalog, language = route.lang || 'ru') {
  if (!['home','product','category','task'].includes(route.kind) ||
      (route.kind !== 'home' && (!record || record.isVisible === false))) return [];
  const store = {
    '@context':'https://schema.org', '@type':'Organization', '@id':`${publicOrigin}/#store`,
    name:'Packera.kz', url:`${publicOrigin}/`, logo:`${publicOrigin}/logo2.png`, telephone:`+${PHONE}`,
    address:{'@type':'PostalAddress',...STORE_ADDRESS},
    areaServed:{'@type':'Country',name:'Kazakhstan'},
    description:DELIVERY_DESCRIPTION[language === 'kk' ? 'kk' : 'ru'],
  };
  const graph = [store];
  if (route.kind === 'home') return graph;
  const url = publicOrigin + publicPath(route.kind, record.id, '', route.lang);
  const homeLanguage = route.lang === 'kk' && hasKazakhPage({kind:'home'},null,catalog) ? 'kk' : 'ru';
  const crumbs = [{name:language === 'kk' ? 'Басты бет' : 'Главная',item:publicOrigin + homePath(homeLanguage)}];
  if (route.kind === 'product') {
    const category = catalog.categories.find(item => item.name === record.category);
    if (category) crumbs.push({name:category.name,item:publicOrigin + publicPath('category',category.id)});
  }
  crumbs.push({name:route.lang === 'kk' ? record.titleKk : record.name || record.title,item:url});
  graph.push({
    '@context':'https://schema.org', '@type':'BreadcrumbList',
    itemListElement:crumbs.map((item,index) => ({'@type':'ListItem',position:index + 1,...item})),
  });
  if (route.kind !== 'product') return graph;
  const variant = record.sizes?.find(item => item.size === route.size) || record.sizes?.[0];
  const price = variant ? variant.price : record.price;
  const images = getProductImages(record, route.size).map(imageUrl).filter(Boolean);
  const properties = Object.entries(record.specs || {}).map(([name,value]) => ({'@type':'PropertyValue',name,value}));
  graph.push({
    '@context':'https://schema.org', '@type':'Product', '@id':url + '#product', name:record.title, url,
    ...(record.desc ? {description:record.desc} : {}),
    ...(images.length ? {image:images} : {}),
    ...(properties.length ? {additionalProperty:properties} : {}),
    ...(typeof price === 'number' && Number.isFinite(price) && price >= 0 ? {offers:{
      '@type':'Offer', price, priceCurrency:'KZT',
      url:publicOrigin + publicPath('product',record.id,variant?.size || ''), seller:{'@id':store['@id']},
    }} : {}),
  });
  return graph;
}
