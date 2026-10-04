<script setup>
import {ref,onMounted,onUnmounted} from 'vue';
import {requestApi} from '../adminApi.js';
const entities={products:'Товары',categories:'Категории',tasks:'Задачи',banners:'Баннеры',settings:'Настройки',users:'Аккаунты'};
const actions={create:'Создание',update:'Изменение',delete:'Удаление'};
const fieldNames={login:'Логин',name:'Имя',role:'Роль',isActive:'Активность',mustChangePassword:'Обязательная смена пароля',passwordReset:'Сброс пароля',passwordChanged:'Смена пароля',title:'Название',desc:'Описание',price:'Цена',image:'Изображение',images:'Фотографии',category:'Категория',value:'Значение'};
const filters=ref({entity:'',id:'',actor:'',from:'',to:''});
const users=ref([]),items=ref([]),total=ref(0),offset=ref(0),busy=ref(false),error=ref(''),limit=ref(20);
let applied={},sequence=0;
const pageSize=ref(20);
const display=v=>v===null?'—':typeof v==='object'?JSON.stringify(v,null,2):typeof v==='boolean'?(v?'Да':'Нет'):String(v);
const time=v=>new Date(v).toLocaleString('ru-RU');
async function load(nextOffset=0,apply=false) {
  if(busy.value) return;
  if(apply) {
    applied={};pageSize.value=limit.value;
    for(const [key,value] of Object.entries(filters.value)) if(value) applied[key]=['from','to'].includes(key)?new Date(value).toISOString():value.trim();
  }
  const token=++sequence;
  busy.value=true;error.value='';
  try {
    const query=new URLSearchParams({...applied,offset:nextOffset,limit:pageSize.value});
    const result=await requestApi('/api/audit?'+query);
    if(token!==sequence)return;
    items.value=result.items;total.value=result.total;offset.value=result.offset;
  } catch(e) {if(token===sequence)error.value=e.message;}
  finally {if(token===sequence)busy.value=false;}
}
async function authors() {
  try {users.value=(await requestApi('/api/users')).users;} catch(e) {error.value=e.message;}
}
onMounted(()=>{load();authors();});
onUnmounted(()=>sequence++);
</script>

<template>
  <section class="history-view">
    <p>Подтверждённые изменения каталога и доступа. Время показано в часовом поясе вашего устройства. Пароли в истории не сохраняются.</p>
    <form class="filters" @submit.prevent="load(0,true)">
      <fieldset :disabled="busy">
        <label>Раздел<select v-model="filters.entity" class="form-control"><option value="">Все разделы</option><option v-for="(name,key) in entities" :key="key" :value="key">{{name}}</option></select></label>
        <label>ID объекта<input v-model="filters.id" class="form-control"></label>
        <label>Автор<select v-model="filters.actor" class="form-control"><option value="">Все авторы</option><option v-for="user in users" :key="user.id" :value="user.id">{{user.name}} ({{user.login}})</option></select></label>
        <label>С даты<input v-model="filters.from" type="datetime-local" class="form-control"></label>
        <label>По дату<input v-model="filters.to" type="datetime-local" class="form-control"></label>
        <label>На странице<select v-model.number="limit" class="form-control"><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select></label>
        <button class="btn btn-primary">Применить фильтры</button>
      </fieldset>
    </form>
    <p v-if="error" role="alert" class="error">{{error}}</p>
    <p v-if="busy" role="status">Загрузка истории…</p>
    <template v-if="!error">
      <p v-if="!busy && !items.length">Изменений по выбранным фильтрам нет.</p>
      <article v-for="item in items" :key="item.id" class="event">
        <header><strong>{{item.actor_name}} ({{item.actor_login}})</strong><time>{{time(item.created_at)}}</time></header>
        <p>{{actions[item.action]}} · {{entities[item.entity]}} · <span class="object-id">{{item.entity_id}}</span></p>
        <details><summary>Что изменилось</summary>
          <div v-for="(change,field) in item.changes" :key="field" class="change">
            <strong>{{fieldNames[field]||field}}</strong>
            <div class="values"><div><small>До</small><pre>{{display(change.before)}}</pre></div><div><small>После</small><pre>{{display(change.after)}}</pre></div></div>
          </div>
        </details>
      </article>
      <div class="pagination">
        <button class="btn btn-outline" :disabled="busy || offset===0" @click="load(Math.max(0,offset-pageSize))">Назад</button>
        <span>{{total?offset+1:0}}–{{Math.min(offset+items.length,total)}} из {{total}}</span>
        <button class="btn btn-outline" :disabled="busy || offset+items.length>=total" @click="load(offset+pageSize)">Далее</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.history-view{max-width:1100px}.filters{margin:20px 0}.filters fieldset{border:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:end}label{display:grid;gap:8px;min-width:0}.event{padding:20px;border:1px solid var(--border-color,#e2e8f0);border-radius:12px;margin:16px 0;background:var(--surface,#fff)}header,.pagination{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}time,small{color:var(--text-muted,#64748b)}summary{cursor:pointer}.change{margin-top:16px}.values{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:#f8fafc;padding:12px;border-radius:6px;max-height:300px;overflow:auto}.object-id{overflow-wrap:anywhere}.error{color:#b91c1c}.pagination{justify-content:flex-start}@media(max-width:600px){.filters fieldset,.values{grid-template-columns:1fr}.event{padding:16px}}
</style>
