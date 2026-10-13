export const actionTypes = ['none', 'info', 'category', 'task', 'product', 'link'];
export const bannerFields = ['image','mobileImage','title','titleKk','description','descriptionKk','actionType','actionTarget','isActive','sortOrder','startsAt','endsAt'];
export const heroFields = ['image','mobileImage','title','titleKk','description','descriptionKk','buttonText','buttonTextKk','actionType','actionTarget'];

export function isSafeLink(value) {
  if (typeof value !== 'string' || !value || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return false;
  if (value.startsWith('#')) return value.length > 1;
  if (value.startsWith('/')) return !value.startsWith('//');
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

export function validateMarketingRecord(record, hero = false) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'Некорректные настройки баннера';
  const fields = hero ? heroFields : bannerFields;
  if (Object.keys(record).some(key => !fields.includes(key))) return 'Неизвестное поле баннера';
  for (const [key, value] of Object.entries(record)) {
    if (['isActive','sortOrder'].includes(key)) continue;
    if (typeof value !== 'string' || value.length > (key.includes('Image') || key === 'image' ? 10000000 : 20000)) return `Некорректное поле ${key}`;
  }
  if (!record.image?.trim()) return 'Укажите изображение для компьютера';
  for (const field of hero ? ['title','description','buttonText'] : ['title','description']) {
    if (!!record[field]?.trim() !== !!record[`${field}Kk`]?.trim()) return 'Заполните тексты на RU и KK';
  }
  const type = record.actionType || 'none';
  if (!actionTypes.includes(type)) return 'Неизвестное действие баннера';
  if (['category','task','product'].includes(type) && !record.actionTarget?.trim()) return 'Выберите место перехода';
  if (type === 'link' && !isSafeLink(record.actionTarget)) return 'Укажите внутренний путь или ссылку http/https';
  if (hero && (!record.title?.trim() || !record.titleKk?.trim())) return 'Заполните заголовок на RU и KK';
  if (hero && type !== 'none' && (!record.buttonText?.trim() || !record.buttonTextKk?.trim())) return 'Заполните текст кнопки на RU и KK';
  if (type === 'info' && ['title','titleKk','description','descriptionKk'].some(key => !record[key]?.trim())) return 'Заполните заголовок и информацию на RU и KK';
  for (const key of ['startsAt','endsAt']) {
    if (record[key] && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(record[key]) || !Number.isFinite(Date.parse(record[key])))) return 'Укажите дату с часовым поясом';
  }
  if (record.startsAt && record.endsAt && Date.parse(record.startsAt) >= Date.parse(record.endsAt)) return 'Окончание должно быть позже начала';
  return '';
}

export function getActiveBanners(banners, now = Date.now()) {
  return banners.filter(b => b.isActive && (!b.startsAt || Date.parse(b.startsAt) <= now) && (!b.endsAt || now < Date.parse(b.endsAt)))
    .sort((a,b) => a.sortOrder - b.sortOrder || String(a.id).localeCompare(String(b.id)));
}
