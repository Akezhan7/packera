<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { banners, categories, tasks, products, siteSettings, settingVersions, loadDatabase } from '../data.js';
import { makeUpdateOperation } from '../adminApi.js';
import { bannerFields, heroFields, validateMarketingRecord } from '../../shared/marketing.js';

const props = defineProps({ state:Object, save:Function, uploadImage:Function, blocked:Boolean, catalogReady:Boolean, reading:Boolean, writing:Boolean, issue:Object, pending:Boolean, checkSave:Function });
const mode = ref('');
const original = ref(null);
const draft = ref(null);
const initial = ref('');
const message = ref('');
const uploading = ref(false);
const saving = ref(false);
const scheduleEnabled = ref(false);
const editor = ref(null);
const busy = computed(() => props.blocked || uploading.value || saving.value);
const refreshBusy = computed(() => props.reading || props.writing || props.pending || uploading.value || saving.value);
const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== initial.value);
watch(dirty, value => { props.state.dirty = value; }, {immediate:true});
onUnmounted(() => { props.state.dirty = false; });
watch(draft, async value => {
  if(value) { await nextTick(); if(editor.value && !editor.value.open) editor.value.showModal(); }
});
const actions = [
  ['none','Без действия'], ['info','Информационное окно'], ['category','Категория'],
  ['task','Задача'], ['product','Товар'], ['link','Произвольная ссылка'],
];
const options = computed(() => draft.value?.actionType === 'category' ? categories.map(c=>({id:c.id,title:c.name})) : draft.value?.actionType === 'task' ? tasks : products);
const destinations = ['category','task','product'];
const orderedBanners = computed(() => [...banners].sort((a,b)=>a.sortOrder-b.sortOrder || String(a.id).localeCompare(String(b.id))));
const canClose = () => !busy.value && (!dirty.value || confirm('Отменить несохранённые изменения баннера?'));
function openEditor(kind, item = null, discard = false) {
  if (draft.value && !discard && !canClose()) return;
  mode.value = kind;
  original.value = kind === 'hero' ? structuredClonePlain(item || {key:'hero',version:settingVersions.hero,value:siteSettings.hero}) : item ? structuredClonePlain(item) : null;
  const values = kind === 'hero' ? original.value.value : item || {image:'',mobileImage:'',title:'',titleKk:'',description:'',descriptionKk:'',actionType:'none',actionTarget:'',isActive:true,sortOrder:orderedBanners.value.length,startsAt:'',endsAt:''};
  draft.value = Object.fromEntries((kind === 'hero' ? heroFields : bannerFields).map(field=>[field,values?.[field] ?? '']));
  scheduleEnabled.value = Boolean(draft.value.startsAt || draft.value.endsAt);
  initial.value = JSON.stringify(draft.value);
  message.value = '';
}
const structuredClonePlain = value => JSON.parse(JSON.stringify(value));
const closeEditor = () => { if(canClose()) draft.value = null; };
async function recoverSave() {
  const result = await props.checkSave();
  if(result?.outcome === 'confirmed') draft.value = null;
}
async function retryCatalog() {
  if(refreshBusy.value) return;
  message.value = '';
  try { await loadDatabase(); }
  catch(error) { message.value = error.message; }
}
const conflictVersion = computed(() => {
  if (!props.issue || !draft.value) return null;
  if (props.issue.entity !== (mode.value==='hero' ? 'settings' : 'banners')) return null;
  if (props.issue.current && (mode.value==='hero' ? props.issue.current.key==='hero' : props.issue.current.id===original.value?.id)) return props.issue.current;
  const snapshot = props.issue.snapshot;
  if(mode.value==='hero' && snapshot?.settingVersions.hero) return {key:'hero',version:snapshot.settingVersions.hero,value:snapshot.siteSettings.hero};
  return snapshot?.banners?.find(b=>b.id===original.value?.id);
});
async function loadFreshVersion() {
  if(!canClose()) return;
  try {
    await loadDatabase();
    const current = mode.value==='hero' ? {key:'hero',version:settingVersions.hero,value:siteSettings.hero} : banners.find(b=>b.id===original.value?.id);
    if(!current) { message.value='Баннер удалён. Ваш черновик сохранён в форме.'; return; }
    openEditor(mode.value,current,true);
  } catch(error) { message.value=error.message; }
}
const actionLabel = type => actions.find(([value])=>value===type)?.[1] || 'Без действия';
const publicationLabel = banner => {
  const now = Date.now();
  if(!banner.isActive) return 'Отключён';
  if(banner.startsAt && Date.parse(banner.startsAt)>now) return 'Запланирован';
  if(banner.endsAt && Date.parse(banner.endsAt)<=now) return 'Завершён';
  return 'Опубликован';
};
const changeAction = () => { draft.value.actionTarget = ''; };
const commonImageChanged = () => { draft.value.mobileImage = ''; };
const changeSchedule = () => { if(!scheduleEnabled.value) { draft.value.startsAt = ''; draft.value.endsAt = ''; } };
const localDate = value => value ? new Date(Date.parse(value)+5*60*60*1000).toISOString().slice(0,16) : '';
const setDate = (field, value) => { draft.value[field] = value ? `${value}:00+05:00` : ''; };
const displayDate = value => value ? new Intl.DateTimeFormat('ru-KZ',{timeZone:'Asia/Almaty',dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '—';

async function saveDraft() {
  if(busy.value) return;
  message.value = validateMarketingRecord(draft.value, mode.value === 'hero');
  if(message.value) return;
  const data = structuredClonePlain(draft.value);
  const operation = mode.value === 'hero'
    ? makeUpdateOperation('settings',original.value,{value:data})
    : original.value ? makeUpdateOperation('banners',original.value,data) : {entity:'banners',action:'create',data:{id:crypto.randomUUID(),...data}};
  saving.value = true;
  try {
    if(await props.save([operation],{entity:mode.value === 'hero' ? 'settings' : 'banners',draft:data})) draft.value = null;
    else message.value = 'Изменения не сохранены. Черновик оставлен в форме; проверьте сообщение об ошибке.';
  } finally { saving.value = false; }
}
async function upload(event, field) {
  const file = event.target.files[0];
  if(!file || busy.value) return;
  if(!file.type.startsWith('image/')) { message.value='Выберите файл изображения.'; return; }
  uploading.value = true;
  message.value = '';
  try {
    draft.value[field] = await props.uploadImage(file, field === 'image' ? 1920 : 1200);
    if(field === 'image') commonImageChanged();
  }
  catch(error) { message.value = error.message; }
  finally { uploading.value=false; event.target.value=''; }
}
async function move(index, direction) {
  const ordered = [...orderedBanners.value];
  if(busy.value || index+direction<0 || index+direction>=ordered.length) return;
  const item=ordered.splice(index,1)[0]; ordered.splice(index+direction,0,item);
  await props.save(ordered.map((banner,rank)=>makeUpdateOperation('banners',banner,{sortOrder:rank})));
}
const toggle = banner => props.save([makeUpdateOperation('banners',banner,{isActive:!banner.isActive})]);
const remove = banner => { if(confirm('Удалить баннер?')) return props.save([{entity:'banners',action:'delete',id:banner.id,version:banner.version}]); };
</script>

<template>
  <div class="tab-pane-content marketing-admin">
    <div class="card marketing-toolbar">
      <div><h3>Главный баннер</h3><p>Отдельный постоянный блок: изображения, сообщение и кнопка на RU/KK.</p></div>
      <button class="btn btn-primary" :disabled="busy || !siteSettings.hero" @click="openEditor('hero')">Редактировать главный баннер</button>
    </div>
    <div class="card marketing-list">
      <div class="marketing-toolbar"><h3>Рекламные баннеры</h3><button class="btn btn-primary" :disabled="busy" @click="openEditor('banner')">+ Добавить баннер</button></div>
      <div class="table-container">
        <table class="dashboard-table">
          <thead><tr><th>Изображение / название</th><th>Публикация</th><th>Действие</th><th>Период (UTC+5)</th><th>Порядок</th><th>Действия</th></tr></thead>
          <tbody>
            <tr v-for="(banner,index) in orderedBanners" :key="banner.id">
              <td><img :src="banner.image" alt="" class="banner-preview" /><div>{{ banner.title || 'Без названия' }}</div></td>
              <td><button class="btn btn-secondary" :disabled="busy" :title="banner.isActive ? 'Отключить баннер' : 'Включить баннер'" @click="toggle(banner)">{{ publicationLabel(banner) }}</button></td>
              <td>{{ actionLabel(banner.actionType) }}</td>
              <td>{{ displayDate(banner.startsAt) }}<br>{{ displayDate(banner.endsAt) }}</td>
              <td><button class="btn btn-secondary" :disabled="busy || index===0" @click="move(index,-1)" aria-label="Выше">↑</button> <button class="btn btn-secondary" :disabled="busy || index===orderedBanners.length-1" @click="move(index,1)" aria-label="Ниже">↓</button></td>
              <td><button class="btn btn-secondary" :disabled="busy" @click="openEditor('banner',banner)">Изменить</button> <button class="btn btn-secondary" :disabled="busy" @click="remove(banner)">Удалить</button></td>
            </tr>
            <tr v-if="!orderedBanners.length"><td colspan="6">Баннеров пока нет. Добавьте акцию или новинку.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <Teleport to="body">
      <dialog v-if="draft" ref="editor" class="marketing-editor" aria-labelledby="marketing-editor-title" @cancel.prevent="closeEditor">
        <header class="modal-header"><h3 id="marketing-editor-title">{{ mode==='hero' ? 'Главный баннер' : 'Рекламный баннер' }}</h3><button type="button" class="editor-close" :disabled="busy" @click="closeEditor" aria-label="Закрыть">×</button></header>
        <form class="modal-body" @submit.prevent="saveDraft">
          <p v-if="message" role="alert" class="editor-error">{{ message }}</p>
          <div v-if="issue && ['settings','banners'].includes(issue.entity)" class="editor-error" role="alert">
            <p>{{ issue.message }}</p>
            <details v-if="issue.current"><summary>Текущая версия сервера</summary><pre>{{ JSON.stringify(issue.current,null,2) }}</pre></details>
            <details v-if="issue.draft"><summary>Ваш сохранённый черновик</summary><pre>{{ JSON.stringify(issue.draft,null,2) }}</pre></details>
            <button v-if="conflictVersion && !pending" type="button" class="btn btn-secondary" :disabled="busy" @click="loadFreshVersion">Загрузить свежую версию</button>
          </div>
          <button v-if="pending" type="button" class="btn btn-secondary" :disabled="uploading || saving" @click="recoverSave">Проверить результат</button>
          <button v-if="!catalogReady && !pending" type="button" class="btn btn-secondary" :disabled="refreshBusy" @click="retryCatalog">Повторить загрузку каталога</button>
          <fieldset :disabled="busy" class="editor-fields">
            <div class="form-group">
              <label class="form-label" for="marketing-upload">Изображение *</label>
              <input id="marketing-upload" type="file" accept="image/*" @change="upload($event,'image')" />
              <input id="marketing-image" v-model="draft.image" class="form-control image-link" aria-label="Ссылка на изображение" placeholder="Или вставьте ссылку на изображение" @change="commonImageChanged" />
              <p class="editor-hint">Одно изображение используется на компьютере и телефоне. Новая загрузка заменяет фото для обоих устройств.</p>
            </div>
            <details class="editor-extra">
              <summary>Отдельное фото для телефона · необязательно{{ draft.mobileImage ? ' · задано' : '' }}</summary>
              <div class="form-group">
                <input id="marketing-mobileImage" v-model="draft.mobileImage" class="form-control" aria-label="Ссылка на отдельное фото для телефона" />
                <input type="file" accept="image/*" aria-label="Отдельное фото для телефона" @change="upload($event,'mobileImage')" />
                <button v-if="draft.mobileImage" type="button" class="btn btn-secondary" @click="draft.mobileImage=''">Использовать общее изображение</button>
              </div>
            </details>
            <div v-if="draft.image" class="image-previews" :class="{'hero-previews':mode==='hero'}">
              <figure><img :src="draft.image" alt="Кадр изображения для компьютера" /><figcaption>Компьютер</figcaption></figure>
              <figure><img :src="draft.mobileImage || draft.image" alt="Кадр изображения для телефона" /><figcaption>Телефон</figcaption></figure>
            </div>
            <p class="editor-hint">Для главного блока подходит фото без встроенных надписей. Для промоленты используйте горизонтальный баннер примерно 2,2:1: изображение заполняет всю область, края могут обрезаться.</p>
            <div class="editor-columns">
              <div v-for="([suffix,lang]) in [['','RU'],['Kk','KK']]" :key="lang">
                <div class="form-group"><label class="form-label" :for="`marketing-title-${lang}`">Заголовок ({{ lang }})</label><input :id="`marketing-title-${lang}`" v-model="draft[`title${suffix}`]" class="form-control" :required="mode==='hero' || draft.actionType==='info'" /></div>
                <div class="form-group"><label class="form-label" :for="`marketing-description-${lang}`">{{ draft.actionType==='info' ? 'Информация в окне' : 'Описание' }} ({{ lang }})</label><textarea :id="`marketing-description-${lang}`" v-model="draft[`description${suffix}`]" class="form-control" rows="3" :required="draft.actionType==='info'"></textarea></div>
                <div v-if="mode==='hero'" class="form-group"><label class="form-label" :for="`marketing-button-${lang}`">Текст кнопки ({{ lang }})</label><input :id="`marketing-button-${lang}`" v-model="draft[`buttonText${suffix}`]" class="form-control" :required="draft.actionType!=='none'" /></div>
              </div>
            </div>
            <div class="form-group"><label class="form-label" for="marketing-action">Действие при нажатии</label><select id="marketing-action" v-model="draft.actionType" class="form-control" @change="changeAction"><option v-for="([value,label]) in actions" :key="value" :value="value">{{ label }}</option></select></div>
            <div v-if="destinations.includes(draft.actionType)" class="form-group"><label class="form-label" for="marketing-target">Место перехода</label><select id="marketing-target" v-model="draft.actionTarget" class="form-control" required><option value="" disabled>Выберите из списка</option><option v-for="item in options" :key="item.id" :value="item.id">{{ item.title }}</option></select></div>
            <div v-if="draft.actionType==='link'" class="form-group"><label class="form-label" for="marketing-link">Внутренний путь или ссылка http/https</label><input id="marketing-link" v-model="draft.actionTarget" class="form-control" required placeholder="https://… или /… или #…" /></div>
            <div v-if="mode==='banner'" class="editor-columns">
              <div v-if="scheduleEnabled" class="form-group"><label class="form-label" for="marketing-start">Начало публикации (UTC+5)</label><input id="marketing-start" type="datetime-local" class="form-control" :value="localDate(draft.startsAt)" @input="setDate('startsAt',$event.target.value)" /></div>
              <div v-if="scheduleEnabled" class="form-group"><label class="form-label" for="marketing-end">Окончание публикации (UTC+5)</label><input id="marketing-end" type="datetime-local" class="form-control" :value="localDate(draft.endsAt)" @input="setDate('endsAt',$event.target.value)" /></div>
              <div class="form-group"><label class="form-label" for="marketing-order">Порядок</label><input id="marketing-order" v-model.number="draft.sortOrder" class="form-control" type="number" step="1" required /></div>
              <div class="publication-options">
                <label><input type="checkbox" v-model="draft.isActive" /> Включить баннер</label>
                <label><input type="checkbox" v-model="scheduleEnabled" @change="changeSchedule" /> Показывать по расписанию</label>
              </div>
            </div>
            <p v-if="mode==='banner' && scheduleEnabled" class="editor-hint">Включённый баннер показывается только в заданный период. Отключите расписание, чтобы убрать ограничение по датам.</p>
            <div class="form-submit-actions"><button type="button" class="btn btn-secondary" @click="closeEditor">Отмена</button><button type="submit" class="btn btn-primary">Сохранить</button></div>
          </fieldset>
        </form>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
.marketing-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px; }
.marketing-toolbar h3 { margin:0; }
.marketing-toolbar p,.editor-hint { font-size:13px; color:var(--text-muted); margin:8px 0; }
.marketing-list { margin-top:20px; }
.table-container { width:100%; overflow-x:auto; }
.dashboard-table { width:100%; border-collapse:collapse; white-space:nowrap; }
.dashboard-table th,.dashboard-table td { padding:12px; border-bottom:1px solid var(--border-line); text-align:left; font-size:13px; }
.dashboard-table th { background:var(--bg-soft); }
.marketing-editor { width:calc(100% - 24px); max-width:780px; max-height:90vh; max-height:90dvh; padding:0; border:0; border-radius:16px; background:var(--bg-paper); color:var(--text-ink); margin:auto; }
.marketing-editor[open] { display:flex; flex-direction:column; }
.marketing-editor::backdrop { background:rgba(0,0,0,.55); }
.marketing-editor .modal-header { flex-shrink:0; padding:18px 22px; border-bottom:1px solid var(--border-line); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.marketing-editor .modal-header h3 { margin:0; }
.marketing-editor .modal-body { padding:20px 22px; min-height:0; overflow-y:auto; overscroll-behavior:contain; }
.editor-close { width:36px; height:36px; font-size:28px; color:inherit; cursor:pointer; background:var(--bg-soft); border:0; border-radius:8px; }
.form-group { margin-bottom:16px; }
.form-label { display:block; margin-bottom:6px; font-size:13px; font-weight:600; }
.form-submit-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:20px; }
.editor-error .btn { margin:8px 0; }
.banner-preview { width:120px; height:60px; object-fit:contain; background:#f5f5f5; border-radius:6px; }
.image-link { margin-top:10px; }
.editor-extra { margin:0 0 16px; font-size:13px; }
.editor-extra summary { cursor:pointer; color:var(--text-muted); }
.editor-extra .form-group { margin-top:12px; }
.image-previews { display:grid; grid-template-columns:1.4fr 1fr; gap:16px; margin:16px 0; }
.image-previews figure { margin:0; min-width:0; }
.image-previews img { display:block; width:100%; aspect-ratio:2.2/1; object-fit:cover; border-radius:10px; }
.hero-previews img { aspect-ratio:2.3/1; object-position:65% 50%; }
.hero-previews figure:last-child img { aspect-ratio:1.5/1; object-position:72% 50%; }
.image-previews figcaption { margin-top:6px; color:var(--text-muted); font-size:12px; }
.publication-options { display:flex; flex-direction:column; gap:12px; padding-top:6px; }
.editor-columns { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.editor-fields { border:0; padding:0; margin:0; min-width:0; }
.editor-error { color:#b42318; white-space:pre-wrap; overflow-wrap:anywhere; }
pre { max-height:200px; overflow:auto; }
@media(max-width:600px) { .editor-columns { grid-template-columns:1fr; } .marketing-toolbar { flex-direction:column; align-items:flex-start; } }
</style>
