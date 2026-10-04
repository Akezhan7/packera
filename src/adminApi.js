import { ref } from 'vue';

const API_BASE = import.meta.env?.VITE_API_URL || '';
export const currentUser = ref(null);
export const authNotice = ref('');
let csrfToken = null;

export async function requestApi(path, { method = 'GET', body } = {}) {
  const headers = body === undefined ? {} : { 'Content-Type': 'application/json' };
  if (!['GET', 'HEAD'].includes(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(`${API_BASE}${path}`, {
    method, headers, credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(20000),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch {
    throw Object.assign(new Error(`Некорректный ответ сервера (HTTP ${response.status})`), { status: response.status });
  }
  if (!response.ok) {
    if (response.status === 401 && ['AUTH_REQUIRED', 'SESSION_EXPIRED'].includes(data.code)) {
      if (currentUser.value || data.code === 'SESSION_EXPIRED') authNotice.value = 'Сессия истекла. Войдите снова; правки остались в открытой форме.';
      currentUser.value = null;
      csrfToken = null;
    }
    throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status, code: data.code, data });
  }
  return data;
}

function acceptSession(data) {
  currentUser.value = data.user;
  csrfToken = data.csrfToken;
  authNotice.value = '';
  return data.user;
}

export async function restoreAdmin() {
  try { return acceptSession(await requestApi('/api/auth/me')); } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export async function loginAdmin(login, password) {
  return acceptSession(await requestApi('/api/auth/login', { method: 'POST', body: { login, password } }));
}

export async function logoutAdmin() {
  try { await requestApi('/api/auth/logout', { method: 'POST' }); } catch (error) {
    if (error.status !== 401) throw error;
  }
  currentUser.value = null;
  csrfToken = null;
  authNotice.value = '';
}

export async function changeAdminPassword(currentPassword, newPassword) {
  await requestApi('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
  currentUser.value = null;
  csrfToken = null;
  authNotice.value = 'Пароль изменён. Войдите с новым паролем.';
}

// Revisions are opaque server values. Never derive a new revision locally.
export const contentBusy = ref(false);
export const pendingContentSave = ref(null);
const contentFields = {
  products: ['title','desc','price','unit','category','visual','color','image','images','tasks','sizes','specs','kaspiLink','halykLink','forteLink','sortOrder','categorySortOrder','isVisible'],
  categories: ['name','icon','sortOrder'],
  tasks: ['title','desc','titleKk','descKk','icon','image','sortOrder'],
  banners: ['image','isActive','sortOrder'],
  settings: ['value'],
};
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a,b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b,key) && same(a[key],b[key]));
};
const saveError = (message,code,extra={}) => Object.assign(new Error(message),{code,...extra});

export function makeUpdateOperation(entity, original, draft, baseline = original) {
  const changes = {};
  for(const field of contentFields[entity]) {
    if(Object.hasOwn(draft,field) && !same(draft[field],baseline[field])) changes[field]=clone(draft[field]);
  }
  return Object.keys(changes).length ? {entity,action:'update',id:original.id ?? original.key,version:original.version,changes} : null;
}

function findContent(snapshot,entity,id) {
  if(entity==='settings') return snapshot.settingVersions[id] ? {key:id,version:snapshot.settingVersions[id],value:snapshot.siteSettings[id]} : null;
  return snapshot[entity].find(item => item.id===id) || null;
}

export async function resolvePendingContentSave() {
  if(contentBusy.value) throw saveError('Сохранение уже выполняется.','SAVE_BUSY');
  const pending = pendingContentSave.value;
  if(!pending) return null;
  contentBusy.value=true;
  try {
    const snapshot=await requestApi('/api/data');
    if(!['products','categories','tasks','banners'].every(key=>Array.isArray(snapshot[key])) || !snapshot.settingVersions || !snapshot.siteSettings) throw new Error('Неполный каталог');
    const states=pending.map(operation => {
      const current=findContent(snapshot,operation.entity,operation.id ?? operation.data.id);
      if(operation.action==='delete') return !current ? 'confirmed' : current.version===operation.version ? 'not-written' : 'diverged';
      const values=operation.changes ?? Object.fromEntries(Object.entries(operation.data).filter(([key])=>key!=='id'));
      if(current && (operation.action==='create' || current.version!==operation.version) && Object.entries(values).every(([key,value])=>same(current[key],value))) return 'confirmed';
      if(operation.action==='create' ? !current : current?.version===operation.version) return 'not-written';
      return 'diverged';
    });
    const outcome=states.every(state=>state==='confirmed') ? 'confirmed' : states.every(state=>state==='not-written') ? 'not-written' : 'diverged';
    pendingContentSave.value=null;
    return {outcome,snapshot,reconciled:true};
  } catch(error) {
    throw saveError('Не удалось проверить результат записи. Подключитесь к сети и нажмите «Проверить результат». Новые записи временно заблокированы.','SAVE_UNCERTAIN',{cause:error});
  } finally { contentBusy.value=false; }
}

export async function saveContentOperations(operations) {
  if(contentBusy.value) throw saveError('Сохранение уже выполняется.','SAVE_BUSY');
  if(pendingContentSave.value) throw saveError('Сначала проверьте результат предыдущего сохранения.','SAVE_UNCERTAIN');
  const frozen=clone(operations.filter(Boolean));
  if(!frozen.length) return {changes:[],unchanged:true};
  contentBusy.value=true;
  try {
    const result=await requestApi('/api/content/batch',{method:'POST',body:{operations:frozen}});
    if(!Array.isArray(result.changes)) throw new Error('Сервер не подтвердил записанные объекты');
    return result;
  } catch(error) {
    // A definite rejected request is safe to correct. A lost response must first be reconciled.
    if(error.status>=400 && error.status<500) throw error;
    pendingContentSave.value=frozen;
  } finally { contentBusy.value=false; }
  const result=await resolvePendingContentSave();
  if(result.outcome==='confirmed') return result;
  throw saveError(result.outcome==='not-written' ? 'Изменения не записаны. Проверьте форму и повторите сохранение.' : 'Состояние на сервере отличается от отправленного. Обновите данные и вручную перенесите правки.',result.outcome==='not-written' ? 'SAVE_NOT_WRITTEN' : 'SAVE_DIVERGED',{data:result});
}

export function forgetAdmin(message) { currentUser.value=null; csrfToken=null; authNotice.value=message; }
